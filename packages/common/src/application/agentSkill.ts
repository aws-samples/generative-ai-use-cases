// Limits of Agent Builder skills, shared by the API and the web client.
//
// The name follows the Agent Skills specification that Strands Agents uses:
// lowercase letters, digits and single hyphens, not starting or ending with a
// hyphen. The agent activates a skill by this name.
export const AGENT_SKILL_NAME_MAX_LENGTH = 64;
export const AGENT_SKILL_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const AGENT_SKILL_DESCRIPTION_MAX_LENGTH = 1024;
export const AGENT_SKILL_INSTRUCTIONS_MAX_LENGTH = 50000;

// The descriptions of all the skills of an agent are put in its system prompt
// on every turn, so their total length is what limits the skills of an agent.
export const AGENT_SKILL_DESCRIPTIONS_TOTAL_MAX_LENGTH = 10000;

export const isValidAgentSkillName = (name: string): boolean =>
  name.length <= AGENT_SKILL_NAME_MAX_LENGTH &&
  AGENT_SKILL_NAME_PATTERN.test(name);

export const totalAgentSkillDescriptionLength = (
  skills: { description: string }[]
): number => skills.reduce((total, s) => total + s.description.length, 0);
