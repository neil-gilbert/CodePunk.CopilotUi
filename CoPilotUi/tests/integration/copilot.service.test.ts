import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { CopilotService } from '@main/services/copilot.service';
import { DbService } from '@main/services/db.service';
import { SkillsService } from '@main/services/skills.service';
import { ThreadService } from '@main/services/thread.service';
import type { SessionEventDto } from '@shared/types';

const cleanupPaths: string[] = [];

afterEach(() => {
  cleanupPaths.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true }));
});

class FakeSession {
  public sessionId: string;
  private handler: ((event: any) => void) | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  on(handler: (event: any) => void) {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }

  async send(input: { prompt: string }) {
    this.handler?.({
      id: 'u1',
      parentId: null,
      timestamp: new Date().toISOString(),
      type: 'user.message',
      data: { content: input.prompt }
    });

    this.handler?.({
      id: 'a1',
      parentId: 'u1',
      timestamp: new Date().toISOString(),
      type: 'assistant.message',
      data: { messageId: 'm1', content: 'ok' }
    });
  }

  async abort() {}
}

class FakeClient {
  public failModelList = false;

  async start() {}

  async listModels() {
    if (this.failModelList) {
      throw new Error('model list failed');
    }

    return [
      {
        id: 'gpt-5',
        name: 'GPT-5',
        capabilities: {
          supports: { vision: true, reasoningEffort: true },
          limits: { max_context_window_tokens: 1 }
        },
        supportedReasoningEfforts: ['low', 'medium', 'high'],
        defaultReasoningEffort: 'medium'
      }
    ];
  }

  async getAuthStatus() {
    return {
      isAuthenticated: true,
      statusMessage: 'ok',
      login: 'user',
      host: 'github.com',
      authType: 'user'
    };
  }

  async createSession() {
    return new FakeSession('s1');
  }

  async resumeSession(sessionId: string) {
    return new FakeSession(sessionId);
  }
}

describe('CopilotService integration', () => {
  it('uses cached models when listModels fails', async () => {
    const root = mkdtempSync(join(tmpdir(), 'copilot-ui-copilot-'));
    const repoPath = join(root, 'repo');
    mkdirSync(repoPath, { recursive: true });
    cleanupPaths.push(root);

    const db = new DbService(join(root, 'test.db'));
    const threadService = new ThreadService(db);
    const skillsService = new SkillsService(threadService);
    const events: SessionEventDto[] = [];

    const fakeClient = new FakeClient();
    const service = new CopilotService(threadService, skillsService, (event) => events.push(event), fakeClient as any);

    const first = await service.listModels();
    expect(first[0].id).toBe('gpt-5');

    fakeClient.failModelList = true;
    const fallback = await service.listModels();
    expect(fallback[0].id).toBe('gpt-5');

    const created = threadService.createRepoAndThread(repoPath, 'gpt-5');
    await service.resumeThread(created.thread.id);
    await service.sendMessage({ threadId: created.thread.id, prompt: 'hello' });

    expect(events.some((event) => event.type === 'assistant.message')).toBe(true);
    const saved = service.listMessages(created.thread.id);
    expect(saved.some((item) => item.role === 'assistant')).toBe(true);
  });
});
