import type { RepoGroupDto } from '@shared/types';
import { useEffect, useRef, useState } from 'react';
import { FolderPlus } from 'lucide-react';

interface SidebarProps {
  tree: RepoGroupDto[];
  activeThreadId: string | null;
  activeRepoId: string | null;
  view: 'chat' | 'skills' | 'automations';
  onNewThread: () => void;
  onOpenSkills: () => void;
  onOpenAutomations: () => void;
  onSelectThread: (threadId: string, repoId: string) => void;
  onCreateThreadInRepo: (repoId: string) => void;
}

export function Sidebar(props: SidebarProps) {
  const activeGroup = props.tree.find((group) => group.repo.id === props.activeRepoId) ?? props.tree[0] ?? null;
  const activeRepoId = activeGroup?.repo.id ?? null;
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!projectMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProjectMenuOpen(false);
      }
    }

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (!projectMenuRef.current?.contains(target)) {
        setProjectMenuOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [projectMenuOpen]);

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-top-actions">
        <button className="menu-action" data-testid="menu-new-thread" onClick={props.onNewThread}>
          <span className="menu-action-icon">✎</span>
          <span>New thread</span>
        </button>
        <button
          className="menu-action"
          data-testid="menu-automations"
          onClick={props.onOpenAutomations}
        >
          <span className="menu-action-icon">◔</span>
          <span>Automations</span>
        </button>
        <button className="menu-action" data-testid="menu-skills" onClick={props.onOpenSkills}>
          <span className="menu-action-icon">◇</span>
          <span>Skills</span>
        </button>
      </div>

      <div className="thread-section-head">
        <div className="thread-section-title">Threads</div>
        <div className="thread-section-actions" ref={projectMenuRef}>
          <button
            className="repo-add-thread"
            data-testid="threads-project-menu-trigger"
            onClick={() => setProjectMenuOpen((value) => !value)}
            title="Add project"
            aria-label="Add project"
            aria-haspopup="menu"
            aria-expanded={projectMenuOpen}
          >
            <FolderPlus className="repo-add-thread-icon" aria-hidden="true" />
          </button>
          {projectMenuOpen && (
            <div className="thread-section-popover" role="menu" data-testid="threads-project-menu">
              <button
                type="button"
                className="thread-section-popover-item"
                role="menuitem"
                data-testid="threads-add-project"
                onClick={() => {
                  setProjectMenuOpen(false);
                  props.onNewThread();
                }}
              >
                Add project
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="active-thread-list">
        <div className="thread-list">
          {(activeGroup?.threads ?? []).map((thread) => (
            <button
              key={thread.id}
              className={`thread-item ${props.activeThreadId === thread.id ? 'active' : ''}`}
              data-testid={`thread-item-${thread.id}`}
              onClick={() => {
                if (activeRepoId) {
                  props.onSelectThread(thread.id, activeRepoId);
                }
              }}
              title={thread.title}
            >
              <span className="thread-title">{thread.title}</span>
              <span className="thread-time">{formatRelative(thread.updatedAt)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-settings">
        <span className="menu-action-icon">⚙</span>
        <span>Settings</span>
      </div>
    </aside>
  );
}

function formatRelative(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    return `${Math.max(diffHours, 0)}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}
