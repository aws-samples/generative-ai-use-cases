import useChat from './useChat';
import useAgentCoreApi from './useAgentCoreApi';
import { AgentCoreRuntimeRequest } from 'generative-ai-use-cases';
import {
  AgentCoreConfiguration,
  UnrecordedMessage,
} from 'generative-ai-use-cases';
import { findModelByModelId } from './useModel';

// Get environment variables for separated generic and external runtimes
const agentCoreEnabled = import.meta.env.VITE_APP_AGENT_CORE_ENABLED === 'true';

// Generic runtime (deployed by CDK)
const agentCoreGenericRuntime =
  import.meta.env.VITE_APP_AGENT_CORE_GENERIC_RUNTIME !== 'null'
    ? (JSON.parse(
        import.meta.env.VITE_APP_AGENT_CORE_GENERIC_RUNTIME || 'null'
      ) as AgentCoreConfiguration | null)
    : null;

// AgentBuilder runtime (deployed by CDK)
const agentCoreAgentBuilderRuntime =
  import.meta.env.VITE_APP_AGENT_CORE_AGENT_BUILDER_RUNTIME !== 'null'
    ? (JSON.parse(
        import.meta.env.VITE_APP_AGENT_CORE_AGENT_BUILDER_RUNTIME || 'null'
      ) as AgentCoreConfiguration | null)
    : null;

// External runtimes (pre-defined)
const agentCoreExternalRuntimes = JSON.parse(
  import.meta.env.VITE_APP_AGENT_CORE_EXTERNAL_RUNTIMES || '[]'
) as AgentCoreConfiguration[];

const useAgentCore = (id: string) => {
  const {
    getModelId,
    setModelId,
    init,
    getCurrentSystemContext,
    updateSystemContext,
    rawMessages,
    messages,
    isEmpty,
    clear,
  } = useChat(id);

  const { postMessage, loading } = useAgentCoreApi(id);

  const invokeAgentRuntime = async (
    agentRuntimeArn: string,
    sessionId: string,
    userPrompt: string,
    qualifier = 'DEFAULT',
    files?: File[],
    userId?: string,
    mcpServers?: string[],
    agentId?: string,
    modelId?: string, // Add modelId parameter
    codeExecutionEnabled?: boolean, // Add codeExecutionEnabled parameter
    webSearchEnabled?: boolean // Add webSearchEnabled parameter
  ) => {
    // Use provided modelId or fall back to current model ID
    const targetModelId = modelId || getModelId();
    console.log('Target model ID in useAgentCore:', targetModelId);

    if (!targetModelId) {
      throw new Error('No model ID provided. Please specify a model ID.');
    }

    const model = findModelByModelId(targetModelId);

    if (!model) {
      throw new Error(`Model not found for ID: ${targetModelId}`);
    }

    console.log('Using model:', model);

    // Get previous messages for context, excluding:
    // 1. System messages (will be sent as system_prompt)
    // 2. Empty assistant messages
    const previousMessages = rawMessages
      .filter((msg) => {
        // Exclude system messages
        if (msg.role === 'system') return false;
        // Exclude empty assistant messages
        if (msg.role === 'assistant' && msg.content.trim() === '') return false;

        return true;
      })
      .map(
        (msg): UnrecordedMessage => ({
          role: msg.role,
          content: msg.content,
          trace: msg.trace,
          extraData: msg.extraData,
          llmType: msg.llmType,
          metadata: msg.metadata,
        })
      );

    const request: AgentCoreRuntimeRequest = {
      agentRuntimeArn,
      sessionId,
      qualifier,
      system_prompt:
        getCurrentSystemContext() || 'You are a helpful assistant.',
      prompt: userPrompt,
      previousMessages, // Pass the raw messages to be converted in useAgentCoreApi
      model,
      files, // Pass the uploaded files - they will be converted to Strands format in useAgentCoreApi
      userId,
      mcpServers,
      agentId,
      codeExecutionEnabled,
      webSearchEnabled,
    };

    await postMessage(request);
  };

  const isAgentCoreEnabled = () => {
    return agentCoreEnabled;
  };

  const getGenericRuntime = () => {
    return agentCoreGenericRuntime;
  };

  const getAgentBuilderRuntime = () => {
    return agentCoreAgentBuilderRuntime;
  };

  const getExternalRuntimes = () => {
    return agentCoreExternalRuntimes;
  };

  const getAllAvailableRuntimes = (): AgentCoreConfiguration[] => {
    const allRuntimes: AgentCoreConfiguration[] = [];

    // Add generic runtime if available
    if (agentCoreGenericRuntime) {
      allRuntimes.push(agentCoreGenericRuntime);
    }

    // Add external runtimes
    allRuntimes.push(...agentCoreExternalRuntimes);

    return allRuntimes;
  };

  const getAllAvailableRuntimeArns = (): string[] => {
    return getAllAvailableRuntimes().map((runtime) => runtime.arn);
  };

  return {
    getModelId,
    setModelId,
    init,
    getCurrentSystemContext,
    updateSystemContext,
    rawMessages,
    messages,
    isEmpty,
    clear,
    loading,
    invokeAgentRuntime,
    isAgentCoreEnabled,
    getGenericRuntime,
    getAgentBuilderRuntime,
    getExternalRuntimes,
    getAllAvailableRuntimes,
    getAllAvailableRuntimeArns,
  };
};

export { useAgentCore };
