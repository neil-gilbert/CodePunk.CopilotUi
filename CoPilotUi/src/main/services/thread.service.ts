import { basename } from 'node:path';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type {
  CreateRepoAndThreadResult,
  RepoDto,
  RepoGroupDto,
  ThreadDto
} from '@shared/types';
import type { DbStore } from './db.service';

export class ThreadService {
  constructor(private readonly db: DbStore) {}

  listTree(): RepoGroupDto[] {
    const repos = this.db.listRepos();
    return repos.map((repo) => {
      const isAvailable = existsSync(repo.rootPath);
      const normalizedRepo: RepoDto = { ...repo, isAvailable };
      const threads = this.db.listThreadsByRepo(repo.id);
      return {
        repo: normalizedRepo,
        threads
      };
    });
  }

  createRepoAndThread(folderPath: string, model?: string): CreateRepoAndThreadResult {
    if (!existsSync(folderPath)) {
      throw new Error(`Folder does not exist: ${folderPath}`);
    }

    const nowIso = new Date().toISOString();
    const existingRepo = this.db.getRepoByRootPath(folderPath);
    const repo =
      existingRepo ??
      this.db.upsertRepo({
        id: randomUUID(),
        name: basename(folderPath),
        rootPath: folderPath,
        nowIso
      });

    const thread = this.db.createThread({
      id: randomUUID(),
      repoId: repo.id,
      title: 'New conversation',
      copilotSessionId: null,
      model: model ?? null,
      nowIso
    });

    return {
      repo: { ...repo, isAvailable: true },
      thread
    };
  }

  createThreadInRepo(repoId: string, model?: string): ThreadDto {
    const repo = this.db.getRepoById(repoId);
    if (!repo) {
      throw new Error(`Repo ${repoId} was not found.`);
    }

    if (!existsSync(repo.rootPath)) {
      throw new Error(`Repo path is not available: ${repo.rootPath}`);
    }

    const nowIso = new Date().toISOString();
    return this.db.createThread({
      id: randomUUID(),
      repoId,
      title: 'New conversation',
      copilotSessionId: null,
      model: model ?? null,
      nowIso
    });
  }

  getThread(threadId: string): ThreadDto | null {
    return this.db.getThreadById(threadId);
  }

  getRepo(repoId: string): RepoDto | null {
    const repo = this.db.getRepoById(repoId);
    if (!repo) {
      return null;
    }

    return {
      ...repo,
      isAvailable: existsSync(repo.rootPath)
    };
  }

  updateThreadSession(threadId: string, sessionId: string, model: string | null): void {
    this.db.updateThreadSession({
      threadId,
      copilotSessionId: sessionId,
      model,
      nowIso: new Date().toISOString()
    });
  }

  listMessages(threadId: string) {
    return this.db.listMessages(threadId);
  }

  addMessage(input: {
    id: string;
    threadId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    eventType: string;
    metadataJson: string | null;
    nowIso: string;
  }) {
    return this.db.addMessage(input);
  }

  setSetting<T>(key: string, value: T): void {
    this.db.setSetting(key, value);
  }

  getSetting<T>(key: string): T | null {
    return this.db.getSetting<T>(key);
  }
}
