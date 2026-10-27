import { UnrecordedMessage, Model } from './message';

// MCP Server Configuration (for internal use only)
export type MCPServerConfig = {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  description?: string;
};

// MCP Server Reference (what users specify)
export type MCPServerReference = string;

// Common items for all agent data
// Table: PartitionKey=id, SortKey=dataType
export type AgentCommon = {
  id: string; // agent#{userId}
  dataType: string; // agent#{agentId}
  agentId: string;
};

// Agent content (request type for creating or updating Agent)
export type AgentContent = {
  name: string;
  description?: string;
  systemPrompt: string;
  mcpServers: MCPServerReference[]; // Changed to string array
  modelId: string;
  codeExecutionEnabled?: boolean;
  webSearchEnabled?: boolean;
  tags?: string[];
  isPublic?: boolean;
  createdByEmail?: string;
};

// Content recorded in Table
export type AgentInTable = AgentCommon &
  AgentContent & {
    description: string; // Required in table
    codeExecutionEnabled: boolean;
    webSearchEnabled: boolean;
    isPublic: boolean;
    tags: string[];
    starCount: number; // Number of users who favorited this agent
    createdAt: string;
    updatedAt: string;
    createdBy: string; // User ID of the agent creator
  };

// Content returned to Frontend
// isFavorite, isMyAgent are dynamically added
export type AgentAsOutput = AgentInTable & {
  isFavorite?: boolean;
  isMyAgent: boolean;
  status?: 'available' | 'deleted' | 'private' | 'inaccessible';
};

// Agent Configuration for API responses
export type AgentConfiguration = Omit<AgentAsOutput, 'id' | 'dataType'> & {
  shareId?: string;
  starCount: number;
  createdBy: string;
};

// API Request Types
export type CreateAgentRequest = AgentContent;

export type UpdateAgentRequest = CreateAgentRequest & {
  agentId: string;
};

export type CloneAgentRequest = {
  sourceAgentId: string;
  name?: string;
};

// API Response Types
export type CreateAgentResponse = {
  agent: AgentConfiguration;
};

export type UpdateAgentResponse = {
  agent: AgentConfiguration;
};

export type DeleteAgentResponse = {
  success: boolean;
};

export type CloneAgentResponse = {
  success: boolean;
  agent: AgentConfiguration;
  missingDependencies?: string[];
  error?: string;
};

export type ListAgentsRequest = {
  limit?: number;
  nextToken?: string;
  type?: 'my' | 'public' | 'favorites';
};

export type ListAgentsResponse = {
  agents: AgentConfiguration[];
  nextToken?: string;
  totalCount?: number;
  type: 'my' | 'public' | 'favorites';
  // For SWR Infinite compatibility
  data?: AgentConfiguration[];
  lastEvaluatedKey?: string;
};

// Base agent response (common fields for sharing/importing)
export type BaseAgentResponse = {
  agentId: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  mcpServers: MCPServerReference[]; // Changed to string array
  codeExecutionEnabled: boolean;
  webSearchEnabled: boolean;
  tags: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

// Shared Agent Response (for getSharedAgent)
export type SharedAgentResponse = BaseAgentResponse & {
  createdBy: string;
  createdByEmail?: string;
  isMyAgent: boolean;
};

// Clone Agent Response (for cloneAgent)
export type ClonedAgentResponse = BaseAgentResponse;

// Public Agent Item (for listPublicAgents)
export type PublicAgentItem = SharedAgentResponse & {
  isFavorite: boolean;
};

// Repository-specific response types
export type RepositoryListAgentsResponse = {
  data: AgentAsOutput[];
  lastEvaluatedKey?: string;
};

export type ListFavoriteAgentsResponse = {
  data: AgentAsOutput[];
  lastEvaluatedKey?: string;
};

// Validation types
export type ValidationResult<T = unknown> = {
  data?: T;
  isValid: boolean;
  error?: string;
};

// Extended types with additional fields
export type AgentWithFavorite = AgentConfiguration & {
  isFavorite: boolean;
  isMyAgent: boolean;
};

// Agent Builder State Types
export type AgentBuilderState = {
  agents: AgentConfiguration[];
  currentAgent?: AgentConfiguration;
  loading: boolean;
  error?: string;
};

// Agent Core Runtime Request Types
export type AgentCoreRuntimeRequest = {
  agentRuntimeArn: string;
  sessionId?: string;
  qualifier?: string;
  system_prompt?: string; // Keep this name for backward compatibility with useAgentCore
  mode?: 'technical-research' | 'mini-research' | 'general-research'; // Research agent mode
  prompt: string; // User prompt as string
  previousMessages?: UnrecordedMessage[]; // Raw messages that will be converted to Strands format
  model: Model;
  files?: File[]; // Added support for file uploads
  userId?: string; // User ID for MCP server management
  mcpServers?: MCPServerReference[]; // Changed to string array
  agentId?: string; // Agent ID for logging/tracking
  codeExecutionEnabled?: boolean; // Code execution setting
  webSearchEnabled?: boolean; // Web search setting
};
