import { describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '../../electron/ipc/channels';

const invoke = vi.fn();
const on = vi.fn();
const removeListener = vi.fn();
const exposeInMainWorld = vi.fn();

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld
  },
  ipcRenderer: {
    invoke,
    on,
    removeListener
  }
}));

describe('preload API', () => {
  it('routes calls through IPC channels', async () => {
    const module = await import('../../electron/preload');

    await module.copilotUiApi.copilot.listModels();
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.copilotListModels);

    await module.copilotUiApi.git.commit('repo-1', 'msg');
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.gitCommit, 'repo-1', 'msg');

    const unsub = module.copilotUiApi.copilot.onEvent(() => undefined);
    expect(on).toHaveBeenCalledWith(IPC_CHANNELS.copilotEvent, expect.any(Function));
    unsub();
    expect(removeListener).toHaveBeenCalledWith(IPC_CHANNELS.copilotEvent, expect.any(Function));

    expect(exposeInMainWorld).toHaveBeenCalledOnce();
  });
});
