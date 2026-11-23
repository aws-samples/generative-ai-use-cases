import { useCallback } from 'react';
import useChat from './useChat';
import useChatApi from './useChatApi';
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
  InvokeAgentRuntimeCommandInput,
} from '@aws-sdk/client-bedrock-agentcore';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { fetchAuthSession } from 'aws-amplify/auth';
import {
  AgentCoreRequest,
  Model,
  UnrecordedMessage,
  StrandsContentBlock,
  AgentCoreRuntimeRequest,
} from 'generative-ai-use-cases';
import {
  StrandsStreamProcessor,
  convertToStrandsFormat,
  convertFilesToStrandsContentBlocks,
  makeDocumentNamesUnique,
} from '../utils/strandsUtils';
import { getRegionFromArn } from '../utils/arnUtils';
import { invokesWithToken } from '../utils/agentCoreAuth';

// Get environment variables
const region = import.meta.env.VITE_APP_REGION as string;
const modelRegion = import.meta.env.VITE_APP_MODEL_REGION as string;
const identityPoolId = import.meta.env.VITE_APP_IDENTITY_POOL_ID as string;
const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID as string;
/**
 * Invoke a runtime with a bearer token rather than a signature.
 *
 * The SDK signs with SigV4 and offers no bearer scheme, so a runtime guarded
 * by a JWT authorizer has to be called over plain HTTP. The shape of what
 * comes back is kept the same as the SDK's, so the caller reads one stream
 * either way.
 */
const invokeWithToken = async (
  input: InvokeAgentRuntimeCommandInput,
  clientRegion: string,
  token: string
): Promise<{ response?: ReadableStream<Uint8Array> }> => {
  // The ARN sits in the path, so its colons and slashes have to survive
  // encoding rather than be read as separators.
  const arn = encodeURIComponent(input.agentRuntimeArn as string);
  const qualifier = encodeURIComponent(input.qualifier as string);
  const url = `https://bedrock-agentcore.${clientRegion}.amazonaws.com/runtimes/${arn}/invocations?qualifier=${qualifier}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(input.runtimeSessionId
        ? {
            'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id':
              input.runtimeSessionId,
          }
        : {}),
    },
    body: input.payload as string,
  });

  if (!res.ok) {
    // Without the body an authorizer rejection is an opaque 403: the reason
    // it gives is the only thing that separates a bad token from a runtime
    // that was never given an authorizer at all.
    throw new Error(
      `InvokeAgentRuntime failed: ${res.status} ${await res.text()}`
    );
  }

  return { response: res.body ?? undefined };
};

const useAgentCoreApi = (id: string) => {
  const {
    loading,
    setLoading,
    pushMessage,
    popMessage,
    createChatIfNotExist,
    addChunkToAssistantMessage,
    addMessageIdsToUnrecordedMessages,
    replaceMessages,
    setPredictedTitle,
  } = useChat(id);
  const { createMessages } = useChatApi();

  // Create a stream processor instance that maintains state across chunks
  const streamProcessor = useCallback(() => new StrandsStreamProcessor(), []);

  // Process a chunk of Strands event data and add it to the assistant message
  const processChunk = useCallback(
    (
      eventText: string,
      model: Model,
      processor: StrandsStreamProcessor,
      isResearchAgent: boolean = false
    ) => {
      // Set research agent flag if this is the first chunk
      if (isResearchAgent) {
        processor.setResearchAgent(true);
      }

      const processed = processor.processEvent(eventText);

      if (processed) {
        if (processed.text || processed.trace || processed.metadata) {
          addChunkToAssistantMessage(
            processed.text || '',
            processed.trace || undefined,
            model,
            processed.metadata
          );
        }
      }
    },
    [addChunkToAssistantMessage]
  );

  // Convert messages to Strands format
  const convertMessagesToStrandsFormat = useCallback(
    (messages: UnrecordedMessage[]) => {
      return convertToStrandsFormat(messages);
    },
    []
  );

  const postMessage = useCallback(
    async (req: AgentCoreRuntimeRequest) => {
      setLoading(true);
      let isFirstChunk = true;

      // Create a new stream processor for this request
      const processor = streamProcessor();

      // Check if this is a research agent request
      const isResearchAgent =
        req.mode !== undefined &&
        ['technical-research', 'mini-research', 'general-research'].includes(
          req.mode
        );

      try {
        pushMessage('user', req.prompt);
        pushMessage('assistant', 'Thinking...');

        // The Identity Pool exchanges the ID token for credentials; the JWT
        // authorizer is configured with allowedClients, which is a claim of the
        // access token. Which one is needed depends on how the runtime was
        // built, so take both from the one session.
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        const accessToken = session.tokens?.accessToken?.toString();
        if (!token) {
          throw new Error('User is not authenticated');
        }

        const clientRegion = getRegionFromArn(req.agentRuntimeArn) || region;

        const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;

        // Create the BedrockAgentCore client with the determined region
        const client = new BedrockAgentCoreClient({
          region: clientRegion,
          credentials: fromCognitoIdentityPool({
            clientConfig: { region },
            identityPoolId,
            logins: {
              [providerName]: token,
            },
          }),
        });

        // Convert previous messages to Strands format if provided
        const strandsMessages = req.previousMessages
          ? convertMessagesToStrandsFormat(req.previousMessages)
          : [];

        // Process files if provided and convert them to Strands content blocks
        const promptBlocks: StrandsContentBlock[] = [{ text: req.prompt }];

        if (req.files && req.files.length > 0) {
          try {
            const fileContentBlocks = await convertFilesToStrandsContentBlocks(
              req.files
            );
            promptBlocks.push(...fileContentBlocks);
          } catch (error) {
            console.error(
              'Error converting files to Strands content blocks:',
              error
            );
          }
        }

        // Bedrock rejects a request with two documents of the same name
        const uniquelyNamed = makeDocumentNamesUnique(
          strandsMessages,
          promptBlocks
        );

        // Create the request with the exact schema: messages, systemPrompt, prompt, model, and optional fields
        const agentCoreRequest: AgentCoreRequest = {
          messages: uniquelyNamed.messages,
          system_prompt: req.system_prompt || '',
          prompt: uniquelyNamed.prompt,
          model: {
            type: 'bedrock',
            modelId:
              req.model.modelId ||
              'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
            region: req.model.region || modelRegion,
          },
          ...(req.userId && { user_id: req.userId }),
          ...(req.mcpServers && { mcp_servers: req.mcpServers }),
          ...(req.agentId && { agent_id: req.agentId }),
          ...(req.sessionId && { session_id: req.sessionId }),
          ...(req.codeExecutionEnabled !== undefined && {
            code_execution_enabled: req.codeExecutionEnabled,
          }),
          ...(req.webSearchEnabled !== undefined && {
            web_search_enabled: req.webSearchEnabled,
          }),
        };

        console.log(
          'AgentCoreRequest payload:',
          JSON.stringify(agentCoreRequest, null, 2)
        );

        const commandInput: InvokeAgentRuntimeCommandInput = {
          agentRuntimeArn: req.agentRuntimeArn,
          ...(req.sessionId ? { runtimeSessionId: req.sessionId } : {}),
          qualifier: req.qualifier || 'DEFAULT',
          payload: JSON.stringify(agentCoreRequest),
        };

        let response;
        if (invokesWithToken(req.agentRuntimeArn)) {
          if (!accessToken) {
            throw new Error('User is not authenticated');
          }
          response = await invokeWithToken(
            commandInput,
            clientRegion,
            accessToken
          );
        } else {
          response = await client.send(
            new InvokeAgentRuntimeCommand(commandInput)
          );
        }

        // Handle streaming response
        const responseWithStream = response as unknown as {
          response?: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;
          contentType?: string;
        };

        let buffer = '';

        if (responseWithStream.response) {
          const stream = responseWithStream.response;

          if (Symbol.asyncIterator in stream) {
            // Handle as async iterable
            for await (const chunk of stream as AsyncIterable<Uint8Array>) {
              if (isFirstChunk) {
                popMessage(); // Remove loading message
                pushMessage('assistant', '');
                isFirstChunk = false;
              }

              const chunkText = new TextDecoder('utf-8').decode(chunk);
              buffer += chunkText;

              // Process complete lines
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim()) {
                  let processedText = line;

                  // Handle SSE format: "data: <content>"
                  if (line.startsWith('data: ')) {
                    processedText = line.substring(6);
                  }

                  if (processedText.trim()) {
                    processChunk(
                      processedText,
                      req.model,
                      processor,
                      isResearchAgent
                    );
                  }
                }
              }
            }

            // Process any remaining buffer content
            if (buffer.trim()) {
              let processedText = buffer;
              if (buffer.startsWith('data: ')) {
                processedText = buffer.substring(6);
              }
              if (processedText.trim()) {
                processChunk(
                  processedText,
                  req.model,
                  processor,
                  isResearchAgent
                );
              }
            }
          } else {
            // Fallback: treat as single response
            if (isFirstChunk) {
              popMessage();
              pushMessage('assistant', '');
              isFirstChunk = false;
            }
            processChunk(
              JSON.stringify(response, null, 2),
              req.model,
              processor,
              isResearchAgent
            );
          }
        } else {
          // Fallback: if no response stream, stringify the entire response
          if (isFirstChunk) {
            popMessage();
            pushMessage('assistant', '');
            isFirstChunk = false;
          }
          processChunk(
            JSON.stringify(response, null, 2),
            req.model,
            processor,
            isResearchAgent
          );
        }

        // Save chat history
        const chatId = await createChatIfNotExist();
        await setPredictedTitle();
        const toBeRecordedMessages = addMessageIdsToUnrecordedMessages();
        const { messages } = await createMessages(chatId, {
          messages: toBeRecordedMessages,
        });
        replaceMessages(messages);
      } catch (error) {
        console.error('Error invoking AgentCore Runtime:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        // processChunk(`Error: ${errorMessage}`, req.model, processor);
        addChunkToAssistantMessage(
          errorMessage,
          undefined,
          req.model,
          undefined
        );
      } finally {
        setLoading(false);
      }
    },
    [
      setLoading,
      streamProcessor,
      pushMessage,
      convertMessagesToStrandsFormat,
      createChatIfNotExist,
      setPredictedTitle,
      addMessageIdsToUnrecordedMessages,
      createMessages,
      replaceMessages,
      popMessage,
      processChunk,
      addChunkToAssistantMessage,
    ]
  );

  return {
    loading,
    postMessage,
    convertMessagesToStrandsFormat,
  };
};

export default useAgentCoreApi;
