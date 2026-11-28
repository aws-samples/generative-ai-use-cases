import yaml from 'js-yaml';
import { AgentSkillContent } from 'generative-ai-use-cases';

/** The file name Agent Skills give a skill (inside a folder named after it) */
export const SKILL_FILE_NAME = 'SKILL.md';

export class SkillFileError extends Error {}

/**
 * A skill as SKILL.md, the Agent Skills format that Claude Code, Kiro,
 * AgentCore Harness and Skills over MCP read: YAML frontmatter with the name
 * and the description, then the instructions.
 */
export const toSkillFile = ({
  name,
  description,
  instructions,
}: AgentSkillContent): string =>
  `---\n${yaml.dump({ name, description }, { lineWidth: -1 })}---\n\n${instructions.trim()}\n`;

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/;

/**
 * Read a SKILL.md. Other frontmatter fields (license, allowed-tools,
 * metadata) are not kept: a GenU skill has no place for them, and
 * allowed-tools from a file would widen what the agent may do.
 *
 * The name and the lengths are left to the form, which shows what to fix.
 */
export const fromSkillFile = (text: string): AgentSkillContent => {
  const match = text.replace(/^\uFEFF/, '').match(FRONTMATTER);
  if (!match) throw new SkillFileError('The file has no frontmatter');
  let front: unknown;
  try {
    front = yaml.load(match[1]);
  } catch {
    throw new SkillFileError('The frontmatter is not valid YAML');
  }
  const { name, description } = (front ?? {}) as Record<string, unknown>;
  if (typeof name !== 'string' || typeof description !== 'string') {
    throw new SkillFileError('The frontmatter needs a name and a description');
  }
  return {
    name: name.trim(),
    description: description.trim(),
    instructions: match[2].trim(),
  };
};

/** Save the skill as SKILL.md through the browser */
export const downloadSkillFile = (skill: AgentSkillContent): void => {
  const url = URL.createObjectURL(
    new Blob([toSkillFile(skill)], { type: 'text/markdown' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = SKILL_FILE_NAME;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
