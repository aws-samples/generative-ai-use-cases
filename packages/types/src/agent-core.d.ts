import { Model } from './message';

export type AgentCoreConfiguration = {
  name: string;
  arn: string;
  description: string;
  display_name?: string;
};

// AgentCore Runtime Request (extended from Strands with additional fields)
export type AgentCoreRequest = StrandsRequest & {
  mcp_servers?: string[]; // Changed to string array
  session_id?: string;
  code_execution_enabled?: boolean;
  // The caller's Cognito id token. The runtime stores output files under its user.
  id_token?: string;
};

export type AgentCoreStreamResponse = StrandsStreamEvent;

// ===
// Strands type definition
// https://github.com/strands-agents/sdk-python/blob/main/src/strands/types
// ===

// Strands Agent(...) parameter
export type StrandsRequest = {
  system_prompt: string;
  prompt: StrandsContentBlock[];
  messages: StrandsMessage[];
  model: Model;
};

// Strands format response
export type StrandsResponse = {
  message?: StrandsMessage;
};

export type StrandsStreamResponse = {
  event: StrandsStreamEvent;
};

// Content

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
      bytes: string; // base64 encoded string. Converted to bytes in backend
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
      bytes: string; // base64 encoded string. Converted to bytes in backend
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
      bytes: string; // base64 encoded string. Converted to bytes in backend
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
    content: StrandsContentBlock[];
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

// Streaming

// Supporting types for streaming events
export type StrandsStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'tool_use';

export type StrandsUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
};

export type StrandsMetrics = {
  latencyMs?: number;
  [key: string]: any;
};

export type StrandsTrace = {
  [key: string]: any;
};

// Content block start information
export type StrandsContentBlockStart = StrandsContentBlock;

// Message start event
export type StrandsMessageStartEvent = {
  role: StrandsRole;
};

// Content block start event
export type StrandsContentBlockStartEvent = {
  contentBlockIndex?: number;
  start: StrandsContentBlockStart;
};

// Content block delta types
export type StrandsContentBlockDeltaText = {
  text: string;
};

export type StrandsContentBlockDeltaToolUse = {
  input: string;
};

export type StrandsReasoningContentBlockDelta = {
  redactedContent?: Uint8Array;
  signature?: string;
  text?: string;
};

export type StrandsContentBlockDelta = {
  reasoningContent?: StrandsReasoningContentBlockDelta;
  text?: string;
  toolUse?: StrandsContentBlockDeltaToolUse;
};

// Content block delta event
export type StrandsContentBlockDeltaEvent = {
  contentBlockIndex?: number;
  delta: StrandsContentBlockDelta;
};

// Content block stop event
export type StrandsContentBlockStopEvent = {
  contentBlockIndex?: number;
};

// Message stop event
export type StrandsMessageStopEvent = {
  additionalModelResponseFields?: any;
  stopReason: StrandsStopReason;
};

// Metadata event
export type StrandsMetadataEvent = {
  metrics?: StrandsMetrics;
  trace?: StrandsTrace;
  usage: StrandsUsage;
};

// Exception event base
export type StrandsExceptionEvent = {
  message: string;
};

// Model stream error event
export type StrandsModelStreamErrorEvent = StrandsExceptionEvent & {
  originalMessage: string;
  originalStatusCode: number;
};

// Redact content event
export type StrandsRedactContentEvent = {
  redactUserContentMessage?: string;
  redactAssistantContentMessage?: string;
};

// Main stream event type (matches the Python StreamEvent TypedDict)
export type StrandsStreamEvent = {
  contentBlockDelta?: StrandsContentBlockDeltaEvent;
  contentBlockStart?: StrandsContentBlockStartEvent;
  contentBlockStop?: StrandsContentBlockStopEvent;
  internalServerException?: StrandsExceptionEvent;
  messageStart?: StrandsMessageStartEvent;
  messageStop?: StrandsMessageStopEvent;
  metadata?: StrandsMetadataEvent;
  modelStreamErrorException?: StrandsModelStreamErrorEvent;
  redactContent?: StrandsRedactContentEvent;
  serviceUnavailableException?: StrandsExceptionEvent;
  throttlingException?: StrandsExceptionEvent;
  validationException?: StrandsExceptionEvent;
};

// Helper type to determine which event type is present
export type StrandsStreamEventType =
  | 'contentBlockDelta'
  | 'contentBlockStart'
  | 'contentBlockStop'
  | 'internalServerException'
  | 'messageStart'
  | 'messageStop'
  | 'metadata'
  | 'modelStreamErrorException'
  | 'redactContent'
  | 'serviceUnavailableException'
  | 'throttlingException'
  | 'validationException';
