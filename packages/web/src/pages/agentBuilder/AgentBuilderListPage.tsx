import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import ButtonIcon from '../../components/ButtonIcon';
import InputText from '../../components/InputText';
import Select from '../../components/Select';
import Card from '../../components/Card';
import Skeleton from '../../components/Skeleton';
import {
  PiPlus as AddIcon,
  PiArrowClockwise as RefreshIcon,
  PiStorefront as PublicIcon,
  PiUser as MyAgentsIcon,
  PiStar as StarIcon,
  PiStarFill as StarFillIcon,
  PiPencil as EditIcon,
  PiCopy as CloneIcon,
  PiTrash as DeleteIcon,
  PiDownloadSimple as ExportIcon,
  PiDotsThreeOutlineFill as MoreIcon,
} from 'react-icons/pi';
import { AgentConfiguration } from 'generative-ai-use-cases';
import {
  agentFileName,
  toPortableAgent,
} from '../../utils/agentDefinitionFile';
import useAgentBuilderList from '../../hooks/agentBuilder/useAgentBuilderList';

export type AgentFilter = 'my' | 'favorites' | 'public' | 'external';

const AgentBuilderListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Local state for filters
  const [currentFilter, setCurrentFilter] = useState<AgentFilter>('favorites');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Use the agent list hook
  const {
    myAgents,
    isLoadingMyAgents,
    loadMoreMyAgents,
    canLoadMoreMyAgents,
    favoriteAgents,
    isLoadingFavoriteAgents,
    loadMoreFavoriteAgents,
    canLoadMoreFavoriteAgents,
    publicAgents,
    isLoadingPublicAgents,
    loadMorePublicAgents,
    canLoadMorePublicAgents,
    externalAgents,
    isLoadingExternalAgents,
    loadMoreExternalAgents,
    canLoadMoreExternalAgents,
    deleteAgent,
    cloneAgent,
    toggleFavorite,
    refreshAll,
  } = useAgentBuilderList();

  // Get current tab data
  const getCurrentTabData = () => {
    switch (currentFilter) {
      case 'my':
        return {
          agents: myAgents,
          isLoading: isLoadingMyAgents,
          loadMore: loadMoreMyAgents,
          canLoadMore: canLoadMoreMyAgents,
        };
      case 'favorites':
        return {
          agents: favoriteAgents,
          isLoading: isLoadingFavoriteAgents,
          loadMore: loadMoreFavoriteAgents,
          canLoadMore: canLoadMoreFavoriteAgents,
        };
      case 'public':
        return {
          agents: publicAgents,
          isLoading: isLoadingPublicAgents,
          loadMore: loadMorePublicAgents,
          canLoadMore: canLoadMorePublicAgents,
        };
      case 'external':
        return {
          agents: externalAgents,
          isLoading: isLoadingExternalAgents,
          loadMore: loadMoreExternalAgents,
          canLoadMore: canLoadMoreExternalAgents,
        };
      default:
        return {
          agents: [],
          isLoading: false,
          loadMore: () => {},
          canLoadMore: false,
        };
    }
  };

  const currentTabData = getCurrentTabData();

  // Filter agents based on search and tag
  const filteredAgents = useMemo(() => {
    if (!searchTerm && !selectedTag) {
      return currentTabData.agents;
    }

    return currentTabData.agents.filter((agent) => {
      const matchesSearch =
        !searchTerm ||
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTag = !selectedTag || agent.tags?.includes(selectedTag);

      return matchesSearch && matchesTag;
    });
  }, [currentTabData.agents, searchTerm, selectedTag]);

  // Get available tags from current tab
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    currentTabData.agents.forEach((agent) => {
      agent.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [currentTabData.agents]);

  // Handle tab change
  const handleTabChange = useCallback((tab: AgentFilter) => {
    setCurrentFilter(tab);
    setSearchTerm('');
    setSelectedTag('');
  }, []);

  // Event handlers
  const handleEdit = useCallback(
    (agentId: string) => {
      navigate(`/agent-builder/${agentId}/edit`);
    },
    [navigate]
  );

  const handleChat = useCallback(
    (agent: AgentConfiguration) => {
      // Check if this is an AgentCore external agent (ARN format)
      if (agent.agentId.startsWith('arn:')) {
        navigate(`/agent-core/${encodeURIComponent(agent.agentId)}`);
      }
      // Check if this is a Bedrock agent
      else if (agent.agentId.startsWith('bedrock-agent:')) {
        const agentName = agent.agentId.replace('bedrock-agent:', '');
        navigate(`/agent/${agentName}`);
      }
      // Regular agent builder agent
      else {
        navigate(`/agent-builder/${agent.agentId}`);
      }
    },
    [navigate]
  );

  const handleCloneWithNavigation = useCallback(
    async (agent: AgentConfiguration) => {
      await cloneAgent(agent);
      setCurrentFilter('my');
      setOpenDropdown(null);
    },
    [cloneAgent]
  );

  const handleExportAgent = useCallback((agent: AgentConfiguration) => {
    const blob = new Blob([JSON.stringify(toPortableAgent(agent), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = agentFileName(agent.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setOpenDropdown(null);
  }, []);

  const handleDeleteAgent = useCallback(
    async (agentId: string) => {
      await deleteAgent(agentId);
      setOpenDropdown(null);
    },
    [deleteAgent]
  );

  const toggleDropdown = useCallback(
    (agentId: string) => {
      setOpenDropdown(openDropdown === agentId ? null : agentId);
    },
    [openDropdown]
  );

  const handleAction = useCallback((action: () => void) => {
    action();
    setOpenDropdown(null);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Check if the click is outside any dropdown
      if (!target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdown]);

  // Filter tabs configuration with pagination indicator for each tab
  const getTabCount = (tabKey: AgentFilter) => {
    let count: number;
    let hasMore: boolean;

    switch (tabKey) {
      case 'my':
        count = myAgents.length;
        hasMore = canLoadMoreMyAgents;
        break;
      case 'favorites':
        count = favoriteAgents.length;
        hasMore = canLoadMoreFavoriteAgents;
        break;
      case 'public':
        count = publicAgents.length;
        hasMore = canLoadMorePublicAgents;
        break;
      case 'external':
        count = externalAgents.length;
        hasMore = canLoadMoreExternalAgents;
        break;
      default:
        count = 0;
        hasMore = false;
    }

    return hasMore ? `${count}+` : count.toString();
  };

  const filterTabs = [
    {
      key: 'favorites' as AgentFilter,
      label: t('agent_builder.favorites'),
      icon: StarIcon,
      count: getTabCount('favorites'),
    },
    {
      key: 'my' as AgentFilter,
      label: t('agent_builder.my_agents'),
      icon: MyAgentsIcon,
      count: getTabCount('my'),
    },
    {
      key: 'public' as AgentFilter,
      label: t('agent_builder.public'),
      icon: PublicIcon,
      count: getTabCount('public'),
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-row">
        <div className="flex-1" />
        <div className="hidden flex-row items-center justify-center text-xl font-semibold lg:flex print:flex">
          {t('agent_builder.title')}
        </div>
        <div className="flex flex-1 justify-end">
          <Button onClick={() => navigate('/agent-builder/create')}>
            <AddIcon className="mr-2" />
            {t('agent_builder.create_agent')}
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex flex-row lg:justify-center">
        {filterTabs.map((tab) => {
          const Icon = tab.icon;
          if (currentFilter === tab.key) {
            return (
              /* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */
              <div
                key={tab.key}
                className="text-aws-smile border-aws-smile flex cursor-pointer flex-row border-b-2 px-4 py-2 text-sm font-bold"
                onClick={() => handleTabChange(tab.key)}>
                <Icon className="mr-2 h-4 w-4" />
                {tab.label} ({tab.count})
              </div>
            );
          } else {
            return (
              /* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */
              <div
                key={tab.key}
                className="hover:text-aws-smile flex cursor-pointer flex-row border-b-2 border-gray-200 px-4 py-2 text-sm text-gray-800"
                onClick={() => handleTabChange(tab.key)}>
                <Icon className="mr-2 h-4 w-4" />
                {tab.label} ({tab.count})
              </div>
            );
          }
        })}
      </div>

      <Card>
        {/* Search and Filters */}
        <div className="mb-4 flex gap-2">
          <div className="flex-1">
            <InputText
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={t('agent_builder.search_agents')}
            />
          </div>
          <div>
            <Select
              value={selectedTag}
              onChange={setSelectedTag}
              placeholder={t('agent_builder.filter_by_tag')}
              options={[
                { value: '', label: t('agent_builder.filter_by_tag') },
                ...availableTags.map((tag) => ({
                  value: tag,
                  label: tag,
                })),
              ]}
            />
          </div>
          <div>
            <Button
              outlined
              onClick={refreshAll}
              disabled={currentTabData.isLoading}
              className="p-2.5">
              <RefreshIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Agent List */}
        {!currentTabData.isLoading && filteredAgents.length === 0 && (
          <div className="flex h-full w-full items-center justify-center py-16 text-sm font-bold text-gray-400">
            {currentFilter === 'my'
              ? t('agent_builder.no_agents_yet')
              : currentFilter === 'favorites'
                ? t('agent_builder.no_favorite_agents_yet')
                : currentFilter === 'external'
                  ? t('agent_builder.no_external_agents_available')
                  : t('agent_builder.no_public_agents_available')}
          </div>
        )}

        {filteredAgents.map((agent, idx) => (
          <div
            key={agent.agentId}
            className={`flex flex-row items-center gap-x-2 p-3 hover:bg-gray-100 ${idx > 0 ? 'border-t' : ''}`}>
            <div
              className="flex flex-1 cursor-pointer flex-col justify-start"
              onClick={() => handleChat(agent)}>
              <div className="mb-1 flex items-center gap-2">
                <div className="line-clamp-1 text-sm font-bold">
                  {agent.name}
                </div>
                {/* Show star count (total favorites) */}
                {agent.starCount > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <StarIcon className="h-3 w-3" />
                    <span>{agent.starCount}</span>
                  </div>
                )}
              </div>
              {agent.description && (
                <div className="mb-1 line-clamp-2 text-xs font-light text-gray-600">
                  {agent.description}
                </div>
              )}
              {agent.tags && agent.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {agent.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {tag}
                    </span>
                  ))}
                  {agent.tags.length > 3 && (
                    /* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      +{agent.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Hide favorite button for external agents */}
              {currentFilter !== 'external' && (
                <ButtonIcon
                  onClick={() => toggleFavorite(agent.agentId)}
                  className={
                    agent.isFavorite ? 'text-aws-smile' : 'text-gray-400'
                  }>
                  {agent.isFavorite ? <StarFillIcon /> : <StarIcon />}
                </ButtonIcon>
              )}
              {currentFilter === 'my' && (
                <ButtonIcon onClick={() => handleEdit(agent.agentId)}>
                  <EditIcon />
                </ButtonIcon>
              )}

              {/* Dropdown Menu - Hide for external agents */}
              {currentFilter !== 'external' && (
                /* eslint-disable-next-line tailwindcss/no-custom-classname */
                <div className="dropdown-container relative">
                  <ButtonIcon
                    onClick={() => toggleDropdown(agent.agentId)}
                    className="text-gray-600">
                    <MoreIcon />
                  </ButtonIcon>
                  {openDropdown === agent.agentId && (
                    <div
                      className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5"
                      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside dropdown
                    >
                      <div className="py-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(() =>
                              handleCloneWithNavigation(agent)
                            );
                          }}
                          className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50">
                          <CloneIcon className="mr-3 h-4 w-4 text-gray-500" />
                          {t('agent_builder.clone')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(() => handleExportAgent(agent));
                          }}
                          className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50">
                          <ExportIcon className="mr-3 h-4 w-4 text-gray-500" />
                          {t('agent_builder.export')}
                        </button>
                        {currentFilter === 'my' && (
                          <>
                            <div className="my-1 h-px bg-gray-100" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAction(() =>
                                  handleDeleteAgent(agent.agentId)
                                );
                              }}
                              className="flex w-full items-center px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50">
                              <DeleteIcon className="mr-3 h-4 w-4" />
                              {t('common.delete')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {currentTabData.isLoading && (
          <div className="flex flex-col gap-2 p-2">
            {new Array(5).fill('').map((_, idx) => (
              <Skeleton key={idx} />
            ))}
          </div>
        )}

        {!searchTerm &&
          !selectedTag &&
          currentTabData.canLoadMore &&
          !currentTabData.isLoading && (
            <div className="mt-2 flex w-full justify-center">
              <button
                className="text-sm hover:underline"
                onClick={currentTabData.loadMore}>
                {t('common.load_more')}
              </button>
            </div>
          )}
      </Card>
    </div>
  );
};

export default AgentBuilderListPage;
