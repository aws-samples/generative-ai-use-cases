import { Model } from './message';

export type AgentCoreConfiguration = {
  name: string;
  arn: string;
};

// AgentCore Runtime Request (compatible with Strands)
export type AgentCoreRequest = StrandsRequest;

// ===
// Strands type definition
// https://github.com/strands-agents/sdk-python/blob/main/src/strands/types
// ===

// Strands Agent(...) parameter
export type StrandsRequest = {
  systemPrompt: string;
  prompt: StrandsContentBlock[];
  messages: StrandsMessage[];
  model: Model;
};

// Strands format response
export type StrandsResponse = {
  message?: StrandsMessage;
};

// Strands role type (system is not included)
export type StrandsRole = 'user' | 'assistant';

// Strands format message
export type StrandsMessage = {
  role: StrandsRole;
  content: StrandsContentBlock[];
};

// Content blocks based on the Python SDK structure
// Each content block is a dictionary with specific keys, not a discriminated union with a type field

// Text content block
export type StrandsTextBlock = {
  text: string;
};

// Image content block
export type StrandsImageBlock = {
  image: {
    format?: 'png' | 'jpeg' | 'gif' | 'webp';
    source?: {
      bytes: string;
    };
  };
};

// Document content block
export type StrandsDocumentBlock = {
  document: {
    // Document properties
    format?:
      | 'pdf'
      | 'csv'
      | 'doc'
      | 'docx'
      | 'xls'
      | 'xlsx'
      | 'html'
      | 'txt'
      | 'md';
    name?: string;
    source?: {
      bytes: string;
    };
  };
};

// Video content block
export type StrandsVideoBlock = {
  video: {
    format?:
      | 'flv'
      | 'mkv'
      | 'mov'
      | 'mpeg'
      | 'mpg'
      | 'mp4'
      | 'three_gp'
      | 'webm'
      | 'wmv';
    source?: {
      bytes: string;
    };
  };
};

// Tool use content block
export type StrandsToolUseBlock = {
  toolUse: {
    name: string;
    input: Record<string, unknown>;
  };
};

// Tool result content block
export type StrandsToolResultBlock = {
  toolResult: {
    content: unknown;
  };
};

// Guard content block
export type StrandsGuardContentBlock = {
  guardContent: {
    // Guard content properties
    content?: string;
  };
};

// Cache point content block
export type StrandsCachePointBlock = {
  cachePoint: {
    // Cache point properties
    id?: string;
  };
};

// Reasoning content block
export type StrandsReasoningContentBlock = {
  reasoningContent: {
    // Reasoning content properties
    content?: string;
  };
};

// Citations content block
export type StrandsCitationsContentBlock = {
  citationsContent: {
    // Citations content properties
    citations?: any[];
  };
};

// Union type for all content blocks
export type StrandsContentBlock =
  | StrandsTextBlock
  | StrandsImageBlock
  | StrandsDocumentBlock
  | StrandsVideoBlock
  | StrandsToolUseBlock
  | StrandsToolResultBlock
  | StrandsGuardContentBlock
  | StrandsCachePointBlock
  | StrandsReasoningContentBlock
  | StrandsCitationsContentBlock;
