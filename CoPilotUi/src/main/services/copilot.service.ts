import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CopilotClient, type CopilotSession, type ModelInfo, type SessionEvent } from '@github/copilot-sdk';
import type {
  AttachmentInput,
  CopilotAuthStatusDto,
  MessageDto,
  ModelInfoDto,
  SendMessageInput,
  SessionEventDto,
  ThreadDto
} from '@shared/types';
import { SkillsService } from './skills.service';
import { ThreadService } from './thread.service';

interface ActiveSession {
  session: CopilotSession;
  model: string | null;
}

const MODELS_CACHE_KEY = 'copilot.models-cache.v1';

export class CopilotService {
  private client: CopilotClient;
  private readonly providedClient?: CopilotClient;
  private readonly sessions = new Map<string, ActiveSession>();
  private readonly fakeMode = process.env.COPILOT_UI_FAKE_COPILOT === '1';
  private started = false;
  private startPromise: Promise<void> | null = null;

  private readonly fakeModels: ModelInfoDto[] = [
    {
      id: 'gpt-5',
      name: 'GPT-5',
      supportsVision: true,
      supportsReasoningEffort: true,
      defaultReasoningEffort: 'medium',
      supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh']
    },
    {
      id: 'claude-sonnet-4.5',
      name: 'Claude Sonnet 4.5',
      supportsVision: true,
      supportsReasoningEffort: false
    }
  ];

  constructor(
    private readonly threadService: ThreadService,
    private readonly skillsService: SkillsService,
    private readonly emitEvent: (event: SessionEventDto) => void,
    client?: CopilotClient
  ) {
    this.providedClient = client;
    this.client = client ?? this.createClient();
  }

  async listModels(): Promise<ModelInfoDto[]> {
    if (this.fakeMode) {
      this.threadService.setSetting(MODELS_CACHE_KEY, this.fakeModels);
      return this.fakeModels;
    }

    try {
      const models = await this.withClientRecovery(async () => {
        await this.ensureStarted();
        return this.client.listModels();
      });
      const mapped = models.map((model) => this.mapModel(model));
      this.threadService.setSetting(MODELS_CACHE_KEY, mapped);
      return mapped;
    } catch (error) {
      const cached = this.threadService.getSetting<ModelInfoDto[]>(MODELS_CACHE_KEY);
      if (cached && cached.length > 0) {
        return cached;
      }

      throw new Error(`Unable to load models from Copilot CLI: ${this.errorText(error)}`);
    }
  }

  async authStatus(): Promise<CopilotAuthStatusDto> {
    if (this.fakeMode) {
      return {
        isAuthenticated: true,
        statusMessage: 'Authenticated (mock)',
        login: 'mock-user',
        host: 'github.com',
        authType: 'user'
      };
    }

    const status = await this.withClientRecovery(async () => {
      await this.ensureStarted();
      return this.client.getAuthStatus();
    });
    return {
      isAuthenticated: status.isAuthenticated,
      statusMessage: status.statusMessage,
      login: status.login,
      host: status.host,
      authType: status.authType
    };
  }

  async createThread(input: { repoId: string; title?: string; model?: string }): Promise<ThreadDto> {
    const thread = this.threadService.createThreadInRepo(input.repoId, input.model);
    await this.resumeThread(thread.id);
    return thread;
  }

  async resumeThread(threadId: string): Promise<void> {
    const thread = this.requireThread(threadId);
    if (this.fakeMode) {
      const fakeSessionId = thread.copilotSessionId ?? `mock-${thread.id}`;
      this.threadService.updateThreadSession(thread.id, fakeSessionId, thread.model ?? 'gpt-5');
      return;
    }

    await this.withClientRecovery(async () => {
      await this.ensureSession(thread, thread.model ?? null, true);
    });
  }

  async sendMessage(input: SendMessageInput): Promise<void> {
    const thread = this.requireThread(input.threadId);
    const targetModel = input.model ?? thread.model ?? null;
    const attachments = this.validateAttachments(input.attachments ?? []);

    if (this.fakeMode) {
      await this.sendMessageFake(thread, input.prompt, attachments, targetModel);
      return;
    }

    await this.withRecovery(thread.id, async () => {
      const active = await this.ensureSession(thread, targetModel, false);
      await active.session.send({
        prompt: input.prompt,
        attachments
      });
    });
  }

  async abort(threadId: string): Promise<void> {
    if (this.fakeMode) {
      this.dispatchEvent({
        threadId,
        type: 'abort',
        timestamp: new Date().toISOString(),
        id: randomUUID(),
        parentId: null,
        data: { reason: 'user_requested' }
      });
      return;
    }

    const active = this.sessions.get(threadId);
    if (active) {
      await active.session.abort();
    }
  }

  listMessages(threadId: string): MessageDto[] {
    return this.threadService.listMessages(threadId);
  }

  private async withRecovery(threadId: string, operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      if (this.isStreamDestroyedError(error)) {
        await this.resetClientConnection();
      }
      this.sessions.delete(threadId);
      await operation().catch(() => {
        throw error;
      });
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.started) {
      return;
    }
    if (this.startPromise) {
      await this.startPromise;
      return;
    }

    this.startPromise = this.client
      .start()
      .then(() => {
        this.started = true;
      })
      .finally(() => {
        this.startPromise = null;
      });

    await this.startPromise;
  }

  private async ensureSession(
    thread: ThreadDto,
    requestedModel: string | null,
    forceResume: boolean
  ): Promise<ActiveSession> {
    const cached = this.sessions.get(thread.id);
    if (cached && !forceResume) {
      if (!requestedModel || requestedModel === cached.model) {
        return cached;
      }
    }

    const repo = this.threadService.getRepo(thread.repoId);
    if (!repo || !repo.isAvailable) {
      throw new Error('Repo path is unavailable for this thread.');
    }

    const skillDirectories = this.skillsService.getSkillDirectories(repo.rootPath);

    const sessionConfig = {
      model: requestedModel ?? undefined,
      workingDirectory: repo.rootPath,
      streaming: true,
      skillDirectories
    };

    const session = await this.withClientRecovery(async () => {
      await this.ensureStarted();
      return thread.copilotSessionId
        ? this.client.resumeSession(thread.copilotSessionId, sessionConfig)
        : this.client.createSession(sessionConfig);
    });

    this.threadService.updateThreadSession(thread.id, session.sessionId, requestedModel);
    const active: ActiveSession = {
      session,
      model: requestedModel
    };

    this.registerSessionHandlers(thread.id, session);
    this.sessions.set(thread.id, active);
    return active;
  }

  private registerSessionHandlers(threadId: string, session: CopilotSession): void {
    session.on((event) => {
      const dto = this.toSessionEventDto(threadId, event);
      this.dispatchEvent(dto);
    });
  }

  private dispatchEvent(event: SessionEventDto): void {
    this.emitEvent(event);
    this.persistEvent(event);
  }

  private async sendMessageFake(
    thread: ThreadDto,
    prompt: string,
    attachments: AttachmentInput[],
    targetModel: string | null
  ): Promise<void> {
    const sessionId = thread.copilotSessionId ?? `mock-${thread.id}`;
    const model = targetModel ?? thread.model ?? 'gpt-5';
    this.threadService.updateThreadSession(thread.id, sessionId, model);

    const userEventId = randomUUID();
    this.dispatchEvent({
      threadId: thread.id,
      type: 'user.message',
      timestamp: new Date().toISOString(),
      id: userEventId,
      parentId: null,
      data: {
        content: prompt,
        attachments
      }
    });

    const toolCallId = randomUUID();
    this.dispatchEvent({
      threadId: thread.id,
      type: 'tool.execution_start',
      timestamp: new Date().toISOString(),
      id: randomUUID(),
      parentId: userEventId,
      data: {
        toolCallId,
        toolName: 'mock.tool',
        arguments: {}
      }
    });

    this.dispatchEvent({
      threadId: thread.id,
      type: 'tool.execution_progress',
      timestamp: new Date().toISOString(),
      id: randomUUID(),
      parentId: userEventId,
      data: {
        toolCallId,
        progressMessage: 'Mock tool running'
      }
    });

    this.dispatchEvent({
      threadId: thread.id,
      type: 'tool.execution_complete',
      timestamp: new Date().toISOString(),
      id: randomUUID(),
      parentId: userEventId,
      data: {
        toolCallId,
        success: true
      }
    });

    const reply = `Mock response from ${model}: ${prompt}`;
    const messageId = randomUUID();
    const cut = Math.ceil(reply.length / 2);

    this.dispatchEvent({
      threadId: thread.id,
      type: 'assistant.message_delta',
      timestamp: new Date().toISOString(),
      id: randomUUID(),
      parentId: userEventId,
      data: {
        messageId,
        deltaContent: reply.slice(0, cut)
      }
    });

    this.dispatchEvent({
      threadId: thread.id,
      type: 'assistant.message_delta',
      timestamp: new Date().toISOString(),
      id: randomUUID(),
      parentId: userEventId,
      data: {
        messageId,
        deltaContent: reply.slice(cut)
      }
    });

    this.dispatchEvent({
      threadId: thread.id,
      type: 'assistant.message',
      timestamp: new Date().toISOString(),
      id: randomUUID(),
      parentId: userEventId,
      data: {
        messageId,
        content: reply,
        toolRequests: []
      }
    });

    this.dispatchEvent({
      threadId: thread.id,
      type: 'session.idle',
      timestamp: new Date().toISOString(),
      id: randomUUID(),
      parentId: userEventId,
      data: {}
    });
  }

  private persistEvent(event: SessionEventDto): void {
    const nowIso = new Date().toISOString();
    const metadataJson = JSON.stringify(event.data);

    switch (event.type) {
      case 'user.message': {
        this.threadService.addMessage({
          id: randomUUID(),
          threadId: event.threadId,
          role: 'user',
          content: String(event.data.content ?? ''),
          eventType: event.type,
          metadataJson,
          nowIso
        });
        break;
      }
      case 'assistant.message': {
        this.threadService.addMessage({
          id: randomUUID(),
          threadId: event.threadId,
          role: 'assistant',
          content: String(event.data.content ?? ''),
          eventType: event.type,
          metadataJson,
          nowIso
        });
        break;
      }
      case 'tool.execution_start':
      case 'tool.execution_progress':
      case 'tool.execution_complete': {
        this.threadService.addMessage({
          id: randomUUID(),
          threadId: event.threadId,
          role: 'tool',
          content: this.extractToolContent(event),
          eventType: event.type,
          metadataJson,
          nowIso
        });
        break;
      }
      case 'session.error': {
        this.threadService.addMessage({
          id: randomUUID(),
          threadId: event.threadId,
          role: 'system',
          content: String(event.data.message ?? 'Session error'),
          eventType: event.type,
          metadataJson,
          nowIso
        });
        break;
      }
      case 'session.model_change': {
        const thread = this.threadService.getThread(event.threadId);
        if (thread?.copilotSessionId) {
          const model = String(event.data.newModel ?? thread.model ?? '');
          this.threadService.updateThreadSession(thread.id, thread.copilotSessionId, model || null);
        }
        break;
      }
      default:
        break;
    }
  }

  private extractToolContent(event: SessionEventDto): string {
    if (event.type === 'tool.execution_start') {
      return `Running ${String(event.data.toolName ?? 'tool')}...`;
    }

    if (event.type === 'tool.execution_progress') {
      return String(event.data.progressMessage ?? 'Tool running...');
    }

    if (event.type === 'tool.execution_complete') {
      const success = Boolean(event.data.success);
      if (success) {
        return 'Tool execution complete';
      }
      return String((event.data.error as { message?: string } | undefined)?.message ?? 'Tool execution failed');
    }

    return 'Tool event';
  }

  private validateAttachments(attachments: AttachmentInput[]): AttachmentInput[] {
    return attachments.map((attachment) => {
      if (!isAbsolute(attachment.path)) {
        throw new Error(`Attachment path must be absolute: ${attachment.path}`);
      }

      if (!existsSync(attachment.path)) {
        throw new Error(`Attachment file does not exist: ${attachment.path}`);
      }

      return attachment;
    });
  }

  private requireThread(threadId: string): ThreadDto {
    const thread = this.threadService.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} was not found.`);
    }
    return thread;
  }

  private toSessionEventDto(threadId: string, event: SessionEvent): SessionEventDto {
    return {
      threadId,
      type: event.type,
      timestamp: event.timestamp,
      id: event.id,
      parentId: event.parentId,
      data: event.data as Record<string, unknown>
    };
  }

  private mapModel(model: ModelInfo): ModelInfoDto {
    return {
      id: model.id,
      name: model.name,
      supportsVision: model.capabilities.supports.vision,
      supportsReasoningEffort: model.capabilities.supports.reasoningEffort,
      defaultReasoningEffort: model.defaultReasoningEffort,
      supportedReasoningEfforts: model.supportedReasoningEfforts
    };
  }

  private createClient(): CopilotClient {
    const cliPath = this.resolveCopilotCliPath();
    const pathWithCommonBins = this.extendPathWithCommonBinDirs(process.env.PATH);
    const githubToken = this.resolveGithubToken(pathWithCommonBins);

    return new CopilotClient({
      cliPath,
      useStdio: true,
      autoStart: false,
      logLevel: 'error',
      githubToken,
      useLoggedInUser: githubToken ? false : true,
      env: {
        ...process.env,
        PATH: pathWithCommonBins
      }
    });
  }

  private async withClientRecovery<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.isStreamDestroyedError(error)) {
        throw error;
      }

      await this.resetClientConnection();
      return operation();
    }
  }

  private async resetClientConnection(): Promise<void> {
    if (this.providedClient) {
      return;
    }

    try {
      await this.client.stop();
    } catch {
      // ignore cleanup errors, we're recreating the client anyway
    }

    this.client = this.createClient();
    this.started = false;
    this.startPromise = null;
    this.sessions.clear();
  }

  private isStreamDestroyedError(error: unknown): boolean {
    const text = this.errorText(error).toLowerCase();
    return (
      text.includes('err_stream_destroyed') ||
      text.includes('stream was destroyed') ||
      text.includes('cannot call write after a stream was destroyed')
    );
  }

  private errorText(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    return String(error);
  }

  private resolveCopilotCliPath(): string {
    const bundled = this.resolveBundledCopilotCliPath();
    const candidates = [process.env.COPILOT_CLI_PATH, bundled, '/opt/homebrew/bin/copilot', '/usr/local/bin/copilot', '/usr/bin/copilot'].filter(
      Boolean
    ) as string[];

    for (const path of candidates) {
      if (existsSync(path)) {
        return path;
      }
    }

    return 'copilot';
  }

  private extendPathWithCommonBinDirs(currentPath?: string): string {
    const base = (currentPath ?? '').split(':').filter(Boolean);
    const common = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
    const merged = [...base];

    for (const entry of common) {
      if (!merged.includes(entry)) {
        merged.push(entry);
      }
    }

    return merged.join(':');
  }

  private resolveBundledCopilotCliPath(): string | null {
    const platformPackage = `copilot-${process.platform}-${process.arch}`;
    const executableName = process.platform === 'win32' ? 'copilot.exe' : 'copilot';
    const resourcesPath = process.resourcesPath;
    const packagedCandidates = resourcesPath
      ? [
          join(resourcesPath, 'app.asar.unpacked', 'node_modules', '@github', platformPackage, executableName),
          join(resourcesPath, 'app.asar.unpacked', 'node_modules', '@github', 'copilot', executableName),
          join(resourcesPath, 'node_modules', '@github', platformPackage, executableName),
          join(resourcesPath, 'node_modules', '@github', 'copilot', executableName)
        ]
      : [];
    const candidates = [
      join(process.cwd(), 'node_modules', '@github', platformPackage, executableName),
      join(process.cwd(), 'node_modules', '@github', 'copilot', executableName),
      ...packagedCandidates
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private resolveGithubToken(pathWithCommonBins: string): string | undefined {
    const explicitToken = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
    if (explicitToken) {
      return explicitToken;
    }

    try {
      const result = spawnSync('gh', ['auth', 'token', '--hostname', 'github.com'], {
        encoding: 'utf8',
        timeout: 5000,
        env: {
          ...process.env,
          PATH: pathWithCommonBins
        }
      });

      if (result.status === 0) {
        const token = result.stdout.trim();
        if (token.length > 0) {
          return token;
        }
      }

      return undefined;
    } catch {
      return undefined;
    }
  }
}
