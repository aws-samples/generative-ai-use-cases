import {
  AgentSkill,
  AgentSkillContent,
  AgentSkillInTable,
  AgentSkillSummary,
  GetAgentSkillResponse,
  ListAgentSkillsResponse,
  ListSkillsOfAgentResponse,
} from 'generative-ai-use-cases';
import { AGENT_SKILL_DESCRIPTIONS_TOTAL_MAX_LENGTH } from '@generative-ai-use-cases/common';
import * as skillRepository from '../repositories/skill-repository';
import * as agentRepository from '../repositories/agent-repository';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../utils/error-handling';

const toSkill = (skill: AgentSkillInTable): AgentSkill => ({
  skillId: skill.skillId,
  name: skill.name,
  description: skill.description,
  instructions: skill.instructions,
  createdAt: skill.createdAt,
  updatedAt: skill.updatedAt,
});

const totalLimitMessage = `The descriptions of the skills of an agent must be ${AGENT_SKILL_DESCRIPTIONS_TOTAL_MAX_LENGTH.toLocaleString('en-US')} characters or less in total`;

// The agent activates a skill by its name, so a user's skills have
// different names.
const assertNameIsFree = (
  skills: AgentSkillSummary[],
  name: string,
  skillId?: string
) => {
  if (skills.some((s) => s.name === name && s.skillId !== skillId)) {
    throw new ConflictError(`A skill named "${name}" already exists`);
  }
};

export async function createSkill(
  userId: string,
  content: AgentSkillContent
): Promise<AgentSkill> {
  assertNameIsFree(await skillRepository.listSkills(userId), content.name);
  const skill = await skillRepository.createSkill(userId, content);
  return toSkill(skill);
}

export async function listSkills(
  userId: string
): Promise<ListAgentSkillsResponse> {
  return { skills: await skillRepository.listSkills(userId) };
}

export async function getSkill(
  userId: string,
  skillId: string
): Promise<GetAgentSkillResponse> {
  const [skill, agents] = await Promise.all([
    skillRepository.getSkill(userId, skillId),
    agentRepository.listAgentSkillIds(userId),
  ]);
  if (!skill) {
    throw new NotFoundError('Skill not found');
  }
  return {
    ...toSkill(skill),
    agents: agents
      .filter((agent) => agent.skillIds.includes(skillId))
      .map(({ agentId, name }) => ({ agentId, name })),
  };
}

export async function updateSkill(
  userId: string,
  skillId: string,
  content: AgentSkillContent
): Promise<AgentSkill> {
  const [skills, agents] = await Promise.all([
    skillRepository.listSkills(userId),
    agentRepository.listAgentSkillIds(userId),
  ]);
  if (!skills.some((s) => s.skillId === skillId)) {
    throw new NotFoundError('Skill not found');
  }
  assertNameIsFree(skills, content.name, skillId);

  // A longer description must not push an agent using the skill over the limit
  const lengths = new Map(
    skills.map((s) => [
      s.skillId,
      s.skillId === skillId ? content.description.length : s.description.length,
    ])
  );
  const overLimit = agents.find(
    (agent) =>
      agent.skillIds.includes(skillId) &&
      agent.skillIds.reduce((total, id) => total + (lengths.get(id) ?? 0), 0) >
        AGENT_SKILL_DESCRIPTIONS_TOTAL_MAX_LENGTH
  );
  if (overLimit) {
    throw new ValidationError(
      `${totalLimitMessage}. Agent "${overLimit.name}" uses this skill.`
    );
  }

  const skill = await skillRepository.updateSkill(userId, skillId, content);
  return toSkill(skill);
}

export async function deleteSkill(
  userId: string,
  skillId: string
): Promise<void> {
  const skill = await skillRepository.getSkill(userId, skillId);
  if (!skill) {
    throw new NotFoundError('Skill not found');
  }
  // Agents keep the ID; a missing skill is left out when the agent is used.
  await skillRepository.deleteSkill(userId, skillId);
}

/**
 * Check the skills given to an agent of the user and return them without
 * duplicates. Every skill must be one of the user's, and their descriptions
 * must fit in the limit.
 */
export async function checkSkillsOfAgent(
  userId: string,
  skillIds: string[]
): Promise<string[]> {
  const ids = [...new Set(skillIds)];
  if (ids.length === 0) {
    return ids;
  }

  // Only the given skills are read: a full list would read every instruction
  const skills = await skillRepository.getSkills(userId, ids);
  if (skills.length !== ids.length) {
    throw new ValidationError('Skill not found');
  }
  const total = skills.reduce((sum, s) => sum + s.description.length, 0);
  if (total > AGENT_SKILL_DESCRIPTIONS_TOTAL_MAX_LENGTH) {
    throw new ValidationError(totalLimitMessage);
  }
  return ids;
}

/**
 * The user's own skills by ID, for trying an agent before it is saved.
 * Missing skills are left out.
 */
export async function listSkillContents(
  userId: string,
  skillIds: string[]
): Promise<ListSkillsOfAgentResponse> {
  const skills = await skillRepository.getSkills(userId, [
    ...new Set(skillIds),
  ]);
  return {
    skills: skills.map(({ name, description, instructions }) => ({
      name,
      description,
      instructions,
    })),
  };
}

/**
 * The skills of an agent the user can use, for a chat with it. They are read
 * from the agent's creator, so a public agent brings its skills along.
 */
export async function listSkillsOfAgent(
  userId: string,
  agentId: string
): Promise<ListSkillsOfAgentResponse> {
  const agent = await agentRepository.getAgent(userId, agentId);
  if (!agent) {
    throw new NotFoundError('Agent not found');
  }
  const skills = await skillRepository.getSkills(
    agent.createdBy,
    agent.skillIds || []
  );
  return {
    skills: skills.map(({ name, description, instructions }) => ({
      name,
      description,
      instructions,
    })),
  };
}
