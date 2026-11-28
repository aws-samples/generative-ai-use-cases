import { useCallback } from 'react';
import { AgentConfiguration } from 'generative-ai-use-cases';
import { useAgentCore } from '../useAgentCore';

export type InvokeAgentParams = {
  agent: AgentConfiguration;
  // AgentCore Runtime session of the conversation
  sessionId: string;
  prompt: string;
  files?: File[];
  // The model to run on, which the user can change from the agent's own
  modelId?: string;
};

/**
 * Run an Agent Builder agent in the conversation `id`: its tools and settings
 * go to the Agent Builder runtime with the message, and the answer is added to
 * the conversation like any other.
 */
const useAgentInvocation = (id: string) => {
  const agentCore = useAgentCore(id);
  const { invokeAgentRuntime, getAgentBuilderRuntime } = agentCore;

  const invokeAgent = useCallback(
    ({ agent, sessionId, prompt, files, modelId }: InvokeAgentParams) => {
      const runtime = getAgentBuilderRuntime();
      if (!runtime) {
        throw new Error('No AgentBuilder runtime available');
      }
      return invokeAgentRuntime(
        runtime.arn,
        sessionId,
        prompt,
        'DEFAULT',
        files,
        'current-user',
        agent.mcpServers,
        agent.agentId,
        modelId,
        agent.codeExecutionEnabled ?? false,
        agent.webSearchEnabled ?? false
      );
    },
    [getAgentBuilderRuntime, invokeAgentRuntime]
  );

  return { ...agentCore, invokeAgent };
};

export default useAgentInvocation;
