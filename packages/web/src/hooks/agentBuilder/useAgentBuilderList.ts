import { produce } from 'immer';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import useSWRInfinite from 'swr/infinite';
import {
  AgentConfiguration,
  CreateAgentRequest,
  UpdateAgentRequest,
  ListAgentsResponse,
  AgentCoreConfiguration,
} from 'generative-ai-use-cases';

import useAgentBuilderApi from './useAgentBuilderApi';
import { useAgentCore } from '../useAgentCore';
import { MODELS } from '../useModel';
import { AxiosError } from 'axios';

const useAgentBuilderList = () => {
  const { t } = useTranslation();
  const api = useAgentBuilderApi();
  const { getExternalRuntimes } = useAgentCore('agent-builder-list');
  const { agents } = MODELS;

  // My Agents pagination
  const myAgentsConfig = api.listUserAgentsSWR();
  const myAgentsSWR = useSWRInfinite(
    myAgentsConfig.key,
    myAgentsConfig.fetcher
  );

  const myAgentsRaw = myAgentsSWR.data;
  const myAgents = myAgentsRaw
    ? myAgentsRaw.flatMap((page) => page.agents || [])
    : [];
  const isLoadingMyAgents = !myAgentsRaw && !myAgentsSWR.error;
  const canLoadMoreMyAgents = Boolean(
    myAgentsRaw &&
    myAgentsRaw.length > 0 &&
    myAgentsRaw[myAgentsRaw.length - 1]?.nextToken
  );
  const loadMoreMyAgents = () => myAgentsSWR.setSize(myAgentsSWR.size + 1);
  const mutateMyAgents = myAgentsSWR.mutate;

  // Favorite Agents pagination
  const favoriteAgentsConfig = api.listFavoriteAgentsSWR();
  const favoriteAgentsSWR = useSWRInfinite(
    favoriteAgentsConfig.key,
    favoriteAgentsConfig.fetcher
  );

  const favoriteAgentsRaw = favoriteAgentsSWR.data;
  const favoriteAgents = favoriteAgentsRaw
    ? favoriteAgentsRaw.flatMap((page) => page.agents || [])
    : [];
  const isLoadingFavoriteAgents =
    !favoriteAgentsRaw && !favoriteAgentsSWR.error;
  const canLoadMoreFavoriteAgents = Boolean(
    favoriteAgentsRaw &&
    favoriteAgentsRaw.length > 0 &&
    favoriteAgentsRaw[favoriteAgentsRaw.length - 1]?.nextToken
  );
  const loadMoreFavoriteAgents = () =>
    favoriteAgentsSWR.setSize(favoriteAgentsSWR.size + 1);
  const mutateFavoriteAgents = favoriteAgentsSWR.mutate;

  // Public Agents pagination
  const publicAgentsConfig = api.fetchPublicAgentsSWR();
  const publicAgentsSWR = useSWRInfinite(
    publicAgentsConfig.key,
    publicAgentsConfig.fetcher
  );

  const publicAgentsRaw = publicAgentsSWR.data;
  const publicAgents = publicAgentsRaw
    ? publicAgentsRaw.flatMap((page) => page.agents || [])
    : [];
  const isLoadingPublicAgents = !publicAgentsRaw && !publicAgentsSWR.error;
  const canLoadMorePublicAgents = Boolean(
    publicAgentsRaw &&
    publicAgentsRaw.length > 0 &&
    publicAgentsRaw[publicAgentsRaw.length - 1]?.nextToken
  );
  const loadMorePublicAgents = () =>
    publicAgentsSWR.setSize(publicAgentsSWR.size + 1);
  const mutatePublicAgents = publicAgentsSWR.mutate;

  // External Agents (from AgentCore and Bedrock Agents)
  const externalRuntimes = getExternalRuntimes();
  const agentCoreAgents: AgentConfiguration[] = externalRuntimes.map(
    (runtime: AgentCoreConfiguration) => ({
      agentId: runtime.arn, // Use ARN as unique ID
      name: runtime.display_name || runtime.name,
      description:
        runtime.description || t('agent_builder.external_agent_description'),
      systemPrompt: '', // External agents don't have editable system prompts
      mcpServers: [],
      modelId: '',
      codeExecutionEnabled: false,
      webSearchEnabled: false,
      isPublic: false,
      shareId: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['AgentCore'],
      starCount: 0,
      createdBy: 'System',
      createdByEmail: '',
      isFavorite: false,
      isMyAgent: false,
    })
  );

  // Bedrock Agents
  const bedrockAgents: AgentConfiguration[] = agents.map((agent) => ({
    agentId: `bedrock-agent:${agent.displayName}`, // Use prefixed name as unique ID
    name: agent.displayName,
    description:
      agent.description || t('agent_builder.bedrock_agent_description'),
    systemPrompt: '', // Bedrock agents don't have editable system prompts
    mcpServers: [],
    modelId: agent.displayName,
    codeExecutionEnabled: false,
    webSearchEnabled: false,
    isPublic: false,
    shareId: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ['Bedrock'],
    starCount: 0,
    createdBy: 'System',
    createdByEmail: '',
    isFavorite: false,
    isMyAgent: false,
  }));

  // Combine all external agents
  const externalAgents: AgentConfiguration[] = [
    ...agentCoreAgents,
    ...bedrockAgents,
  ];

  // Helper function to find agent index across pages
  const findAgentIndex = (
    agentsRaw: ListAgentsResponse[] | undefined,
    agentId: string
  ): { page: number; idx: number } => {
    if (!agentsRaw) {
      return { page: -1, idx: -1 };
    }

    for (const [pageIndex, response] of agentsRaw.entries()) {
      const agents = response.agents || [];
      const idx = agents.findIndex((agent) => agent.agentId === agentId);
      if (idx >= 0) {
        return { page: pageIndex, idx };
      }
    }

    return { page: -1, idx: -1 };
  };

  return {
    // My Agents
    myAgents: myAgents ?? [],
    isLoadingMyAgents,
    loadMoreMyAgents,
    canLoadMoreMyAgents,

    // Favorite Agents
    favoriteAgents: favoriteAgents ?? [],
    isLoadingFavoriteAgents,
    loadMoreFavoriteAgents,
    canLoadMoreFavoriteAgents,

    // Public Agents
    publicAgents: publicAgents ?? [],
    isLoadingPublicAgents,
    loadMorePublicAgents,
    canLoadMorePublicAgents,

    // External Agents
    externalAgents: externalAgents ?? [],
    isLoadingExternalAgents: false, // External agents are loaded synchronously
    loadMoreExternalAgents: () => {}, // No pagination for external agents
    canLoadMoreExternalAgents: false,

    // Agent operations with optimistic updates
    createAgent: async (params: CreateAgentRequest) => {
      try {
        const response = await api.createAgent(params);
        // Add to the beginning of my agents list
        mutateMyAgents(
          myAgentsRaw
            ? produce(myAgentsRaw, (draft) => {
                if (draft[0]) {
                  draft[0].agents.unshift(response.agent);
                } else {
                  // Create first page if it doesn't exist
                  draft.push({
                    agents: [response.agent],
                    nextToken: undefined,
                    totalCount: 1,
                    type: 'my',
                  });
                }
              })
            : [
                {
                  agents: [response.agent],
                  nextToken: undefined,
                  totalCount: 1,
                  type: 'my',
                },
              ],
          { revalidate: false }
        );
        toast.success(t('agent_builder.agent_created_successfully'));
        return response.agent;
      } catch (error) {
        toast.error(t('agent_builder.failed_to_create_agent'));
        if (error instanceof AxiosError) {
          toast.error(error?.response?.data?.error);
        }
        throw error;
      } finally {
        // Revalidate to ensure consistency
        mutateMyAgents();
      }
    },

    updateAgent: async (agentId: string, params: UpdateAgentRequest) => {
      // Optimistic update across all lists
      const updateAgentInList = (
        agentsRaw: ListAgentsResponse[] | undefined
      ) => {
        if (!agentsRaw) return agentsRaw;

        return produce(agentsRaw, (draft) => {
          const { page, idx } = findAgentIndex(draft, agentId);
          if (page >= 0 && idx >= 0 && draft[page].agents) {
            draft[page].agents[idx] = { ...draft[page].agents[idx], ...params };
          }
        });
      };

      mutateMyAgents(updateAgentInList(myAgentsRaw), { revalidate: false });
      mutateFavoriteAgents(updateAgentInList(favoriteAgentsRaw), {
        revalidate: false,
      });
      mutatePublicAgents(updateAgentInList(publicAgentsRaw), {
        revalidate: false,
      });

      try {
        const response = await api.updateAgent(agentId, params);
        toast.success(t('agent_builder.agent_updated_successfully'));
        return response.agent;
      } catch (error) {
        toast.error(t('agent_builder.failed_to_update_agent'));
        if (error instanceof AxiosError) {
          toast.error(error?.response?.data?.error);
        }
        throw error;
      } finally {
        // Revalidate all lists
        mutateMyAgents();
        mutateFavoriteAgents();
        mutatePublicAgents();
      }
    },

    deleteAgent: async (agentId: string) => {
      if (!window.confirm(t('agent_builder.confirm_delete'))) {
        return;
      }

      // Optimistic removal from all lists
      const removeAgentFromList = (
        agentsRaw: ListAgentsResponse[] | undefined
      ) => {
        if (!agentsRaw) return agentsRaw;

        return produce(agentsRaw, (draft) => {
          const { page, idx } = findAgentIndex(draft, agentId);
          if (page >= 0 && idx >= 0 && draft[page].agents) {
            draft[page].agents.splice(idx, 1);
          }
        });
      };

      mutateMyAgents(removeAgentFromList(myAgentsRaw), { revalidate: false });
      mutateFavoriteAgents(removeAgentFromList(favoriteAgentsRaw), {
        revalidate: false,
      });
      mutatePublicAgents(removeAgentFromList(publicAgentsRaw), {
        revalidate: false,
      });

      try {
        await api.deleteAgent(agentId);
        toast.success(t('agent_builder.agent_deleted_successfully'));
      } catch (error) {
        toast.error(t('agent_builder.failed_to_delete_agent'));
        if (error instanceof AxiosError) {
          toast.error(error?.response?.data?.error);
        }
        throw error;
      } finally {
        // Revalidate all lists
        mutateMyAgents();
        mutateFavoriteAgents();
        mutatePublicAgents();
      }
    },

    cloneAgent: async (agent: AgentConfiguration) => {
      try {
        const clonedAgent = await api.cloneAgent({
          sourceAgentId: agent.agentId,
          name: `${agent.name} (Cloned)`,
        });

        // Add cloned agent to my agents list
        mutateMyAgents(
          myAgentsRaw && clonedAgent.agent
            ? produce(myAgentsRaw, (draft) => {
                if (draft[0]) {
                  draft[0].agents.unshift(clonedAgent.agent!);
                } else {
                  // Create first page if it doesn't exist
                  draft.push({
                    agents: [clonedAgent.agent!],
                    nextToken: undefined,
                    totalCount: 1,
                    type: 'my',
                  });
                }
              })
            : clonedAgent.agent
              ? [
                  {
                    agents: [clonedAgent.agent],
                    nextToken: undefined,
                    totalCount: 1,
                    type: 'my',
                  },
                ]
              : myAgentsRaw,
          { revalidate: false }
        );

        toast.success(
          t('agent_builder.agent_cloned_successfully', { name: agent.name })
        );
        return clonedAgent.agent;
      } catch (error) {
        toast.error(t('agent_builder.failed_to_clone_agent'));
        if (error instanceof AxiosError) {
          toast.error(error?.response?.data?.error);
        }
        throw error;
      } finally {
        mutateMyAgents();
      }
    },

    toggleFavorite: async (agentId: string) => {
      // Find current favorite status from all loaded agents (including favorites)
      const allLoadedAgents = [
        ...(myAgents ?? []),
        ...(publicAgents ?? []),
        ...(favoriteAgents ?? []),
      ];

      const agent = allLoadedAgents.find((a) => a.agentId === agentId);

      // If agent not found in loaded data, we still allow the operation
      // The backend will handle the actual toggle logic
      const currentFavoriteStatus = agent?.isFavorite ?? false;
      const newFavoriteStatus = !currentFavoriteStatus;

      // Optimistic update in my agents and public agents
      const updateFavoriteStatus = (
        agentsRaw: ListAgentsResponse[] | undefined
      ) => {
        if (!agentsRaw) return agentsRaw;

        return produce(agentsRaw, (draft) => {
          const { page, idx } = findAgentIndex(draft, agentId);
          if (page >= 0 && idx >= 0 && draft[page].agents) {
            draft[page].agents[idx].isFavorite = newFavoriteStatus;
          }
        });
      };

      mutateMyAgents(updateFavoriteStatus(myAgentsRaw), { revalidate: false });
      mutatePublicAgents(updateFavoriteStatus(publicAgentsRaw), {
        revalidate: false,
      });

      // Handle favorites list
      if (newFavoriteStatus && agent) {
        // Add to favorites (only if we have agent data)
        mutateFavoriteAgents(
          favoriteAgentsRaw
            ? produce(favoriteAgentsRaw, (draft) => {
                // Check if already exists to avoid duplicates
                const exists = draft.some((page) =>
                  page.agents.some((a) => a.agentId === agentId)
                );

                if (!exists) {
                  if (draft[0]) {
                    draft[0].agents.unshift({ ...agent, isFavorite: true });
                  } else {
                    // Create first page if it doesn't exist
                    draft.push({
                      agents: [{ ...agent, isFavorite: true }],
                      nextToken: undefined,
                      totalCount: 1,
                      type: 'favorites',
                    });
                  }
                }
              })
            : [
                {
                  agents: [{ ...agent, isFavorite: true }],
                  nextToken: undefined,
                  totalCount: 1,
                  type: 'favorites',
                },
              ],
          { revalidate: false }
        );
      } else {
        // Remove from favorites
        mutateFavoriteAgents(
          favoriteAgentsRaw
            ? produce(favoriteAgentsRaw, (draft) => {
                const { page, idx } = findAgentIndex(draft, agentId);
                if (page >= 0 && idx >= 0 && draft[page].agents) {
                  draft[page].agents.splice(idx, 1);
                }
              })
            : favoriteAgentsRaw,
          { revalidate: false }
        );
      }

      try {
        const result = await api.toggleAgentFavorite(agentId);

        // If the actual result differs from our optimistic update, revalidate
        if (result.isFavorite !== newFavoriteStatus) {
          mutateMyAgents();
          mutateFavoriteAgents();
          mutatePublicAgents();
        }

        return result;
      } catch (error) {
        toast.error(t('agent_builder.failed_to_toggle_favorite'));
        if (error instanceof AxiosError) {
          toast.error(error?.response?.data?.error);
        }
        // Revert optimistic updates on error
        mutateMyAgents();
        mutateFavoriteAgents();
        mutatePublicAgents();
        throw error;
      }
    },

    // Refresh functions
    refreshMyAgents: () => mutateMyAgents(),
    refreshFavoriteAgents: () => mutateFavoriteAgents(),
    refreshPublicAgents: () => mutatePublicAgents(),
    refreshAll: () => {
      mutateMyAgents();
      mutateFavoriteAgents();
      mutatePublicAgents();
    },
  };
};

export default useAgentBuilderList;
