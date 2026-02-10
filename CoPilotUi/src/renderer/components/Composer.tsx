import { useMemo, useRef, useState } from 'react';
import type { AttachmentInput, ModelInfoDto } from '@shared/types';

interface ComposerProps {
  models: ModelInfoDto[];
  selectedModel: string | null;
  disabled: boolean;
  onChangeModel: (modelId: string) => void;
  onSend: (prompt: string, attachments: AttachmentInput[]) => Promise<void>;
  onAbort: () => Promise<void>;
}

export function Composer({ models, selectedModel, disabled, onChangeModel, onSend, onAbort }: ComposerProps) {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<AttachmentInput[]>([]);
  const [working, setWorking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = useMemo(() => prompt.trim().length > 0 && !disabled && !working, [prompt, disabled, working]);
  const sendButtonDisabled = !working && !canSend;

  async function handleSend() {
    if (!canSend) {
      return;
    }

    setWorking(true);
    try {
      await onSend(prompt, attachments);
      setPrompt('');
      setAttachments([]);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="composer-wrap" data-testid="composer">
      {attachments.length > 0 && (
        <div className="attachments-list" data-testid="attachments-list">
          {attachments.map((item) => (
            <span key={item.path} className="attachment-pill" data-testid="attachment-pill">
              {item.displayName ?? item.path.split('/').pop()}
            </span>
          ))}
        </div>
      )}

      <div className="composer-main">
        <textarea
          data-testid="prompt-input"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask Copilot to work on your codebase"
          rows={3}
          className="prompt-input"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              void handleSend();
            }
          }}
        />

        <div className="composer-controls">
          <button
            className="icon-btn"
            data-testid="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            disabled={disabled || working}
          >
            +
          </button>

          <input
            ref={fileInputRef}
            data-testid="attach-input"
            type="file"
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              const selected = files.map((file) => ({
                type: 'file' as const,
                path: (file as File & { path?: string }).path ?? file.name,
                displayName: file.name
              }));

              setAttachments(selected);
              event.target.value = '';
            }}
          />

          <select
            className="model-select"
            data-testid="model-select"
            value={selectedModel ?? ''}
            onChange={(event) => onChangeModel(event.target.value)}
            disabled={disabled || working}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>

          <button
            className="send-btn"
            data-testid="send-btn"
            onClick={() => {
              if (working) {
                void onAbort();
                return;
              }
              void handleSend();
            }}
            disabled={sendButtonDisabled}
            title={working ? 'Stop' : 'Send'}
            aria-label={working ? 'Stop' : 'Send'}
          >
            {working ? (
              <span className="send-stop-icon" aria-hidden="true" />
            ) : (
              <svg className="send-arrow-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4l-6 6h4v10h4V10h4z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
