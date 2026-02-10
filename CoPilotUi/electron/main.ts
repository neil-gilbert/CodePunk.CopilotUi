import { app, BrowserWindow, dialog, shell } from 'electron';
import { join } from 'node:path';
import { createAppServices } from '@main/services/app-services';
import { registerIpcHandlers } from './ipc/register';
import { IPC_CHANNELS } from './ipc/channels';
import type { SessionEventDto } from '@shared/types';

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0a0f14',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[CopilotUi] Renderer failed to load', { errorCode, errorDescription, validatedURL });
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[CopilotUi] Renderer process exited', details);
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    win.loadURL(rendererUrl);
  } else {
    win.loadFile(join(app.getAppPath(), 'dist', 'index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  const services = createAppServices((event: SessionEventDto) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.copilotEvent, event);
    }
  });

  registerIpcHandlers(services, () => mainWindow);
  mainWindow = createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

process.on('unhandledRejection', (reason) => {
  const text = String(reason ?? '');
  const lower = text.toLowerCase();
  const isRecoverableCopilotRuntimeError =
    lower.includes('err_stream_destroyed') ||
    lower.includes('stream was destroyed') ||
    lower.includes('cannot call write after a stream was destroyed') ||
    lower.includes('error invoking remote method');

  if (isRecoverableCopilotRuntimeError) {
    console.warn('[CopilotUi] Recoverable runtime rejection', reason);
    return;
  }

  console.error('[CopilotUi] Unhandled promise rejection', reason);
  dialog.showErrorBox(
    'Copilot UI Startup Error',
    `The app hit an unrecoverable error.\n\n${String(reason)}\n\nIf this mentions better-sqlite3, run npm run dev (which auto-rebuilds native deps) before packaging.`
  );
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
