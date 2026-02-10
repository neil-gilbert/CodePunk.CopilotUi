import { describe, expect, it } from 'vitest';
import { applySessionEventToTranscript } from '@renderer/stores/chat-reducer';
import type { SessionEventDto } from '@shared/types';
import type { TranscriptState } from '@renderer/stores/chat-reducer';

function makeEvent(partial: Partial<SessionEventDto>): SessionEventDto {
  return {
    threadId: 't1',
    type: 'assistant.message',
    timestamp: new Date().toISOString(),
    id: 'evt1',
    parentId: null,
    data: {},
    ...partial
  };
}

describe('applySessionEventToTranscript', () => {
  it('accumulates delta content and then replaces with final message', () => {
    let state: TranscriptState = { entries: [] };

    state = applySessionEventToTranscript(
      state,
      makeEvent({
        type: 'assistant.message_delta',
        data: { messageId: 'm1', deltaContent: 'Hel' }
      })
    );

    state = applySessionEventToTranscript(
      state,
      makeEvent({
        type: 'assistant.message_delta',
        data: { messageId: 'm1', deltaContent: 'lo' }
      })
    );

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].content).toBe('Hello');

    state = applySessionEventToTranscript(
      state,
      makeEvent({
        id: 'evt2',
        type: 'assistant.message',
        data: { messageId: 'm1', content: 'Hello' }
      })
    );

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].id).toBe('evt2');
    expect(state.entries[0].content).toBe('Hello');
  });

  it('adds tool progress and completion entries', () => {
    const base: TranscriptState = { entries: [] };

    const progress = applySessionEventToTranscript(
      base,
      makeEvent({
        type: 'tool.execution_progress',
        data: { toolName: 'shell', progressMessage: 'Running tests' }
      })
    );

    expect(progress.entries[0].role).toBe('tool');
    expect(progress.entries[0].content).toContain('Running tests');

    const done = applySessionEventToTranscript(
      progress,
      makeEvent({
        id: 'evt3',
        type: 'tool.execution_complete',
        data: { toolName: 'shell', success: true }
      })
    );

    expect(done.entries).toHaveLength(2);
    expect(done.entries[1].content).toContain('completed');
  });
});
