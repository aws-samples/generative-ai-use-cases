import { StreamingChunk } from 'generative-ai-use-cases';

// JSONL Format
export const streamingChunk = (chunk: StreamingChunk): string => {
  return JSON.stringify(chunk) + '\n';
};
