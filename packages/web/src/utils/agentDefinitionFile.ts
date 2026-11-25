import { AgentContent, AgentSkillContent } from 'generative-ai-use-cases';
import {
  AGENT_SKILL_DESCRIPTION_MAX_LENGTH,
  AGENT_SKILL_INSTRUCTIONS_MAX_LENGTH,
  isValidAgentSkillName,
} from '@generative-ai-use-cases/common';

/**
 * An agent definition as a file, so one can be handed to someone else.
 *
 * Only the fields that describe the agent travel. Ownership, id, favourites
 * and timestamps belong to the copy they were read from, and carrying them
 * would either be meaningless in another installation or would claim
 * something about the person importing it.
 */
export type PortableAgent = {
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  mcpServers: string[];
  codeExecutionEnabled: boolean;
  webSearchEnabled: boolean;
  // The skills travel with their content, since skill ids mean nothing to
  // whoever imports the file. Absent in files of agents without skills and in
  // files written before skills existed.
  skills?: AgentSkillContent[];
};

export const toPortableAgent = (
  agent: Partial<AgentContent>,
  skills: AgentSkillContent[] = []
): PortableAgent => ({
  name: agent.name ?? '',
  description: agent.description ?? '',
  systemPrompt: agent.systemPrompt ?? '',
  modelId: agent.modelId ?? '',
  mcpServers: agent.mcpServers ?? [],
  codeExecutionEnabled: !!agent.codeExecutionEnabled,
  webSearchEnabled: !!agent.webSearchEnabled,
  ...(skills.length > 0 && {
    skills: skills.map(({ name, description, instructions }) => ({
      name,
      description,
      instructions,
    })),
  }),
});

// A skill from a file, if it is one this deployment would accept
const toSkill = (value: unknown): AgentSkillContent | null => {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const { name, description, instructions } = raw;
  if (
    typeof name !== 'string' ||
    typeof description !== 'string' ||
    typeof instructions !== 'string' ||
    !isValidAgentSkillName(name)
  ) {
    return null;
  }
  const d = description.trim();
  const i = instructions.trim();
  if (
    !d ||
    !i ||
    d.length > AGENT_SKILL_DESCRIPTION_MAX_LENGTH ||
    i.length > AGENT_SKILL_INSTRUCTIONS_MAX_LENGTH
  ) {
    return null;
  }
  return { name, description: d, instructions: i };
};

const readSkills = (value: unknown): AgentSkillContent[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const skills: AgentSkillContent[] = [];
  for (const item of value) {
    const skill = toSkill(item);
    // A name is how the agent calls a skill, so the first one wins
    if (skill && !skills.some((s) => s.name === skill.name)) {
      skills.push(skill);
    }
  }
  return skills;
};

/**
 * Reads a definition from a file someone was given.
 *
 * The file comes from outside, so every field is checked rather than trusted:
 * a name that is not a string, or servers that are not a list, would other-
 * wise reach the form and fail somewhere further away from the cause.
 */
export const fromPortableAgent = (parsed: unknown): PortableAgent => {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('not an agent definition');
  }
  const raw = parsed as Record<string, unknown>;
  const text = (key: string): string =>
    typeof raw[key] === 'string' ? (raw[key] as string) : '';

  // A definition with no prompt describes no agent, whatever else it holds.
  if (!text('systemPrompt') && !text('name')) {
    throw new Error('not an agent definition');
  }

  return {
    name: text('name'),
    description: text('description'),
    systemPrompt: text('systemPrompt'),
    modelId: text('modelId'),
    mcpServers: Array.isArray(raw.mcpServers)
      ? raw.mcpServers.filter((s): s is string => typeof s === 'string')
      : [],
    codeExecutionEnabled: raw.codeExecutionEnabled === true,
    // Files written before web search existed have no such field: off.
    webSearchEnabled: raw.webSearchEnabled === true,
    ...(Array.isArray(raw.skills) && { skills: readSkills(raw.skills) }),
  };
};

/** What the form is filled with after an import. */
export type ImportedAgentForm = PortableAgent & {
  isPublic: boolean;
  tags: string[];
  skillIds: string[];
};

/**
 * Turns a definition read from a file into what the form should hold.
 *
 * The file only describes the agent, so the sharing settings (isPublic, tags)
 * are kept from the form the user is importing into. Otherwise importing over
 * a shared agent and saving would quietly stop sharing it. The skills are
 * kept too; skills in the file are added as the user's own skills by
 * planSkillImport and the caller, which then replaces them.
 *
 * The file may come from another deployment whose models this one does not
 * offer. Such a model is replaced with the first available one and reported
 * back, rather than saved as an id that only fails when the agent runs.
 */
export const applyImportedAgent = ({
  portable,
  current,
  availableModels,
}: {
  portable: PortableAgent;
  current?: { isPublic?: boolean; tags?: string[]; skillIds?: string[] } | null;
  availableModels: string[];
}): { form: ImportedAgentForm; unavailableModelId: string | null } => {
  const modelAvailable = availableModels.includes(portable.modelId);
  return {
    form: {
      ...portable,
      modelId: modelAvailable ? portable.modelId : (availableModels[0] ?? ''),
      isPublic: current?.isPublic ?? false,
      tags: current?.tags ?? [],
      skillIds: current?.skillIds ?? [],
    },
    // An empty id means the file named no model; falling back is not news.
    unavailableModelId:
      !modelAvailable && portable.modelId ? portable.modelId : null,
  };
};

export type SkillImportStep =
  | { kind: 'reuse'; skillId: string; name: string }
  | { kind: 'create'; skill: AgentSkillContent };

const sameContent = (a: AgentSkillContent, b: AgentSkillContent) =>
  a.description.trim() === b.description.trim() &&
  a.instructions.trim() === b.instructions.trim();

/**
 * Whether a skill of the user may hold an imported skill: the same name, or
 * a copy made by an earlier import (`name-2`, `name-3`, ...).
 */
export const isImportCandidate = (myName: string, fileName: string) => {
  const base = /^(.+)-\d+$/.exec(myName)?.[1];
  return (
    myName === fileName ||
    base === fileName ||
    // A long name was cut short to make room for the number
    (!!base && myName.length >= 60 && fileName.startsWith(base))
  );
};

/**
 * How to turn the skills of an imported file into the user's skills, in the
 * order of the file.
 *
 * A skill of the user with the same content, under the same name or a copy
 * made by an earlier import, is reused, so importing a file again adds
 * nothing. A skill is never overwritten: if the name is taken by other
 * content, the imported one is created under a free name (`name-2`, ...).
 * `contents` holds the content of the user's candidate skills.
 */
export const planSkillImport = (
  fileSkills: AgentSkillContent[],
  mySkills: { skillId: string; name: string }[],
  contents: AgentSkillContent[]
): SkillImportStep[] => {
  const taken = new Set(mySkills.map((s) => s.name));
  const uniqueName = (name: string): string => {
    for (let n = 2; ; n++) {
      const suffix = `-${n}`;
      const base = name.slice(0, 64 - suffix.length).replace(/-+$/, '');
      const candidate = `${base}${suffix}`;
      if (!taken.has(candidate)) return candidate;
    }
  };

  return fileSkills.map((skill): SkillImportStep => {
    const same = mySkills.find((mine) => {
      const content = contents.find((c) => c.name === mine.name);
      return (
        isImportCandidate(mine.name, skill.name) &&
        !!content &&
        sameContent(content, skill)
      );
    });
    if (same) return { kind: 'reuse', skillId: same.skillId, name: same.name };
    const name = taken.has(skill.name) ? uniqueName(skill.name) : skill.name;
    taken.add(name);
    return { kind: 'create', skill: { ...skill, name } };
  });
};

/** A filename that survives being written to disk. */
export const agentFileName = (name: string): string => {
  const safe = name.replace(/[\\/:*?"<>|]/g, '').trim();
  return `${safe || 'agent'}.json`;
};
