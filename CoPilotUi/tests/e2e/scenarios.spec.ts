import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { expect, test } from '@playwright/test';

let tempRoot: string;
let folderPath: string;

const models = [
  { id: 'gpt-5', name: 'GPT-5', supportsVision: true, supportsReasoningEffort: true },
  { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', supportsVision: true, supportsReasoningEffort: false }
];

test.beforeEach(async ({ page }) => {
  tempRoot = mkdtempSync(join(tmpdir(), 'copilot-ui-e2e-browser-'));
  folderPath = join(tempRoot, 'repo-under-test');

  await page.addInitScript(
    ({ repoFolder, availableModels }) => {
      type Repo = {
        id: string;
        name: string;
        rootPath: string;
        isAvailable: boolean;
        createdAt: string;
        updatedAt: string;
      };

      type Thread = {
        id: string;
        repoId: string;
        title: string;
        copilotSessionId: string | null;
        model: string | null;
        createdAt: string;
        updatedAt: string;
        archivedAt: string | null;
      };

      const state: {
        repos: Repo[];
        threads: Thread[];
        messages: Record<string, Array<any>>;
        listeners: Array<(event: any) => void>;
        skills: Array<{ name: string; scope: 'global' | 'repo'; basePath: string; skillPath: string; hasSkillFile: boolean }>;
      } = {
        repos: [],
        threads: [],
        messages: {},
        listeners: [],
        skills: []
      };

      function emit(event: any) {
        state.listeners.forEach((listener) => listener(event));
      }

      function nowIso() {
        return new Date().toISOString();
      }

      function id(prefix: string) {
        return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
      }

      function getThread(threadId: string) {
        return state.threads.find((thread) => thread.id === threadId) ?? null;
      }

      function modelForThread(thread: Thread, preferred?: string) {
        return preferred ?? thread.model ?? availableModels[0].id;
      }

      (window as any).copilotUi = {
        copilot: {
          listModels: async () => availableModels,
          authStatus: async () => ({
            isAuthenticated: true,
            statusMessage: 'Authenticated (mock)',
            login: 'mock-user',
            host: 'github.com',
            authType: 'user'
          }),
          createThread: async ({ repoId, title, model }: { repoId: string; title?: string; model?: string }) => {
            const thread: Thread = {
              id: id('thread'),
              repoId,
              title: title ?? 'New conversation',
              copilotSessionId: id('session'),
              model: model ?? availableModels[0].id,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              archivedAt: null
            };
            state.threads.unshift(thread);
            state.messages[thread.id] = [];
            return thread;
          },
          resumeThread: async (_threadId: string) => undefined,
          sendMessage: async ({ threadId, prompt, model }: { threadId: string; prompt: string; model?: string }) => {
            const thread = getThread(threadId);
            if (!thread) {
              throw new Error('Thread not found');
            }

            const chosenModel = modelForThread(thread, model);
            thread.model = chosenModel;

            const userEvent = {
              threadId,
              type: 'user.message',
              timestamp: nowIso(),
              id: id('evt'),
              parentId: null,
              data: { content: prompt, attachments: [] }
            };
            state.messages[threadId].push({
              id: userEvent.id,
              threadId,
              role: 'user',
              content: prompt,
              eventType: 'user.message',
              createdAt: userEvent.timestamp,
              metadataJson: JSON.stringify(userEvent.data)
            });
            emit(userEvent);

            const assistantMessage = `Mock response from ${chosenModel}: ${prompt}`;
            const mid = id('msg');
            emit({
              threadId,
              type: 'assistant.message_delta',
              timestamp: nowIso(),
              id: id('evt'),
              parentId: userEvent.id,
              data: {
                messageId: mid,
                deltaContent: assistantMessage.slice(0, Math.ceil(assistantMessage.length / 2))
              }
            });
            emit({
              threadId,
              type: 'assistant.message_delta',
              timestamp: nowIso(),
              id: id('evt'),
              parentId: userEvent.id,
              data: {
                messageId: mid,
                deltaContent: assistantMessage.slice(Math.ceil(assistantMessage.length / 2))
              }
            });

            const assistantEvent = {
              threadId,
              type: 'assistant.message',
              timestamp: nowIso(),
              id: id('evt'),
              parentId: userEvent.id,
              data: {
                messageId: mid,
                content: assistantMessage,
                toolRequests: []
              }
            };
            state.messages[threadId].push({
              id: assistantEvent.id,
              threadId,
              role: 'assistant',
              content: assistantMessage,
              eventType: 'assistant.message',
              createdAt: assistantEvent.timestamp,
              metadataJson: JSON.stringify(assistantEvent.data)
            });
            emit(assistantEvent);
            emit({ threadId, type: 'session.idle', timestamp: nowIso(), id: id('evt'), parentId: userEvent.id, data: {} });
          },
          abort: async (_threadId: string) => undefined,
          listMessages: async (threadId: string) => state.messages[threadId] ?? [],
          onEvent: (handler: (event: any) => void) => {
            state.listeners.push(handler);
            return () => {
              const index = state.listeners.indexOf(handler);
              if (index >= 0) {
                state.listeners.splice(index, 1);
              }
            };
          }
        },
        threads: {
          listTree: async () =>
            state.repos.map((repo) => ({
              repo,
              threads: state.threads.filter((thread) => thread.repoId === repo.id)
            })),
          createRepoAndThread: async (rootPath: string, model?: string) => {
            let repo = state.repos.find((entry) => entry.rootPath === rootPath);
            if (!repo) {
              repo = {
                id: id('repo'),
                name: rootPath.split('/').filter(Boolean).pop() ?? 'repo',
                rootPath,
                isAvailable: true,
                createdAt: nowIso(),
                updatedAt: nowIso()
              };
              state.repos.unshift(repo);
            }

            const thread: Thread = {
              id: id('thread'),
              repoId: repo.id,
              title: 'New conversation',
              copilotSessionId: id('session'),
              model: model ?? availableModels[0].id,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              archivedAt: null
            };
            state.threads.unshift(thread);
            state.messages[thread.id] = [];

            return { repo, thread };
          },
          createThreadInRepo: async (repoId: string, model?: string) => {
            const thread: Thread = {
              id: id('thread'),
              repoId,
              title: 'New conversation',
              copilotSessionId: id('session'),
              model: model ?? availableModels[0].id,
              createdAt: nowIso(),
              updatedAt: nowIso(),
              archivedAt: null
            };
            state.threads.unshift(thread);
            state.messages[thread.id] = [];
            return thread;
          },
          getThread: async (threadId: string) => getThread(threadId),
          selectFolder: async () => repoFolder
        },
        skills: {
          list: async (repoId?: string) =>
            state.skills.filter((skill) => (repoId ? skill.scope === 'repo' || skill.scope === 'global' : skill.scope === 'global')),
          create: async ({ scope, name }: { scope: 'global' | 'repo'; name: string }) => {
            const normalized = name.trim().toLowerCase();
            const skill = {
              name: normalized,
              scope,
              basePath: scope === 'global' ? '/mock/global' : '/mock/repo',
              skillPath: scope === 'global' ? `/mock/global/${normalized}` : `/mock/repo/${normalized}`,
              hasSkillFile: true
            };
            state.skills.push(skill);
            return skill;
          }
        },
        git: {
          status: async (_repoId: string) => ({
            branch: 'main',
            upstream: 'origin/main',
            ahead: 0,
            behind: 0,
            changedFiles: 1,
            isRepo: true,
            output: '## main...origin/main'
          }),
          commit: async (_repoId: string, message: string) => ({ success: true, output: `[main] ${message}` }),
          commitAndPush: async (_repoId: string, message: string) => {
            if (message.toLowerCase().includes('failure')) {
              return {
                success: false,
                output: `[main] ${message}`,
                error: 'fatal: no configured push destination'
              };
            }

            return { success: true, output: `[main] ${message}\nPushed` };
          }
        }
      };
    },
    { repoFolder: folderPath, availableModels: models }
  );

  await page.goto('/');
  await expect(page.getByTestId('app-shell')).toBeVisible();
});

test.afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

test('create repo-backed thread from folder picker', async ({ page }) => {
  await page.getByTestId('menu-new-thread').click();

  await expect(page.getByTestId('repo-name')).toContainText(basename(folderPath));
  await expect(page.locator('[data-testid^="thread-item-"]').first()).toBeVisible();
  await expect(page.getByTestId('thread-title')).toContainText('New conversation');
});

test('send prompt and observe streaming response', async ({ page }) => {
  await page.getByTestId('menu-new-thread').click();

  await page.getByTestId('prompt-input').fill('Summarize this repository');
  await page.getByTestId('send-btn').click();

  await expect(page.getByTestId('bubble-user').last()).toContainText('Summarize this repository');
  await expect(page.getByTestId('bubble-assistant').last()).toContainText('Mock response from');
});

test('add file attachment and verify it is shown in composer', async ({ page }) => {
  await page.getByTestId('menu-new-thread').click();

  await page.getByTestId('attach-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('attachment body\n', 'utf8')
  });

  await expect(page.getByTestId('attachment-pill')).toContainText('notes.txt');
});

test('switch model and verify subsequent turn uses selected model', async ({ page }) => {
  await page.getByTestId('menu-new-thread').click();

  await page.getByTestId('model-select').selectOption('claude-sonnet-4.5');
  await page.getByTestId('prompt-input').fill('Which model are you using?');
  await page.getByTestId('send-btn').click();

  await expect(page.getByTestId('bubble-assistant').last()).toContainText('claude-sonnet-4.5');
});

test('create global and repo skills and verify listing', async ({ page }) => {
  await page.getByTestId('menu-new-thread').click();
  await page.getByTestId('menu-skills').click();

  await page.getByTestId('skill-scope-select').selectOption('repo');
  await page.getByTestId('skill-name-input').fill('repo-skill-e2e');
  await page.getByTestId('skill-add-btn').click();

  await page.getByTestId('skill-scope-select').selectOption('global');
  await page.getByTestId('skill-name-input').fill('global-skill-e2e');
  await page.getByTestId('skill-add-btn').click();

  await expect(page.getByTestId('skills-list')).toContainText('repo-skill-e2e');
  await expect(page.getByTestId('skills-list')).toContainText('global-skill-e2e');
});

test('commit and commit & push flows show success and failure output', async ({ page }) => {
  await page.getByTestId('menu-new-thread').click();

  page.once('dialog', (dialog) => dialog.accept('feat: e2e commit'));
  await page.getByTestId('commit-btn').click();
  await expect(page.getByTestId('git-output-text')).toContainText('feat: e2e commit');

  page.once('dialog', (dialog) => dialog.accept('feat: e2e push success'));
  await page.getByTestId('commit-push-btn').click();
  await expect(page.getByTestId('git-output-text')).toContainText('feat: e2e push success');

  page.once('dialog', (dialog) => dialog.accept('feat: e2e push failure'));
  await page.getByTestId('commit-push-btn').click();

  await expect(page.getByTestId('git-output-text')).toContainText('fatal: no configured push destination');
});
