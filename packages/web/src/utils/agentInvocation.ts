import { AgentConfiguration } from 'generative-ai-use-cases';

/**
 * The system prompt an Agent Builder agent runs with: the agent's own prompt,
 * followed by its name and description so that it answers as that agent.
 */
export const agentSystemPrompt = (
  agent: Pick<AgentConfiguration, 'name' | 'description' | 'systemPrompt'>
): string => `${agent.systemPrompt || 'You are a helpful assistant.'}

Agent Name: ${agent.name}
Agent Description: ${agent.description || 'No description provided'}

Please respond as this agent with the specified behavior and personality.`;

/**
 * The model an agent runs on: the one saved with the agent, otherwise the
 * first model of the deployment.
 */
export const agentModelId = (
  agent: Pick<AgentConfiguration, 'modelId'>,
  availableModelIds: string[]
): string => agent.modelId || availableModelIds[0];
