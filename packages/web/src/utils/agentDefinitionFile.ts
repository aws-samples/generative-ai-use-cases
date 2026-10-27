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

/** A filename that survives being written to disk. */
export const agentFileName = (name: string): string => {
  const safe = name.replace(/[\\/:*?"<>|]/g, '').trim();
  return `${safe || 'agent'}.json`;
};
