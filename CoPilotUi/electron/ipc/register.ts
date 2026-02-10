import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './channels';
import type { AppServices } from '@main/services/app-services';
import type { CreateSkillInput, CreateThreadInput, SendMessageInput } from '@shared/types';

export function registerIpcHandlers(services: AppServices, windowRef: () => BrowserWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.copilotListModels, async () => services.copilotService.listModels());
  ipcMain.handle(IPC_CHANNELS.copilotAuthStatus, async () => services.copilotService.authStatus());
  ipcMain.handle(IPC_CHANNELS.copilotCreateThread, async (_event, input: CreateThreadInput) =>
    services.copilotService.createThread(input)
  );
  ipcMain.handle(IPC_CHANNELS.copilotResumeThread, async (_event, threadId: string) =>
    services.copilotService.resumeThread(threadId)
  );
  ipcMain.handle(IPC_CHANNELS.copilotSendMessage, async (_event, input: SendMessageInput) =>
    services.copilotService.sendMessage(input)
  );
  ipcMain.handle(IPC_CHANNELS.copilotAbort, async (_event, threadId: string) => services.copilotService.abort(threadId));
  ipcMain.handle(IPC_CHANNELS.copilotListMessages, async (_event, threadId: string) =>
    services.copilotService.listMessages(threadId)
  );

  ipcMain.handle(IPC_CHANNELS.threadsListTree, async () => services.threadService.listTree());
  ipcMain.handle(IPC_CHANNELS.threadsCreateRepoAndThread, async (_event, folderPath: string, model?: string) =>
    services.threadService.createRepoAndThread(folderPath, model)
  );
  ipcMain.handle(IPC_CHANNELS.threadsCreateThreadInRepo, async (_event, repoId: string, model?: string) =>
    services.threadService.createThreadInRepo(repoId, model)
  );
  ipcMain.handle(IPC_CHANNELS.threadsGetThread, async (_event, threadId: string) => services.threadService.getThread(threadId));
  ipcMain.handle(IPC_CHANNELS.threadsSelectFolder, async () => {
    const e2eFolder = process.env.COPILOT_UI_E2E_FOLDER;
    if (e2eFolder && e2eFolder.trim().length > 0) {
      return e2eFolder;
    }

    const win = windowRef();
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Select repository folder',
          properties: ['openDirectory', 'createDirectory']
        })
      : await dialog.showOpenDialog({
          title: 'Select repository folder',
          properties: ['openDirectory', 'createDirectory']
        });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0] ?? null;
  });

  ipcMain.handle(IPC_CHANNELS.skillsList, async (_event, repoId?: string) => services.skillsService.list(repoId));
  ipcMain.handle(IPC_CHANNELS.skillsCreate, async (_event, input: CreateSkillInput) => services.skillsService.create(input));

  ipcMain.handle(IPC_CHANNELS.gitStatus, async (_event, repoId: string) => services.gitService.status(repoId));
  ipcMain.handle(IPC_CHANNELS.gitCommit, async (_event, repoId: string, message: string) =>
    services.gitService.commit(repoId, message)
  );
  ipcMain.handle(IPC_CHANNELS.gitCommitAndPush, async (_event, repoId: string, message: string) =>
    services.gitService.commitAndPush(repoId, message)
  );
}
