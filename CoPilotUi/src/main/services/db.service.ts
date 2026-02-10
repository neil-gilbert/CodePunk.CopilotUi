import { createRequire } from 'node:module';
import type { MessageDto, RepoDto, ThreadDto } from '@shared/types';

export interface DbStore {
  upsertRepo(input: { id: string; name: string; rootPath: string; nowIso: string }): RepoDto;
  getRepoById(repoId: string): RepoDto | null;
  getRepoByRootPath(rootPath: string): RepoDto | null;
  listRepos(): RepoDto[];
  createThread(input: {
    id: string;
    repoId: string;
    title: string;
    copilotSessionId: string | null;
    model: string | null;
    nowIso: string;
  }): ThreadDto;
  listThreadsByRepo(repoId: string): ThreadDto[];
  getThreadById(threadId: string): ThreadDto | null;
  updateThreadSession(input: {
    threadId: string;
    copilotSessionId: string;
    model: string | null;
    nowIso: string;
  }): void;
  touchThread(threadId: string, nowIso: string): void;
  addMessage(input: {
    id: string;
    threadId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    eventType: string;
    metadataJson: string | null;
    nowIso: string;
  }): MessageDto;
  listMessages(threadId: string): MessageDto[];
  getSetting<T>(key: string): T | null;
  setSetting<T>(key: string, value: T): void;
}

type BetterStatement = {
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};

type BetterDb = {
  pragma: (sql: string) => unknown;
  exec: (sql: string) => void;
  prepare: (sql: string) => BetterStatement;
};

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  title TEXT NOT NULL,
  copilot_session_id TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY(repo_id) REFERENCES repos(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY(thread_id) REFERENCES threads(id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  message_id TEXT,
  path TEXT NOT NULL,
  display_name TEXT,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(thread_id) REFERENCES threads(id),
  FOREIGN KEY(message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_threads_repo_id ON threads(repo_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON threads(updated_at DESC);
`;

interface RepoRow {
  id: string;
  name: string;
  root_path: string;
  created_at: string;
  updated_at: string;
}

interface ThreadRow {
  id: string;
  repo_id: string;
  title: string;
  copilot_session_id: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface MessageRow {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  event_type: string;
  created_at: string;
  metadata_json: string | null;
}

export class DbService implements DbStore {
  private readonly db: BetterDb;

  constructor(dbPath: string) {
    const require = createRequire(import.meta.url);
    const BetterSqlite3 = require('better-sqlite3') as new (path: string) => BetterDb;
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA_SQL);
  }

  upsertRepo(input: { id: string; name: string; rootPath: string; nowIso: string }): RepoDto {
    this.db
      .prepare(
        `INSERT INTO repos (id, name, root_path, created_at, updated_at)
         VALUES (@id, @name, @root_path, @created_at, @updated_at)
         ON CONFLICT(root_path) DO UPDATE SET
            name = excluded.name,
            updated_at = excluded.updated_at`
      )
      .run({
        id: input.id,
        name: input.name,
        root_path: input.rootPath,
        created_at: input.nowIso,
        updated_at: input.nowIso
      });

    const row = this.db.prepare('SELECT * FROM repos WHERE root_path = ?').get(input.rootPath) as RepoRow;
    return this.mapRepo(row);
  }

  getRepoById(repoId: string): RepoDto | null {
    const row = this.db.prepare('SELECT * FROM repos WHERE id = ?').get(repoId) as RepoRow | undefined;
    return row ? this.mapRepo(row) : null;
  }

  getRepoByRootPath(rootPath: string): RepoDto | null {
    const row = this.db.prepare('SELECT * FROM repos WHERE root_path = ?').get(rootPath) as RepoRow | undefined;
    return row ? this.mapRepo(row) : null;
  }

  listRepos(): RepoDto[] {
    const rows = this.db
      .prepare('SELECT * FROM repos ORDER BY updated_at DESC')
      .all() as RepoRow[];
    return rows.map((row) => this.mapRepo(row));
  }

  createThread(input: {
    id: string;
    repoId: string;
    title: string;
    copilotSessionId: string | null;
    model: string | null;
    nowIso: string;
  }): ThreadDto {
    this.db
      .prepare(
        `INSERT INTO threads (id, repo_id, title, copilot_session_id, model, created_at, updated_at, archived_at)
         VALUES (@id, @repo_id, @title, @copilot_session_id, @model, @created_at, @updated_at, NULL)`
      )
      .run({
        id: input.id,
        repo_id: input.repoId,
        title: input.title,
        copilot_session_id: input.copilotSessionId,
        model: input.model,
        created_at: input.nowIso,
        updated_at: input.nowIso
      });

    this.touchRepo(input.repoId, input.nowIso);
    return this.getThreadById(input.id)!;
  }

  listThreadsByRepo(repoId: string): ThreadDto[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM threads
         WHERE repo_id = ? AND archived_at IS NULL
         ORDER BY updated_at DESC`
      )
      .all(repoId) as ThreadRow[];
    return rows.map((row) => this.mapThread(row));
  }

  getThreadById(threadId: string): ThreadDto | null {
    const row = this.db.prepare('SELECT * FROM threads WHERE id = ?').get(threadId) as ThreadRow | undefined;
    return row ? this.mapThread(row) : null;
  }

  updateThreadSession(input: {
    threadId: string;
    copilotSessionId: string;
    model: string | null;
    nowIso: string;
  }): void {
    this.db
      .prepare(
        `UPDATE threads
         SET copilot_session_id = @copilot_session_id,
             model = @model,
             updated_at = @updated_at
         WHERE id = @id`
      )
      .run({
        id: input.threadId,
        copilot_session_id: input.copilotSessionId,
        model: input.model,
        updated_at: input.nowIso
      });

    const thread = this.getThreadById(input.threadId);
    if (thread) {
      this.touchRepo(thread.repoId, input.nowIso);
    }
  }

  touchThread(threadId: string, nowIso: string): void {
    this.db.prepare('UPDATE threads SET updated_at = ? WHERE id = ?').run(nowIso, threadId);
    const thread = this.getThreadById(threadId);
    if (thread) {
      this.touchRepo(thread.repoId, nowIso);
    }
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
    this.db
      .prepare(
        `INSERT INTO messages (id, thread_id, role, content, event_type, created_at, metadata_json)
         VALUES (@id, @thread_id, @role, @content, @event_type, @created_at, @metadata_json)`
      )
      .run({
        id: input.id,
        thread_id: input.threadId,
        role: input.role,
        content: input.content,
        event_type: input.eventType,
        created_at: input.nowIso,
        metadata_json: input.metadataJson
      });

    this.touchThread(input.threadId, input.nowIso);
    return this.getMessageById(input.id)!;
  }

  listMessages(threadId: string): MessageDto[] {
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC')
      .all(threadId) as MessageRow[];
    return rows.map((row) => this.mapMessage(row));
  }

  getSetting<T>(key: string): T | null {
    const row = this.db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key) as
      | { value_json: string }
      | undefined;
    if (!row) {
      return null;
    }

    return JSON.parse(row.value_json) as T;
  }

  setSetting<T>(key: string, value: T): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value_json)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`
      )
      .run(key, JSON.stringify(value));
  }

  private getMessageById(messageId: string): MessageDto | null {
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as MessageRow | undefined;
    return row ? this.mapMessage(row) : null;
  }

  private touchRepo(repoId: string, nowIso: string): void {
    this.db.prepare('UPDATE repos SET updated_at = ? WHERE id = ?').run(nowIso, repoId);
  }

  private mapRepo(row: RepoRow): RepoDto {
    return {
      id: row.id,
      name: row.name,
      rootPath: row.root_path,
      isAvailable: true,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapThread(row: ThreadRow): ThreadDto {
    return {
      id: row.id,
      repoId: row.repo_id,
      title: row.title,
      copilotSessionId: row.copilot_session_id,
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at
    };
  }

  private mapMessage(row: MessageRow): MessageDto {
    return {
      id: row.id,
      threadId: row.thread_id,
      role: row.role,
      content: row.content,
      eventType: row.event_type,
      createdAt: row.created_at,
      metadataJson: row.metadata_json
    };
  }
}
