import type { ChatEntry } from '@renderer/stores/chat-reducer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ConversationView({ entries }: { entries: ChatEntry[] }) {
  const visibleEntries = entries.filter((entry) => entry.role !== 'tool');

  if (entries.length === 0) {
    return (
      <section className="conversation empty" data-testid="conversation-empty">
        <p>Start a conversation with Copilot in this repository.</p>
      </section>
    );
  }

  return (
    <section className="conversation" data-testid="conversation">
      {visibleEntries.map((entry) => (
        <article key={entry.id} className={`bubble ${entry.role}`} data-testid={`bubble-${entry.role}`}>
          {entry.role === 'system' && (
            <div className="bubble-role">{labelForRole(entry.role, entry.eventType)}</div>
          )}
          <div className={`bubble-content ${entry.role === 'assistant' ? 'markdown' : 'plain'}`}>
            {entry.role === 'assistant' ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: (props) => <a {...props} rel="noreferrer noopener" target="_blank" />
                }}
              >
                {entry.content}
              </ReactMarkdown>
            ) : (
              entry.content
            )}
          </div>
          {entry.streaming && <div className="bubble-streaming">Streaming...</div>}
        </article>
      ))}
    </section>
  );
}

function labelForRole(role: ChatEntry['role'], eventType: string): string {
  if (role === 'tool') {
    return eventType;
  }

  if (role === 'assistant') {
    return 'Copilot';
  }

  if (role === 'user') {
    return 'You';
  }

  return 'System';
}
