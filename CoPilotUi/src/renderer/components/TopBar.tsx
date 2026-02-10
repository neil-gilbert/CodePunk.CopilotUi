import type { GitStatusDto } from '@shared/types';

interface TopBarProps {
  title: string;
  repoName: string | null;
  gitStatus: GitStatusDto | null;
  onCommit: () => void;
  onCommitAndPush: () => void;
  disabled: boolean;
}

export function TopBar({ title, repoName, gitStatus, onCommit, onCommitAndPush, disabled }: TopBarProps) {
  return (
    <header className="top-bar" data-testid="top-bar">
      <div className="top-heading">
        <h1 className="top-title" data-testid="thread-title">
          {title}
        </h1>
        <span className="top-repo" data-testid="repo-name">
          {repoName ?? 'workspace'}
        </span>
      </div>

      <div className="top-actions">
        <button className="commit-btn" data-testid="commit-btn" onClick={onCommit} disabled={disabled}>
          Commit
        </button>
        <button
          className="commit-btn primary"
          data-testid="commit-push-btn"
          onClick={onCommitAndPush}
          disabled={disabled}
        >
          Commit &amp; Push
        </button>

        {gitStatus?.isRepo && (
          <div className="top-git-meta" data-testid="top-git-meta">
            <span className="git-plus">+{gitStatus.ahead}</span>
            <span className="git-minus">-{gitStatus.behind}</span>
          </div>
        )}
      </div>
    </header>
  );
}
