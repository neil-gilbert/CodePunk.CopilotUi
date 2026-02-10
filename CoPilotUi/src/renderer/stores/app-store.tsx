import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  AttachmentInput,
  CopilotAuthStatusDto,
  GitActionResult,
  GitStatusDto,
  ModelInfoDto,
  RepoGroupDto,
  SkillDto,
  ThreadDto
} from '@shared/types';
import { applySessionEventToTranscript, fromPersistedMessages, type TranscriptState } from './chat-reducer';

type ViewMode = 'chat' | 'skills' | 'automations';

interface AppStoreValue {
  tree: RepoGroupDto[];
  activeThread: ThreadDto | null;
  activeRepoId: string | null;
  view: ViewMode;
  models: ModelInfoDto[];
  selectedModel: string | null;
  transcript: TranscriptState;
  loading: boolean;
  skills: SkillDto[];
  authStatus: CopilotAuthStatusDto | null;
  gitStatus: GitStatusDto | null;
  gitOutput: string;
  error: string | null;
  refreshTree: () => Promise<void>;
  createNewThreadFromPicker: () => Promise<void>;
  createThreadInRepo: (repoId: string) => Promise<void>;
  selectThread: (threadId: string, repoId: string) => Promise<void>;
  setView: (view: ViewMode) => void;
  sendMessage: (prompt: string, attachments: AttachmentInput[]) => Promise<void>;
  abort: () => Promise<void>;
  setSelectedModel: (modelId: string) => void;
  refreshSkills: () => Promise<void>;
  createSkill: (input: { scope: 'global' | 'repo'; name: string; content: string }) => Promise<void>;
  commit: (message: string) => Promise<GitActionResult | null>;
  commitAndPush: (message: string) => Promise<GitActionResult | null>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [tree, setTree] = useState<RepoGroupDto[]>([]);
  const [activeThread, setActiveThread] = useState<ThreadDto | null>(null);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('chat');
  const [models, setModels] = useState<ModelInfoDto[]>([]);
  const [selectedModel, setSelectedModelState] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptState>({ entries: [] });
  const [loading, setLoading] = useState(false);
  const [skills, setSkills] = useState<SkillDto[]>([]);
  const [authStatus, setAuthStatus] = useState<CopilotAuthStatusDto | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatusDto | null>(null);
  const [gitOutput, setGitOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refreshTree = useCallback(async () => {
    const groups = await window.copilotUi.threads.listTree();
    setTree(groups);
  }, []);

  const loadModelsAndAuth = useCallback(async () => {
    setError(null);

    let modelList: ModelInfoDto[] = [];
    try {
      modelList = await window.copilotUi.copilot.listModels();
    } catch (error) {
      if (!isRecoverableCopilotError(error)) {
        setError(String(error));
      }
    }

    setModels(modelList);
    if (!selectedModel && modelList.length > 0) {
      setSelectedModelState(modelList[0].id);
    }

    try {
      const auth = await window.copilotUi.copilot.authStatus();
      setAuthStatus(auth);
    } catch (error) {
      setAuthStatus({
        isAuthenticated: false,
        statusMessage: 'Authentication unavailable'
      });

      if (!isRecoverableCopilotError(error)) {
        setError(String(error));
      }
    }
  }, [selectedModel]);

  const refreshSkills = useCallback(async () => {
    const next = await window.copilotUi.skills.list(activeRepoId ?? undefined);
    setSkills(next);
  }, [activeRepoId]);

  const refreshGitStatus = useCallback(async (repoId?: string | null) => {
    const targetRepoId = repoId ?? activeRepoId;
    if (!targetRepoId) {
      setGitStatus(null);
      return;
    }

    try {
      const nextStatus = await window.copilotUi.git.status(targetRepoId);
      setGitStatus(nextStatus);
    } catch {
      setGitStatus(null);
    }
  }, [activeRepoId]);

  const selectThread = useCallback(async (threadId: string, repoId: string) => {
    setLoading(true);
    setError(null);
    try {
      const thread = await window.copilotUi.threads.getThread(threadId);
      if (!thread) {
        throw new Error('Thread not found.');
      }
      setActiveThread(thread);
      setActiveRepoId(repoId);
      setView('chat');
      if (thread.model) {
        setSelectedModelState(thread.model);
      }

      await window.copilotUi.copilot.resumeThread(thread.id);
      const messages = await window.copilotUi.copilot.listMessages(thread.id);
      setTranscript(fromPersistedMessages(messages));
      await refreshSkills();
      await refreshGitStatus(repoId);
    } catch (threadError) {
      setError(String(threadError));
    } finally {
      setLoading(false);
    }
  }, [refreshGitStatus, refreshSkills]);

  const createNewThreadFromPicker = useCallback(async () => {
    setError(null);
    const folder = await window.copilotUi.threads.selectFolder();
    if (!folder) {
      return;
    }

    setLoading(true);
    try {
      const result = await window.copilotUi.threads.createRepoAndThread(folder, selectedModel ?? undefined);
      await refreshTree();
      await selectThread(result.thread.id, result.repo.id);
    } catch (createError) {
      setError(String(createError));
    } finally {
      setLoading(false);
    }
  }, [refreshTree, selectThread, selectedModel]);

  const createThreadInRepo = useCallback(async (repoId: string) => {
    setLoading(true);
    setError(null);
    try {
      const thread = await window.copilotUi.threads.createThreadInRepo(repoId, selectedModel ?? undefined);
      await refreshTree();
      await selectThread(thread.id, repoId);
    } catch (createError) {
      setError(String(createError));
    } finally {
      setLoading(false);
    }
  }, [refreshTree, selectThread, selectedModel]);

  const sendMessage = useCallback(async (prompt: string, attachments: AttachmentInput[]) => {
    if (!activeThread) {
      return;
    }

    setError(null);
    await window.copilotUi.copilot.sendMessage({
      threadId: activeThread.id,
      prompt,
      attachments,
      model: selectedModel ?? undefined
    });
  }, [activeThread, selectedModel]);

  const abort = useCallback(async () => {
    if (!activeThread) {
      return;
    }
    await window.copilotUi.copilot.abort(activeThread.id);
  }, [activeThread]);

  const createSkill = useCallback(async (input: { scope: 'global' | 'repo'; name: string; content: string }) => {
    setError(null);
    await window.copilotUi.skills.create({
      scope: input.scope,
      repoId: input.scope === 'repo' ? activeRepoId ?? undefined : undefined,
      name: input.name,
      content: input.content
    });
    await refreshSkills();
  }, [activeRepoId, refreshSkills]);

  const commit = useCallback(async (message: string): Promise<GitActionResult | null> => {
    if (!activeRepoId) {
      return null;
    }

    const result = await window.copilotUi.git.commit(activeRepoId, message);
    setGitOutput(result.success ? result.output : result.error ?? result.output);
    await refreshGitStatus(activeRepoId);
    return result;
  }, [activeRepoId, refreshGitStatus]);

  const commitAndPush = useCallback(async (message: string): Promise<GitActionResult | null> => {
    if (!activeRepoId) {
      return null;
    }

    const result = await window.copilotUi.git.commitAndPush(activeRepoId, message);
    setGitOutput(result.success ? result.output : result.error ?? result.output);
    await refreshGitStatus(activeRepoId);
    return result;
  }, [activeRepoId, refreshGitStatus]);

  useEffect(() => {
    refreshTree();
    loadModelsAndAuth();
  }, [refreshTree, loadModelsAndAuth]);

  useEffect(() => {
    void refreshGitStatus(activeRepoId);
  }, [activeRepoId, refreshGitStatus]);

  useEffect(() => {
    const unsubscribe = window.copilotUi.copilot.onEvent((event) => {
      if (!activeThread || event.threadId !== activeThread.id) {
        return;
      }

      setTranscript((prev) => applySessionEventToTranscript(prev, event));
    });

    return unsubscribe;
  }, [activeThread]);

  const value = useMemo<AppStoreValue>(
    () => ({
      tree,
      activeThread,
      activeRepoId,
      view,
      models,
      selectedModel,
      transcript,
      loading,
      skills,
      authStatus,
      gitStatus,
      gitOutput,
      error,
      refreshTree,
      createNewThreadFromPicker,
      createThreadInRepo,
      selectThread,
      setView,
      sendMessage,
      abort,
      setSelectedModel: setSelectedModelState,
      refreshSkills,
      createSkill,
      commit,
      commitAndPush
    }),
    [
      tree,
      activeThread,
      activeRepoId,
      view,
      models,
      selectedModel,
      transcript,
      loading,
      skills,
      authStatus,
      gitStatus,
      gitOutput,
      error,
      refreshTree,
      createNewThreadFromPicker,
      createThreadInRepo,
      selectThread,
      sendMessage,
      abort,
      refreshSkills,
      createSkill,
      commit,
      commitAndPush
    ]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

function isRecoverableCopilotError(error: unknown): boolean {
  const text = String(error ?? '').toLowerCase();
  return (
    text.includes('err_stream_destroyed') ||
    text.includes('stream was destroyed') ||
    text.includes('cannot call write after a stream was destroyed') ||
    text.includes('auth required') ||
    text.includes('not authenticated')
  );
}

export function useAppStore(): AppStoreValue {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error('useAppStore must be used within AppStoreProvider');
  }

  return context;
}
