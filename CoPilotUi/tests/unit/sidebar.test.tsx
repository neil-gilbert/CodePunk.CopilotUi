import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@renderer/components/Sidebar';
import type { RepoGroupDto } from '@shared/types';

function buildTree(): RepoGroupDto[] {
  return [
    {
      repo: {
        id: 'repo-1',
        name: 'CoPilotUi',
        rootPath: '/tmp/copilot-ui',
        isAvailable: true,
        createdAt: '2026-02-09T00:00:00.000Z',
        updatedAt: '2026-02-09T00:00:00.000Z'
      },
      threads: [
        {
          id: 'thread-1',
          repoId: 'repo-1',
          title: 'Existing thread',
          copilotSessionId: null,
          model: null,
          createdAt: '2026-02-09T00:00:00.000Z',
          updatedAt: '2026-02-09T00:00:00.000Z',
          archivedAt: null
        }
      ]
    }
  ];
}

describe('Sidebar', () => {
  it('renders the Add project popover and triggers the folder picker flow', () => {
    const onNewThread = vi.fn();
    const onCreateThreadInRepo = vi.fn();

    render(
      <Sidebar
        tree={buildTree()}
        activeThreadId={null}
        activeRepoId="repo-1"
        view="chat"
        onNewThread={onNewThread}
        onOpenSkills={() => undefined}
        onOpenAutomations={() => undefined}
        onSelectThread={() => undefined}
        onCreateThreadInRepo={onCreateThreadInRepo}
      />
    );

    const trigger = screen.getByTestId('threads-project-menu-trigger');
    expect(trigger).toBeTruthy();
    expect(trigger.textContent?.includes('+')).toBe(false);
    expect(trigger.querySelector('.repo-add-thread-icon')).toBeTruthy();

    fireEvent.click(trigger);
    expect(screen.getByTestId('threads-project-menu')).toBeTruthy();

    const addProject = screen.getByTestId('threads-add-project');
    fireEvent.click(addProject);
    expect(onNewThread).toHaveBeenCalledTimes(1);
    expect(onCreateThreadInRepo).toHaveBeenCalledTimes(0);
  });
});
