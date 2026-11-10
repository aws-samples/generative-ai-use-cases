import { FileLimit } from 'generative-ai-use-cases';

// File limits for chats that run on the AgentCore runtime
// (AgentCore chat and agents made with the agent builder).
// File size limits (Frontend → AgentCore Runtime → Bedrock Converse API):
// - AgentCore Runtime payload limit: 100MB (not a bottleneck)
// - Anthropic Claude max request size: 32MB for the entire HTTP request body
// - Nova PDF/DOCX direct upload limit: 25MB combined (model-side error if exceeded)
// - Setting to 32MB as the upper bound based on Claude's documented limit
export const agentCoreFileLimit: FileLimit = {
  accept: {
    doc: [
      '.csv',
      '.doc',
      '.docx',
      '.html',
      '.md',
      '.pdf',
      '.txt',
      '.xls',
      '.xlsx',
      '.yaml',
      '.json',
    ],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    video: [],
  },
  maxFileCount: 5,
  maxFileSizeMB: 32,
  maxImageFileCount: 5,
  maxImageFileSizeMB: 5,
  maxVideoFileCount: 0,
  maxVideoFileSizeMB: 0,
};
