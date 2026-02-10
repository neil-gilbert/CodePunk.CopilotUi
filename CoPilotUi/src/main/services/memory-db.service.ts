import type { MessageDto, RepoDto, ThreadDto } from '@shared/types';
import type { DbStore } from './db.service';

export class MemoryDbService implements DbStore {
  private repos = new Map<string, RepoDto>();
  private reposByPath = new Map<string, string>();
  private threads = new Map<string, ThreadDto>();
  private messages = new Map<string, MessageDto[]>();
  private settings = new Map<string, string>();

  upsertRepo(input: { id: string; name: string; rootPath: string; nowIso: string }): RepoDto {
    const existingId = this.reposByPath.get(input.rootPath);
    if (existingId) {
      const current = this.repos.get(existingId)!;
      const updated: RepoDto = {
        ...current,
        name: input.name,
        updatedAt: input.nowIso
      };
      this.repos.set(existingId, updated);
      return updated;
    }

    const repo: RepoDto = {
      id: input.id,
      name: input.name,
      rootPath: input.rootPath,
      isAvailable: true,
      createdAt: input.nowIso,
      updatedAt: input.nowIso
    };

    this.repos.set(repo.id, repo);
    this.reposByPath.set(repo.rootPath, repo.id);
    return repo;
  }

  getRepoById(repoId: string): RepoDto | null {
    return this.repos.get(repoId) ?? null;
  }

  getRepoByRootPath(rootPath: string): RepoDto | null {
    const repoId = this.reposByPath.get(rootPath);
    return repoId ? this.repos.get(repoId) ?? null : null;
  }

  listRepos(): RepoDto[] {
    return Array.from(this.repos.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  createThread(input: {
    id: string;
    repoId: string;
    title: string;
    copilotSessionId: string | null;
    model: string | null;
    nowIso: string;
  }): ThreadDto {
    const thread: ThreadDto = {
      id: input.id,
      repoId: input.repoId,
      title: input.title,
      copilotSessionId: input.copilotSessionId,
      model: input.model,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
      archivedAt: null
    };

    this.threads.set(thread.id, thread);
    this.messages.set(thread.id, []);
    this.touchRepo(input.repoId, input.nowIso);
    return thread;
  }

  listThreadsByRepo(repoId: string): ThreadDto[] {
    return Array.from(this.threads.values())
      .filter((thread) => thread.repoId === repoId && !thread.archivedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getThreadById(threadId: string): ThreadDto | null {
    return this.threads.get(threadId) ?? null;
  }

  updateThreadSession(input: {
    threadId: string;
    copilotSessionId: string;
    model: string | null;
    nowIso: string;
  }): void {
    const thread = this.threads.get(input.threadId);
    if (!thread) {
      return;
    }

    const updated: ThreadDto = {
      ...thread,
      copilotSessionId: input.copilotSessionId,
      model: input.model,
      updatedAt: input.nowIso
    };

    this.threads.set(input.threadId, updated);
    this.touchRepo(updated.repoId, input.nowIso);
  }

  touchThread(threadId: string, nowIso: string): void {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return;
    }

    const updated: ThreadDto = { ...thread, updatedAt: nowIso };
    this.threads.set(threadId, updated);
    this.touchRepo(updated.repoId, nowIso);
  }

  addMessage(input: {
    id: string;
    threadId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    eventType: string;
    metadataJson: string | null;
    nowIso: string;
  }): MessageDto {
    const message: MessageDto = {
      id: input.id,
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      eventType: input.eventType,
      metadataJson: input.metadataJson,
      createdAt: input.nowIso
    };

    const threadMessages = this.messages.get(input.threadId) ?? [];
    threadMessages.push(message);
    this.messages.set(input.threadId, threadMessages);
    this.touchThread(input.threadId, input.nowIso);
    return message;
  }

  listMessages(threadId: string): MessageDto[] {
    return [...(this.messages.get(threadId) ?? [])];
  }

  getSetting<T>(key: string): T | null {
    const value = this.settings.get(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  setSetting<T>(key: string, value: T): void {
    this.settings.set(key, JSON.stringify(value));
  }

  private touchRepo(repoId: string, nowIso: string): void {
    const repo = this.repos.get(repoId);
    if (!repo) {
      return;
    }

    this.repos.set(repoId, { ...repo, updatedAt: nowIso });
  }
}
