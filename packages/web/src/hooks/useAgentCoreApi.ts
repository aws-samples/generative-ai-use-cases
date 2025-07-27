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
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import {
  AgentCoreRequest,
  Model,
  UnrecordedMessage,
  StrandsContentBlock,
} from 'generative-ai-use-cases';
import {
  convertStrandsToGenU,
  convertToStrandsFormat,
} from '../utils/strandsUtils';

// Get environment variables
const region = import.meta.env.VITE_APP_REGION as string;
const identityPoolId = import.meta.env.VITE_APP_IDENTITY_POOL_ID as string;
const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID as string;

// Define simplified request interface for the hook
export interface AgentCoreRuntimeRequest {
  agentRuntimeArn: string;
  sessionId?: string;
  qualifier?: string;
  system_prompt?: string; // Keep this name for backward compatibility with useAgentCore
  prompt: string; // User prompt as string
  previousMessages?: UnrecordedMessage[]; // Raw messages that will be converted to Strands format
  model: Model;
  files?: File[]; // Added support for file uploads
}

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

  // Process a chunk of Strands data and add it to the assistant message
  const processChunk = useCallback(
    (chunkText: string, model: Model) => {
      // Convert Strands format to GenU format using the utility function
      const processedText = convertStrandsToGenU(chunkText);

      // Add the processed text to the assistant message
      addChunkToAssistantMessage(
        processedText,
        undefined, // Agent Core Runtime doesn't have trace
        model
      );
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

      try {
        pushMessage('user', req.prompt);
        pushMessage(
          'assistant',
          'Thinking...' // Simple loading message without translation key
        );

        // Get the ID token from the authenticated user
        const token = (await fetchAuthSession()).tokens?.idToken?.toString();

        if (!token) {
          throw new Error('User is not authenticated');
        }

        // Create the Cognito Identity client
        const cognito = new CognitoIdentityClient({ region });
        const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;

        // Create the BedrockAgentCore client
        const client = new BedrockAgentCoreClient({
          region,
          credentials: fromCognitoIdentityPool({
            client: cognito,
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

        // Process files if provided
        const promptBlocks: StrandsContentBlock[] = [{ text: req.prompt }];

        // Create the request with the exact schema: messages, systemPrompt, prompt, model
        const agentCoreRequest: AgentCoreRequest = {
          messages: strandsMessages,
          systemPrompt: req.system_prompt || '',
          prompt: promptBlocks, // Include text and file content blocks
          model: {
            type: 'bedrock', // Required by Model type
            modelId:
              req.model.modelId ||
              'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
            region: req.model.region || region,
          },
        };

        const commandInput: InvokeAgentRuntimeCommandInput = {
          agentRuntimeArn: req.agentRuntimeArn,
          ...(req.sessionId ? { runtimeSessionId: req.sessionId } : {}),
          qualifier: req.qualifier || 'DEFAULT',
          payload: JSON.stringify(agentCoreRequest),
        };
        console.log('commandInput', commandInput);

        const command = new InvokeAgentRuntimeCommand(commandInput);

        // Send the command and get the response
        const response = await client.send(command);

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

              // Process complete lines (similar to iter_lines in Python)
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                if (line.trim()) {
                  let processedText = line;

                  // Handle SSE format: "data: <content>"
                  if (line.startsWith('data: ')) {
                    processedText = line.substring(6); // Remove "data: " prefix
                  }

                  if (processedText.trim()) {
                    // Process the chunk (conversion happens in processChunk)
                    processChunk(processedText, req.model);
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
                // Process the chunk (conversion happens in processChunk)
                processChunk(processedText, req.model);
              }
            }
          } else {
            // Fallback: treat as single response
            if (isFirstChunk) {
              popMessage();
              pushMessage('assistant', '');
              isFirstChunk = false;
            }
            processChunk(JSON.stringify(response, null, 2), req.model);
          }
        } else {
          // Fallback: if no response stream, stringify the entire response
          if (isFirstChunk) {
            popMessage();
            pushMessage('assistant', '');
            isFirstChunk = false;
          }
          processChunk(JSON.stringify(response, null, 2), req.model);
        }

        // Save chat history similar to MCP
        const chatId = await createChatIfNotExist();
        await setPredictedTitle();
        const toBeRecordedMessages = addMessageIdsToUnrecordedMessages();
        const { messages } = await createMessages(chatId, {
          messages: toBeRecordedMessages,
        });
        replaceMessages(messages);
      } catch (error) {
        console.error('Error invoking AgentCore Runtime:', error);

        // Show error message to user
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        processChunk(`Error: ${errorMessage}`, req.model);
      } finally {
        setLoading(false);
      }
    },
    [
      setLoading,
      pushMessage,
      popMessage,
      processChunk,
      createChatIfNotExist,
      setPredictedTitle,
      addMessageIdsToUnrecordedMessages,
      createMessages,
      replaceMessages,
      convertMessagesToStrandsFormat,
    ]
  );

  return {
    loading,
    postMessage,
    convertMessagesToStrandsFormat,
  };
};

export default useAgentCoreApi;
