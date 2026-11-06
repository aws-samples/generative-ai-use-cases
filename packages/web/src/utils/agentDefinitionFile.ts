import { AgentContent } from 'generative-ai-use-cases';

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
};

export const toPortableAgent = (
  agent: Partial<AgentContent>
): PortableAgent => ({
  name: agent.name ?? '',
  description: agent.description ?? '',
  systemPrompt: agent.systemPrompt ?? '',
  modelId: agent.modelId ?? '',
  mcpServers: agent.mcpServers ?? [],
  codeExecutionEnabled: !!agent.codeExecutionEnabled,
});

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
  };
};

/** What the form is filled with after an import. */
export type ImportedAgentForm = PortableAgent & {
  isPublic: boolean;
  tags: string[];
};

/**
 * Turns a definition read from a file into what the form should hold.
 *
 * The file only describes the agent, so the sharing settings (isPublic, tags)
 * are kept from the form the user is importing into. Otherwise importing over
 * a shared agent and saving would quietly stop sharing it.
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
  current?: { isPublic?: boolean; tags?: string[] } | null;
  availableModels: string[];
}): { form: ImportedAgentForm; unavailableModelId: string | null } => {
  const modelAvailable = availableModels.includes(portable.modelId);
  return {
    form: {
      ...portable,
      modelId: modelAvailable ? portable.modelId : (availableModels[0] ?? ''),
      isPublic: current?.isPublic ?? false,
      tags: current?.tags ?? [],
    },
    // An empty id means the file named no model; falling back is not news.
    unavailableModelId:
      !modelAvailable && portable.modelId ? portable.modelId : null,
  };
};

/** A filename that survives being written to disk. */
export const agentFileName = (name: string): string => {
  const safe = name.replace(/[\\/:*?"<>|]/g, '').trim();
  return `${safe || 'agent'}.json`;
};
