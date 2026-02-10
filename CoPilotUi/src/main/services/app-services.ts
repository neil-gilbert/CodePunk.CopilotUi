import { app } from 'electron';
import { join } from 'node:path';
import { DbService } from './db.service';
import { MemoryDbService } from './memory-db.service';
import { ThreadService } from './thread.service';
import { SkillsService } from './skills.service';
import { GitService } from './git.service';
import { CopilotService } from './copilot.service';
import type { SessionEventDto } from '@shared/types';
import type { DbStore } from './db.service';

export interface AppServices {
  db: DbStore;
  threadService: ThreadService;
  skillsService: SkillsService;
  gitService: GitService;
  copilotService: CopilotService;
}

export function createAppServices(onCopilotEvent: (event: SessionEventDto) => void): AppServices {
  const userDataPath = app.getPath('userData');
  const dbPath = join(userDataPath, 'copilot-ui.db');

  let db: DbStore;
  try {
    db = new DbService(dbPath);
  } catch (error) {
    console.error('[CopilotUi] SQLite initialization failed; falling back to in-memory storage.', error);
    db = new MemoryDbService();
  }
  const threadService = new ThreadService(db);
  const skillsService = new SkillsService(threadService);
  const gitService = new GitService(threadService);
  const copilotService = new CopilotService(threadService, skillsService, onCopilotEvent);

  return {
    db,
    threadService,
    skillsService,
    gitService,
    copilotService
  };
}
