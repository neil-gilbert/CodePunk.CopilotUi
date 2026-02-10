import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc/channels';
import type { CopilotUiApi, CreateSkillInput, CreateThreadInput, SendMessageInput, SessionEventDto } from '@shared/types';

export const copilotUiApi: CopilotUiApi = {
  copilot: {
    listModels: () => ipcRenderer.invoke(IPC_CHANNELS.copilotListModels),
    authStatus: () => ipcRenderer.invoke(IPC_CHANNELS.copilotAuthStatus),
    createThread: (input: CreateThreadInput) => ipcRenderer.invoke(IPC_CHANNELS.copilotCreateThread, input),
    resumeThread: (threadId: string) => ipcRenderer.invoke(IPC_CHANNELS.copilotResumeThread, threadId),
    sendMessage: (input: SendMessageInput) => ipcRenderer.invoke(IPC_CHANNELS.copilotSendMessage, input),
    abort: (threadId: string) => ipcRenderer.invoke(IPC_CHANNELS.copilotAbort, threadId),
    listMessages: (threadId: string) => ipcRenderer.invoke(IPC_CHANNELS.copilotListMessages, threadId),
    onEvent: (handler: (event: SessionEventDto) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: SessionEventDto) => handler(payload);
      ipcRenderer.on(IPC_CHANNELS.copilotEvent, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.copilotEvent, listener);
    }
  },
  threads: {
    listTree: () => ipcRenderer.invoke(IPC_CHANNELS.threadsListTree),
    createRepoAndThread: (folderPath: string, model?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.threadsCreateRepoAndThread, folderPath, model),
    createThreadInRepo: (repoId: string, model?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.threadsCreateThreadInRepo, repoId, model),
    getThread: (threadId: string) => ipcRenderer.invoke(IPC_CHANNELS.threadsGetThread, threadId),
    selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.threadsSelectFolder)
  },
  skills: {
    list: (repoId?: string) => ipcRenderer.invoke(IPC_CHANNELS.skillsList, repoId),
    create: (input: CreateSkillInput) => ipcRenderer.invoke(IPC_CHANNELS.skillsCreate, input)
  },
  git: {
    status: (repoId: string) => ipcRenderer.invoke(IPC_CHANNELS.gitStatus, repoId),
    commit: (repoId: string, message: string) => ipcRenderer.invoke(IPC_CHANNELS.gitCommit, repoId, message),
    commitAndPush: (repoId: string, message: string) => ipcRenderer.invoke(IPC_CHANNELS.gitCommitAndPush, repoId, message)
  }
};

contextBridge.exposeInMainWorld('copilotUi', copilotUiApi);
