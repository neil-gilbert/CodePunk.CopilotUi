import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { DbService } from '@main/services/db.service';
import { ThreadService } from '@main/services/thread.service';

const cleanupPaths: string[] = [];

afterEach(() => {
  cleanupPaths.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true }));
});

describe('ThreadService', () => {
  it('creates repo and thread and lists them in tree', () => {
    const root = mkdtempSync(join(tmpdir(), 'copilot-ui-thread-test-'));
    cleanupPaths.push(root);

    const dbPath = join(root, 'test.db');
    const repoPath = join(root, 'repo');
    cleanupPaths.push(repoPath);

    mkdirSync(repoPath, { recursive: true });

    const db = new DbService(dbPath);
    const service = new ThreadService(db);

    const created = service.createRepoAndThread(repoPath, 'gpt-5');
    const tree = service.listTree();

    expect(created.repo.rootPath).toBe(repoPath);
    expect(created.thread.model).toBe('gpt-5');
    expect(tree).toHaveLength(1);
    expect(tree[0].repo.name).toBe('repo');
    expect(tree[0].threads).toHaveLength(1);
  });
});
