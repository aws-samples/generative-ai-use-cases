import {
  ContentBlock,
  Message,
  SystemContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { PromptCacheField } from 'generative-ai-use-cases';

// https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
const SUPPORTED_CACHE_FIELDS: Record<string, PromptCacheField[]> = {
  'anthropic.claude-3-7-sonnet-20250219-v1:0': ['messages', 'system', 'tools'],
  'anthropic.claude-3-5-haiku-20241022-v1:0': ['messages', 'system', 'tools'],
  'amazon.nova-pro-v1:0': ['messages', 'system'],
  'amazon.nova-lite-v1:0': ['messages', 'system'],
  'amazon.nova-micro-v1:0': ['messages', 'system'],
};

const CACHE_POINT = {
  cachePoint: { type: 'default' },
} as ContentBlock.CachePointMember | SystemContentBlock.CachePointMember;

const getSupportedCacheFields = (modelId: string) => {
  // Remove CRI prifix
  const baseModelId = modelId.replace(/^(us|eu|apac)\./, '');
  return SUPPORTED_CACHE_FIELDS[baseModelId] || [];
};

export const applyAutoCacheToMessages = (
  messages: Message[],
  modelId: string
) => {
  const cacheFields = getSupportedCacheFields(modelId);
  if (!cacheFields.includes('messages') || messages.length === 0) {
    return messages;
  }

  // Insert cachePoint into the last two user messages (for cache read and write respectively)
  const isToolsSupported = cacheFields.includes('tools');
  const cachableIndices = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.role === 'user')
    .filter(
      ({ message }) =>
        isToolsSupported ||
        // For Amazon Nova, placing cachePoint after toolResult is not supported
        !message.content?.some((content) => content.toolResult)
    )
    .slice(-2)
    .map(({ index }) => index);

  return messages.map((message, index) => {
    if (
      !cachableIndices.includes(index) ||
      message.content?.at(-1)?.cachePoint // Already inserted
    ) {
      return message;
    }
    return {
      ...message,
      content: [
        ...(message.content || []),
        CACHE_POINT as ContentBlock.CachePointMember,
      ],
    };
  });
};

export const applyAutoCacheToSystem = (
  system: SystemContentBlock[],
  modelId: string
) => {
  const cacheFields = getSupportedCacheFields(modelId);
  if (
    !cacheFields.includes('system') ||
    system.length === 0 ||
    system.at(-1)?.cachePoint // Already inserted
  ) {
    return system;
  }
  return [...system, CACHE_POINT as SystemContentBlock.CachePointMember];
};
