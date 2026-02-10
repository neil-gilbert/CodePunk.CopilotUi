export const IPC_CHANNELS = {
  copilotListModels: 'copilot:listModels',
  copilotAuthStatus: 'copilot:authStatus',
  copilotCreateThread: 'copilot:createThread',
  copilotResumeThread: 'copilot:resumeThread',
  copilotSendMessage: 'copilot:sendMessage',
  copilotAbort: 'copilot:abort',
  copilotListMessages: 'copilot:listMessages',
  copilotEvent: 'copilot:event',

  threadsListTree: 'threads:listTree',
  threadsCreateRepoAndThread: 'threads:createRepoAndThread',
  threadsCreateThreadInRepo: 'threads:createThreadInRepo',
  threadsGetThread: 'threads:getThread',
  threadsSelectFolder: 'threads:selectFolder',

  skillsList: 'skills:list',
  skillsCreate: 'skills:create',

  gitStatus: 'git:status',
  gitCommit: 'git:commit',
  gitCommitAndPush: 'git:commitAndPush'
} as const;
