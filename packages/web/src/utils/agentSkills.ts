import { AgentSkillSummary } from 'generative-ai-use-cases';
import { totalAgentSkillDescriptionLength } from '@generative-ai-use-cases/common';

/**
 * The skills an agent lists, split into the ones the user has and the IDs of
 * deleted ones, with the total length of their descriptions.
 */
export const skillsOfAgent = (
  skills: AgentSkillSummary[],
  skillIds: string[]
) => {
  const byId = new Map(skills.map((s) => [s.skillId, s]));
  const attached = skillIds.flatMap((id) => byId.get(id) ?? []);
  return {
    attached,
    missingIds: skillIds.filter((id) => !byId.has(id)),
    total: totalAgentSkillDescriptionLength(attached),
  };
};

// The skills whose name or description contains the search term
export const searchSkills = <T extends AgentSkillSummary>(
  skills: T[],
  searchTerm: string
): T[] => {
  const term = searchTerm.trim().toLowerCase();
  return skills.filter((s) =>
    `${s.name}\n${s.description}`.toLowerCase().includes(term)
  );
};
