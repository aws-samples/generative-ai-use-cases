import {
  ContentBlock,
  Message,
  SystemContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { SUPPORTED_CACHE_FIELDS } from '@generative-ai-use-cases/common';

const CACHE_POINT = {
  cachePoint: { type: 'default' },
} as ContentBlock.CachePointMember;

const SYSTEM_CACHE_POINT = {
  cachePoint: { type: 'default' },
} as SystemContentBlock.CachePointMember;

const getSupportedCacheFields = (modelId: string) => {
  // Remove CRI prefix
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
        !message.content?.some((block) => block.toolResult)
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
      content: [...(message.content || []), CACHE_POINT],
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
  return [...system, SYSTEM_CACHE_POINT];
};
