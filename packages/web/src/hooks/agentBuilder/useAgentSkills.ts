import {
  AgentSkill,
  AgentSkillContent,
  CreateAgentSkillRequest,
  GetAgentSkillResponse,
  ListAgentSkillsResponse,
  ListSkillsOfAgentResponse,
  UpdateAgentSkillRequest,
} from 'generative-ai-use-cases';
import useHttp from '../useHttp';
import {
  isImportCandidate,
  planSkillImport,
} from '../../utils/agentDefinitionFile';

const SKILLS_URL = 'agents/skills';
const contentsUrl = (skillIds: string[]) =>
  `${SKILLS_URL}/contents?skillIds=${skillIds.map(encodeURIComponent).join(',')}`;

// The user's skills, without their instructions
export const useSkillList = () => {
  const http = useHttp();
  const { data, error, isLoading, mutate } =
    http.get<ListAgentSkillsResponse>(SKILLS_URL);
  return {
    skills: data?.skills ?? [],
    error,
    isLoading,
    mutate,
  };
};

export const useSkill = (skillId?: string) => {
  const http = useHttp();
  const { data, error, isLoading, mutate } = http.get<GetAgentSkillResponse>(
    skillId ? `${SKILLS_URL}/${encodeURIComponent(skillId)}` : null
  );
  return { skill: data, error, isLoading, mutate };
};

/**
 * The skills to send with a chat message. An agent of the user's own (also
 * one being edited and not saved yet) uses the skills it lists; another
 * user's public agent brings its creator's skills through the API.
 */
export const useSkillsForChat = (agent: {
  agentId: string;
  isMyAgent?: boolean;
  skillIds?: string[];
}) => {
  const http = useHttp();
  const skillIds = agent.skillIds ?? [];
  const url = agent.isMyAgent
    ? skillIds.length > 0
      ? contentsUrl(skillIds)
      : null
    : `agents/${encodeURIComponent(agent.agentId)}/skills`;
  const { data, isLoading } = http.get<ListSkillsOfAgentResponse>(url);
  return { skills: url ? (data?.skills ?? []) : [], isLoading };
};

export const useSkillApi = () => {
  const http = useHttp();
  return {
    // The skills an agent uses, with their content (its creator's skills)
    listSkillsOfAgent: async (agentId: string) => {
      const res = await http.api.get<ListSkillsOfAgentResponse>(
        `agents/${encodeURIComponent(agentId)}/skills`
      );
      return res.data.skills;
    },
    /**
     * Adds the skills of an imported file to the user's skills, following
     * planSkillImport. Returns the IDs to give the agent and the names
     * created; after a failure, those done so far.
     */
    importSkills: async (fileSkills: AgentSkillContent[]) => {
      const skillIds: string[] = [];
      const created: string[] = [];
      try {
        const get = async <T>(url: string) => (await http.api.get<T>(url)).data;
        const mine = (await get<ListAgentSkillsResponse>(SKILLS_URL)).skills;
        const sameName = mine.filter((m) =>
          fileSkills.some((f) => isImportCandidate(m.name, f.name))
        );
        const contents = sameName.length
          ? (
              await get<ListSkillsOfAgentResponse>(
                contentsUrl(sameName.map((s) => s.skillId))
              )
            ).skills
          : [];
        for (const step of planSkillImport(fileSkills, mine, contents)) {
          if (step.kind === 'reuse') {
            skillIds.push(step.skillId);
            continue;
          }
          const skill = (await http.post<AgentSkill>(SKILLS_URL, step.skill))
            .data;
          skillIds.push(skill.skillId);
          created.push(skill.name);
        }
        return { skillIds, created, failed: false };
      } catch {
        return { skillIds, created, failed: true };
      }
    },
    createSkill: async (req: CreateAgentSkillRequest): Promise<AgentSkill> => {
      const res = await http.post<AgentSkill>(SKILLS_URL, req);
      return res.data;
    },
    updateSkill: async (
      skillId: string,
      req: UpdateAgentSkillRequest
    ): Promise<AgentSkill> => {
      const res = await http.put<AgentSkill>(
        `${SKILLS_URL}/${encodeURIComponent(skillId)}`,
        req
      );
      return res.data;
    },
    deleteSkill: async (skillId: string): Promise<void> => {
      await http.delete(`${SKILLS_URL}/${encodeURIComponent(skillId)}`);
    },
  };
};
