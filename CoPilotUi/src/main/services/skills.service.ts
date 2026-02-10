import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import type { CreateSkillInput, SkillDto, SkillScope } from '@shared/types';
import { ThreadService } from './thread.service';

export class SkillsService {
  private readonly globalSkillsDir = join(homedir(), '.copilot', 'skills');

  constructor(private readonly threadService: ThreadService) {}

  list(repoId?: string): SkillDto[] {
    const skills: SkillDto[] = [];

    skills.push(...this.listInScope('global', this.globalSkillsDir));

    if (repoId) {
      const repo = this.threadService.getRepo(repoId);
      if (repo?.isAvailable) {
        const repoSkillsPath = this.getRepoSkillsDir(repo.rootPath);
        skills.push(...this.listInScope('repo', repoSkillsPath));
      }
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  create(input: CreateSkillInput): SkillDto {
    const targetDir = this.resolveScopeBasePath(input.scope, input.repoId);
    mkdirSync(targetDir, { recursive: true });

    const folderName = this.sanitizeSkillName(input.name);
    const skillFolder = join(targetDir, folderName);
    mkdirSync(skillFolder, { recursive: true });

    const skillFile = join(skillFolder, 'SKILL.md');
    const content = input.content.trim().length > 0 ? input.content.trim() : this.defaultSkillContent(input.name);
    writeFileSync(skillFile, `${content}\n`, 'utf8');

    return {
      name: folderName,
      scope: input.scope,
      basePath: targetDir,
      skillPath: skillFolder,
      hasSkillFile: true
    };
  }

  getSkillDirectories(repoRootPath?: string): string[] {
    const dirs = [this.globalSkillsDir];
    if (repoRootPath) {
      dirs.push(this.getRepoSkillsDir(repoRootPath));
    }

    return Array.from(new Set(dirs)).filter((path) => {
      try {
        return statSync(path).isDirectory();
      } catch {
        return false;
      }
    });
  }

  private resolveScopeBasePath(scope: SkillScope, repoId?: string): string {
    if (scope === 'global') {
      return this.globalSkillsDir;
    }

    if (!repoId) {
      throw new Error('repoId is required for repo scoped skill creation.');
    }

    const repo = this.threadService.getRepo(repoId);
    if (!repo || !repo.isAvailable) {
      throw new Error('Repo path is unavailable for repo scoped skill creation.');
    }

    return this.getRepoSkillsDir(repo.rootPath);
  }

  private getRepoSkillsDir(repoRootPath: string): string {
    return join(repoRootPath, '.copilot', 'skills');
  }

  private listInScope(scope: SkillScope, basePath: string): SkillDto[] {
    try {
      const entries = readdirSync(basePath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const skillPath = join(basePath, entry.name);
          let hasSkillFile = false;

          try {
            const skillText = readFileSync(join(skillPath, 'SKILL.md'), 'utf8');
            hasSkillFile = skillText.trim().length > 0;
          } catch {
            hasSkillFile = false;
          }

          return {
            name: entry.name,
            scope,
            basePath,
            skillPath,
            hasSkillFile
          };
        });
    } catch {
      return [];
    }
  }

  private sanitizeSkillName(name: string): string {
    const value = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    if (!value) {
      throw new Error('Skill name must contain letters or numbers.');
    }

    return value;
  }

  private defaultSkillContent(name: string): string {
    return `---\nname: ${name.trim()}\ndescription: Describe what this skill does.\n---\n\n# ${name.trim()}\n\nAdd guidance and workflows for this skill.`;
  }
}
