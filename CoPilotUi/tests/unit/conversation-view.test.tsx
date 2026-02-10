import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConversationView } from '@renderer/components/ConversationView';
import type { ChatEntry } from '@renderer/stores/chat-reducer';

describe('ConversationView', () => {
  it('renders assistant markdown content as HTML', () => {
    const entries: ChatEntry[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content:
          '# Release Notes\n\n- Added markdown rendering\n- Styled code blocks\n\nUse `npm test`.\n\n[Docs](https://example.com/docs)',
        eventType: 'assistant.message',
        timestamp: '2026-02-08T00:00:00.000Z'
      }
    ];

    render(<ConversationView entries={entries} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Release Notes' })).toBeTruthy();
    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getByText('Added markdown rendering')).toBeTruthy();
    expect(screen.getByText('npm test').tagName).toBe('CODE');

    const docsLink = screen.getByRole('link', { name: 'Docs' });
    expect(docsLink.getAttribute('href')).toBe('https://example.com/docs');
    expect(docsLink.getAttribute('target')).toBe('_blank');
  });

  it('keeps user markdown-like text as plain text', () => {
    const entries: ChatEntry[] = [
      {
        id: 'user-1',
        role: 'user',
        content: '**raw markdown**',
        eventType: 'user.message',
        timestamp: '2026-02-08T00:00:00.000Z'
      }
    ];

    const { container } = render(<ConversationView entries={entries} />);

    expect(screen.getByText('**raw markdown**')).toBeTruthy();
    expect(container.querySelector('[data-testid="bubble-user"] strong')).toBeNull();
  });
});
