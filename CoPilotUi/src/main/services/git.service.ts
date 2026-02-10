import { promisify } from 'node:util';
import { execFile as execFileCb } from 'node:child_process';
import type { GitActionResult, GitStatusDto } from '@shared/types';
import { ThreadService } from './thread.service';

const execFile = promisify(execFileCb);

export class GitService {
  constructor(private readonly threadService: ThreadService) {}

  async status(repoId: string): Promise<GitStatusDto> {
    const repo = this.threadService.getRepo(repoId);
    if (!repo || !repo.isAvailable) {
      throw new Error('Repo not found or path unavailable.');
    }

    try {
      // Scope to the selected project folder so we don't show unrelated changes
      // from a parent repo/worktree.
      const { stdout } = await execFile('git', ['-C', repo.rootPath, 'status', '--porcelain=v1', '-b', '--', '.']);
      const lines = stdout.trim().split('\n').filter(Boolean);
      const header = lines[0] ?? '';
      const { branch, upstream, ahead, behind } = this.parseStatusHeader(header);
      return {
        branch,
        upstream,
        ahead,
        behind,
        changedFiles: Math.max(lines.length - 1, 0),
        isRepo: true,
        output: stdout.trim()
      };
    } catch (error) {
      return {
        branch: 'unknown',
        ahead: 0,
        behind: 0,
        changedFiles: 0,
        isRepo: false,
        output: String(error)
      };
    }
  }

  async commit(repoId: string, message: string): Promise<GitActionResult> {
    const repo = this.threadService.getRepo(repoId);
    if (!repo || !repo.isAvailable) {
      throw new Error('Repo not found or path unavailable.');
    }

    const commitMessage = message.trim();
    if (!commitMessage) {
      throw new Error('Commit message is required.');
    }

    try {
      // Scope staging/commit to the selected project folder so we never accidentally
      // include changes from sibling folders in a parent repo.
      const addResult = await execFile('git', ['-C', repo.rootPath, 'add', '-A', '--', '.']);
      const commitResult = await execFile('git', ['-C', repo.rootPath, 'commit', '-m', commitMessage, '--', '.']);

      return {
        success: true,
        output: [addResult.stdout, commitResult.stdout].filter(Boolean).join('\n').trim()
      };
    } catch (error: unknown) {
      return {
        success: false,
        output: '',
        error: this.getErrorOutput(error)
      };
    }
  }

  async commitAndPush(repoId: string, message: string): Promise<GitActionResult> {
    const repo = this.threadService.getRepo(repoId);
    if (!repo || !repo.isAvailable) {
      throw new Error('Repo not found or path unavailable.');
    }

    const commitResult = await this.commit(repoId, message);
    if (!commitResult.success) {
      return commitResult;
    }

    try {
      const branch = (await execFile('git', ['-C', repo.rootPath, 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();

      let hasUpstream = true;
      try {
        await execFile('git', ['-C', repo.rootPath, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
      } catch {
        hasUpstream = false;
      }

      const pushArgs = hasUpstream
        ? ['-C', repo.rootPath, 'push']
        : ['-C', repo.rootPath, 'push', '--set-upstream', 'origin', branch];

      const pushResult = await execFile('git', pushArgs);

      return {
        success: true,
        output: [commitResult.output, pushResult.stdout].filter(Boolean).join('\n').trim()
      };
    } catch (error: unknown) {
      return {
        success: false,
        output: commitResult.output,
        error: this.getErrorOutput(error)
      };
    }
  }

  private parseStatusHeader(header: string): {
    branch: string;
    upstream?: string;
    ahead: number;
    behind: number;
  } {
    const normalized = header.replace(/^##\s*/, '');
    const branchPart = normalized.split('...')[0] || normalized;
    const branch = branchPart.split(' ')[0] || 'unknown';

    let upstream: string | undefined;
    let ahead = 0;
    let behind = 0;

    const upstreamMatch = normalized.match(/\.\.\.([^\s]+)/);
    if (upstreamMatch) {
      upstream = upstreamMatch[1];
    }

    const aheadMatch = normalized.match(/ahead\s(\d+)/);
    if (aheadMatch) {
      ahead = Number(aheadMatch[1]);
    }

    const behindMatch = normalized.match(/behind\s(\d+)/);
    if (behindMatch) {
      behind = Number(behindMatch[1]);
    }

    return { branch, upstream, ahead, behind };
  }

  private getErrorOutput(error: unknown): string {
    if (typeof error === 'object' && error !== null) {
      const stderr = (error as { stderr?: string }).stderr;
      const stdout = (error as { stdout?: string }).stdout;
      return [stderr, stdout].filter(Boolean).join('\n').trim() || String(error);
    }

    return String(error);
  }
}
