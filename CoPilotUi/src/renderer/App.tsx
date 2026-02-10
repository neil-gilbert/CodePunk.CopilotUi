import { useEffect } from 'react';
import { AppStoreProvider, useAppStore } from '@renderer/stores/app-store';
import { Sidebar } from '@renderer/components/Sidebar';
import { TopBar } from '@renderer/components/TopBar';
import { ConversationView } from '@renderer/components/ConversationView';
import { Composer } from '@renderer/components/Composer';
import { SkillsView } from '@renderer/components/SkillsView';
import { AutomationsPlaceholder } from '@renderer/components/AutomationsPlaceholder';

function AppInner() {
  const store = useAppStore();
  const activeRepo = store.tree.find((group) => group.repo.id === store.activeRepoId)?.repo ?? null;

  useEffect(() => {
    if (store.view === 'skills') {
      void store.refreshSkills();
    }
  }, [store.view, store.refreshSkills]);

  async function handleCommit(push: boolean) {
    if (!store.activeRepoId) {
      return;
    }

    const message = window.prompt(push ? 'Commit & push message' : 'Commit message');
    if (!message || !message.trim()) {
      return;
    }

    if (push) {
      await store.commitAndPush(message);
    } else {
      await store.commit(message);
    }
  }

  return (
    <div className="app-shell" data-testid="app-shell">
      <Sidebar
        tree={store.tree}
        activeThreadId={store.activeThread?.id ?? null}
        activeRepoId={store.activeRepoId}
        view={store.view}
        onNewThread={() => void store.createNewThreadFromPicker()}
        onOpenSkills={() => store.setView('skills')}
        onOpenAutomations={() => store.setView('automations')}
        onSelectThread={(threadId, repoId) => void store.selectThread(threadId, repoId)}
        onCreateThreadInRepo={(repoId) => void store.createThreadInRepo(repoId)}
      />

      <main className="main-panel">
        <TopBar
          title={store.activeThread?.title ?? 'GitHub Copilot UI'}
          repoName={activeRepo?.name ?? null}
          gitStatus={store.gitStatus}
          onCommit={() => void handleCommit(false)}
          onCommitAndPush={() => void handleCommit(true)}
          disabled={!store.activeRepoId}
        />

        {!store.authStatus?.isAuthenticated && (
          <div className="warning-banner" data-testid="auth-warning">
            Copilot auth required. Run `copilot` or `gh auth login` in terminal and sign in.
          </div>
        )}

        {store.error && <div className="error-banner" data-testid="error-banner">{store.error}</div>}

        {store.view === 'chat' && (
          <>
            <ConversationView entries={store.transcript.entries} />
            <Composer
              models={store.models}
              selectedModel={store.selectedModel}
              disabled={!store.activeThread || store.loading}
              onChangeModel={(modelId) => store.setSelectedModel(modelId)}
              onSend={(prompt, attachments) => store.sendMessage(prompt, attachments)}
              onAbort={() => store.abort()}
            />
          </>
        )}

        {store.view === 'skills' && (
          <SkillsView
            skills={store.skills}
            canCreateRepoSkill={Boolean(store.activeRepoId)}
            onCreate={(input) => store.createSkill(input)}
          />
        )}

        {store.view === 'automations' && <AutomationsPlaceholder />}

        {store.gitOutput && (
          <section className="git-output" data-testid="git-output">
            <h3>Git Output</h3>
            <pre data-testid="git-output-text">{store.gitOutput}</pre>
          </section>
        )}

        <footer className="status-strip" data-testid="status-strip">
          <div className="status-group">
            <span className="status-item">Local</span>
            <span className="status-item warn">Full access</span>
          </div>
          <div className="status-group">
            <span className="status-item">
              {store.gitStatus?.branch ? store.gitStatus.branch : 'no-branch'}
            </span>
            {store.gitStatus && (
              <>
                <span className="status-item muted">↑{store.gitStatus.ahead}</span>
                <span className="status-item muted">↓{store.gitStatus.behind}</span>
              </>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <AppInner />
    </AppStoreProvider>
  );
}
