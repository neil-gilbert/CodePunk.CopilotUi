import { useState } from 'react';
import type { SkillDto } from '@shared/types';

interface SkillsViewProps {
  skills: SkillDto[];
  canCreateRepoSkill: boolean;
  onCreate: (input: { scope: 'global' | 'repo'; name: string; content: string }) => Promise<void>;
}

export function SkillsView({ skills, canCreateRepoSkill, onCreate }: SkillsViewProps) {
  const [scope, setScope] = useState<'global' | 'repo'>('global');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  return (
    <section className="skills-view" data-testid="skills-view">
      <div className="skills-form" data-testid="skills-form">
        <h2>Skills</h2>
        <p>Create a new skill folder with a `SKILL.md` file.</p>

        <label>
          Scope
          <select data-testid="skill-scope-select" value={scope} onChange={(event) => setScope(event.target.value as 'global' | 'repo')}>
            <option value="global">Global (~/.copilot/skills)</option>
            <option value="repo" disabled={!canCreateRepoSkill}>
              Repo (.copilot/skills)
            </option>
          </select>
        </label>

        <label>
          Name
          <input data-testid="skill-name-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="skill-name" />
        </label>

        <label>
          SKILL.md content
          <textarea
            data-testid="skill-content-input"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Optional skill body"
            rows={8}
          />
        </label>

        <button
          className="primary"
          data-testid="skill-add-btn"
          onClick={() => {
            void onCreate({ scope, name, content });
            setName('');
            setContent('');
          }}
          disabled={!name.trim()}
        >
          Add Skill
        </button>
      </div>

      <div className="skills-list" data-testid="skills-list">
        {skills.length === 0 && <p>No skills found in selected scopes.</p>}
        {skills.map((skill) => (
          <article key={`${skill.scope}-${skill.skillPath}`} className="skill-card" data-testid="skill-card">
            <div className="skill-name">{skill.name}</div>
            <div className="skill-meta">
              <span>{skill.scope}</span>
              <span>{skill.hasSkillFile ? 'SKILL.md ready' : 'missing SKILL.md'}</span>
            </div>
            <code>{skill.skillPath}</code>
          </article>
        ))}
      </div>
    </section>
  );
}
