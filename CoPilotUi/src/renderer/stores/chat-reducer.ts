import type { MessageDto, SessionEventDto } from '@shared/types';

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  eventType: string;
  timestamp: string;
  streaming?: boolean;
}

export interface TranscriptState {
  entries: ChatEntry[];
}

export function fromPersistedMessages(messages: MessageDto[]): TranscriptState {
  return {
    entries: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      eventType: message.eventType,
      timestamp: message.createdAt,
      streaming: false
    }))
  };
}

export function applySessionEventToTranscript(state: TranscriptState, event: SessionEventDto): TranscriptState {
  const entries = [...state.entries];

  if (event.type === 'assistant.message_delta') {
    const messageId = String((event.data.messageId as string | undefined) ?? 'stream');
    const delta = String((event.data.deltaContent as string | undefined) ?? '');
    const streamId = `stream-${messageId}`;
    const currentIndex = entries.findIndex((entry) => entry.id === streamId);

    if (currentIndex >= 0) {
      entries[currentIndex] = {
        ...entries[currentIndex],
        content: entries[currentIndex].content + delta,
        timestamp: event.timestamp,
        streaming: true
      };
    } else {
      entries.push({
        id: streamId,
        role: 'assistant',
        content: delta,
        eventType: event.type,
        timestamp: event.timestamp,
        streaming: true
      });
    }

    return { entries };
  }

  if (event.type === 'assistant.message') {
    const messageId = String((event.data.messageId as string | undefined) ?? event.id);
    const streamId = `stream-${messageId}`;
    const streamIndex = entries.findIndex((entry) => entry.id === streamId);
    if (streamIndex >= 0) {
      entries.splice(streamIndex, 1);
    }

    entries.push({
      id: event.id,
      role: 'assistant',
      content: String((event.data.content as string | undefined) ?? ''),
      eventType: event.type,
      timestamp: event.timestamp,
      streaming: false
    });

    return { entries };
  }

  if (event.type === 'user.message') {
    entries.push({
      id: event.id,
      role: 'user',
      content: String((event.data.content as string | undefined) ?? ''),
      eventType: event.type,
      timestamp: event.timestamp,
      streaming: false
    });
    return { entries };
  }

  if (event.type.startsWith('tool.')) {
    const toolName = String((event.data.toolName as string | undefined) ?? 'tool');
    let content = toolName;
    if (event.type === 'tool.execution_progress') {
      content = String((event.data.progressMessage as string | undefined) ?? `${toolName} running`);
    }
    if (event.type === 'tool.execution_complete') {
      const success = Boolean(event.data.success);
      content = success ? `${toolName} completed` : `${toolName} failed`;
    }

    entries.push({
      id: event.id,
      role: 'tool',
      content,
      eventType: event.type,
      timestamp: event.timestamp,
      streaming: false
    });
    return { entries };
  }

  if (event.type === 'session.error') {
    entries.push({
      id: event.id,
      role: 'system',
      content: String((event.data.message as string | undefined) ?? 'Session error'),
      eventType: event.type,
      timestamp: event.timestamp,
      streaming: false
    });
  }

  return { entries };
}
