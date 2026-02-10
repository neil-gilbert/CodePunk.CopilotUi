export type SkillScope = 'global' | 'repo';

export interface RepoDto {
  id: string;
  name: string;
  rootPath: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadDto {
  id: string;
  repoId: string;
  title: string;
  copilotSessionId: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface RepoGroupDto {
  repo: RepoDto;
  threads: ThreadDto[];
}

export interface SkillDto {
  name: string;
  scope: SkillScope;
  basePath: string;
  skillPath: string;
  hasSkillFile: boolean;
}

export interface ModelInfoDto {
  id: string;
  name: string;
  supportsVision: boolean;
  supportsReasoningEffort: boolean;
  defaultReasoningEffort?: string;
  supportedReasoningEfforts?: string[];
}

export interface GitStatusDto {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  changedFiles: number;
  isRepo: boolean;
  output: string;
}

export interface GitActionResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface AttachmentInput {
  type: 'file';
  path: string;
  displayName?: string;
}

export interface SessionEventDto {
  threadId: string;
  type: string;
  timestamp: string;
  id: string;
  parentId: string | null;
  data: Record<string, unknown>;
}

export interface MessageDto {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  eventType: string;
  metadataJson: string | null;
  createdAt: string;
}

export interface CreateThreadInput {
  repoId: string;
  title?: string;
  model?: string;
}

export interface SendMessageInput {
  threadId: string;
  prompt: string;
  attachments?: AttachmentInput[];
  model?: string;
}

export interface CreateSkillInput {
  scope: SkillScope;
  repoId?: string;
  name: string;
  content: string;
}

export interface CreateRepoAndThreadResult {
  repo: RepoDto;
  thread: ThreadDto;
}

export interface CopilotAuthStatusDto {
  isAuthenticated: boolean;
  statusMessage?: string;
  login?: string;
  host?: string;
  authType?: string;
}

export interface CopilotUiApi {
  copilot: {
    listModels: () => Promise<ModelInfoDto[]>;
    authStatus: () => Promise<CopilotAuthStatusDto>;
    createThread: (input: CreateThreadInput) => Promise<ThreadDto>;
    resumeThread: (threadId: string) => Promise<void>;
    sendMessage: (input: SendMessageInput) => Promise<void>;
    abort: (threadId: string) => Promise<void>;
    listMessages: (threadId: string) => Promise<MessageDto[]>;
    onEvent: (handler: (event: SessionEventDto) => void) => () => void;
  };
  threads: {
    listTree: () => Promise<RepoGroupDto[]>;
    createRepoAndThread: (folderPath: string, model?: string) => Promise<CreateRepoAndThreadResult>;
    createThreadInRepo: (repoId: string, model?: string) => Promise<ThreadDto>;
    getThread: (threadId: string) => Promise<ThreadDto | null>;
    selectFolder: () => Promise<string | null>;
  };
  skills: {
    list: (repoId?: string) => Promise<SkillDto[]>;
    create: (input: CreateSkillInput) => Promise<SkillDto>;
  };
  git: {
    status: (repoId: string) => Promise<GitStatusDto>;
    commit: (repoId: string, message: string) => Promise<GitActionResult>;
    commitAndPush: (repoId: string, message: string) => Promise<GitActionResult>;
  };
}

declare global {
  interface Window {
    copilotUi: CopilotUiApi;
  }
}
