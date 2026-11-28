import { AgentConfiguration } from 'generative-ai-use-cases';
import type { AgentFormData } from '../components/agentBuilder/AgentForm';

/**
 * Keeps the agent being edited while the user opens a skill in the same tab,
 * so they come back to what they had typed rather than to the saved agent.
 *
 * sessionStorage belongs to the tab: a draft never reaches another tab, and
 * it is gone when the tab is closed. It is read once and then removed, so a
 * later visit shows the saved agent again.
 */

const KEY_PREFIX = 'agentBuilder.draft:';

// The draft of a new agent and of each saved agent are kept apart
export const agentDraftKey = (agentId?: string): string =>
  `${KEY_PREFIX}${agentId ?? 'new'}`;

export const saveAgentDraft = (key: string, draft: unknown): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage may be full or blocked; the user only loses the unsaved edits
  }
};

export const takeAgentDraft = <T>(key: string): T | null => {
  try {
    const value = sessionStorage.getItem(key);
    if (value === null) return null;
    sessionStorage.removeItem(key);
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

/**
 * Where a skill page goes back to. Only pages of the agent builder are
 * accepted, so a crafted link cannot send the user to another site.
 */
export const agentReturnPath = (value: string | null): string | null => {
  if (!value) return null;
  return /^\/agent-builder\/(create|[A-Za-z0-9-]+\/edit)$/.test(value)
    ? value
    : null;
};

// The link to a skill page that comes back to `returnTo` afterwards
export const skillPagePath = (path: string, returnTo?: string): string =>
  returnTo ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path;

// The form's values for an agent; also what "unsaved changes" compares to
export const toAgentFormData = (
  agent: Partial<AgentConfiguration>,
  defaultModelId: string
): AgentFormData => ({
  name: agent.name || '',
  description: agent.description || '',
  systemPrompt: agent.systemPrompt || '',
  modelId: agent.modelId || defaultModelId,
  mcpServers: agent.mcpServers || [],
  codeExecutionEnabled: agent.codeExecutionEnabled || false,
  webSearchEnabled: agent.webSearchEnabled || false,
  skillIds: agent.skillIds || [],
  isPublic: agent.isPublic || false,
  tags: agent.tags || [],
});
