import {
  AgentConfiguration,
  ListAgentsResponse,
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentAsOutput,
  CloneAgentRequest,
  ClonedAgentResponse,
} from 'generative-ai-use-cases';
import * as agentRepository from '../repositories/agent-repository';
import { getUserEmail } from '../utils/auth-utils';
import {
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from '../utils/error-handling';

/**
 * Convert AgentAsOutput to AgentConfiguration
 */
function convertToAgentConfiguration(
  agent: AgentAsOutput & { isFavorite?: boolean }
): AgentConfiguration {
  return {
    agentId: agent.agentId,
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.systemPrompt,
    mcpServers: agent.mcpServers || [],
    modelId: agent.modelId,
    codeExecutionEnabled: agent.codeExecutionEnabled || false,
    webSearchEnabled: agent.webSearchEnabled || false,
    isPublic: agent.isPublic || false,
    shareId: undefined, // Not available in AgentAsOutput
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    tags: agent.tags || [],
    starCount: agent.starCount || 0,
    createdBy: agent.id ? agent.id.split('#')[1] : 'Unknown',
    createdByEmail: agent.createdByEmail,
    isFavorite: agent.isFavorite ?? false, // Use the actual favorite status
    isMyAgent: agent.isMyAgent,
  };
}

/**
 * Create a new agent
 */
export async function createAgent(
  userId: string,
  request: CreateAgentRequest
): Promise<AgentConfiguration> {
  // MCP server names (no sanitization needed for string array)
  const mcpServerNames = request.mcpServers || [];

  // Get user email from Cognito
  const userEmail = await getUserEmail(userId);

  const agent = await agentRepository.createAgent(userId, {
    name: request.name.trim(),
    description: (request.description || '').trim(),
    systemPrompt: request.systemPrompt.trim(),
    mcpServers: mcpServerNames,
    modelId: request.modelId,
    codeExecutionEnabled: request.codeExecutionEnabled ?? false,
    webSearchEnabled: request.webSearchEnabled ?? false,
    isPublic: request.isPublic ?? false,
    tags: (request.tags || [])
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
    createdByEmail: userEmail,
  });

  console.log(`Agent created: ${agent.agentId} by user: ${userId}`);
  return convertToAgentConfiguration(agent);
}

/**
 * Get an agent by ID
 */
export async function getAgent(
  userId: string,
  agentId: string
): Promise<AgentConfiguration> {
  const agent = await agentRepository.getAgent(userId, agentId);

  if (!agent) {
    throw new NotFoundError('Agent not found');
  }

  return convertToAgentConfiguration(agent);
}

/**
 * Update an existing agent
 */
export async function updateAgent(
  userId: string,
  agentId: string,
  request: UpdateAgentRequest
): Promise<AgentConfiguration> {
  // Business validation: Check if agent exists and user owns it
  const existingAgent = await agentRepository.getAgent(userId, agentId);
  if (!existingAgent) {
    throw new NotFoundError('Agent not found');
  }

  // Version check removed - using starCount instead

  // MCP server names
  const mcpServerNames = request.mcpServers || existingAgent.mcpServers;

  // Get user email from Cognito if not provided in request
  const userEmail = request.createdByEmail || (await getUserEmail(userId));

  try {
    await agentRepository.updateAgent(userId, agentId, {
      name: request.name?.trim() || existingAgent.name,
      description: request.description?.trim() || existingAgent.description,
      systemPrompt: request.systemPrompt?.trim() || existingAgent.systemPrompt,
      mcpServers: mcpServerNames,
      modelId: request.modelId || existingAgent.modelId,
      codeExecutionEnabled:
        request.codeExecutionEnabled ??
        existingAgent.codeExecutionEnabled ??
        false,
      webSearchEnabled:
        request.webSearchEnabled ?? existingAgent.webSearchEnabled ?? false,
      tags:
        request.tags
          ?.map((tag) => tag.trim())
          .filter((tag) => tag.length > 0) || existingAgent.tags,
      isPublic: request.isPublic ?? existingAgent.isPublic ?? false,
      createdByEmail: userEmail,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Access denied')) {
      throw new ForbiddenError(
        'You do not have permission to update this agent'
      );
    }
    if (error instanceof Error && error.message.includes('Agent not found')) {
      throw new NotFoundError('Agent not found');
    }
    throw error;
  }

  // Get updated agent
  const agent = await agentRepository.getAgent(userId, agentId);
  if (!agent) {
    throw new NotFoundError('Agent not found after update');
  }

  console.log(`Agent updated: ${agentId} by user: ${userId}`);
  return convertToAgentConfiguration(agent);
}

/**
 * Delete an agent
 */
export async function deleteAgent(
  userId: string,
  agentId: string
): Promise<void> {
  // Check if agent exists first
  const existingAgent = await agentRepository.getAgent(userId, agentId);
  if (!existingAgent) {
    throw new NotFoundError('Agent not found');
  }

  try {
    await agentRepository.deleteAgent(userId, agentId);
    console.log(`Agent deleted: ${agentId} by user: ${userId}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Access denied')) {
      throw new ForbiddenError(
        'You do not have permission to delete this agent'
      );
    }
    if (error instanceof Error && error.message.includes('Agent not found')) {
      throw new NotFoundError('Agent not found');
    }
    throw error;
  }
}

/**
 * List user's agents
 */
export async function listUserAgents(
  userId: string,
  limit?: number,
  nextToken?: string
): Promise<ListAgentsResponse> {
  console.log(
    `listUserAgents service: userId=${userId}, limit=${limit}, nextToken=${nextToken}`
  );

  const result = await agentRepository.listAgentsWithFavorites(
    userId,
    nextToken,
    limit
  );

  console.log(
    `listUserAgents service result: agents=${result.data.length}, nextToken=${result.lastEvaluatedKey}`
  );

  return {
    agents: result.data.map((agent) => convertToAgentConfiguration(agent)),
    nextToken: result.lastEvaluatedKey,
    totalCount: undefined, // Remove totalCount to avoid full table scan
    type: 'my',
  };
}

/**
 * List public agents (always returns latest data)
 */
export async function listPublicAgents(
  userId: string,
  limit?: number,
  nextToken?: string
): Promise<ListAgentsResponse> {
  const result = await agentRepository.listPublicAgentsWithFavoritesPaginated(
    userId,
    nextToken,
    limit
  );

  return {
    agents: result.data.map((agent) => convertToAgentConfiguration(agent)),
    nextToken: result.lastEvaluatedKey,
    totalCount: undefined, // Remove totalCount to avoid full table scan
    type: 'public',
  };
}

/**
 * List favorite agents (always returns latest data)
 */
export async function listFavoriteAgents(
  userId: string,
  limit?: number,
  nextToken?: string
): Promise<ListAgentsResponse> {
  const result = await agentRepository.listFavoriteAgents(
    userId,
    nextToken,
    limit
  );

  return {
    agents: result.data.map((agent) => ({
      ...convertToAgentConfiguration(agent),
      isFavorite: true, // All agents in this list are favorites
      isMyAgent: agent.isMyAgent || false, // Ensure boolean type
    })),
    nextToken: result.lastEvaluatedKey,
    totalCount: undefined, // Remove totalCount to avoid full table scan
    type: 'favorites',
  };
}

/**
 * Toggle agent favorite status
 */
export async function toggleAgentFavorite(
  userId: string,
  agentId: string
): Promise<{ isFavorite: boolean }> {
  return await agentRepository.toggleFavorite(userId, agentId);
}

/**
 * Clone an agent
 */
export async function cloneAgent(
  userId: string,
  request: CloneAgentRequest
): Promise<ClonedAgentResponse> {
  // Use agent repository for consistent access pattern
  const sourceAgent = await agentRepository.getAgent(
    userId,
    request.sourceAgentId
  );

  if (!sourceAgent) {
    throw new NotFoundError('Source agent not found');
  }

  // Check if the source agent is public or owned by the user
  const isPublic = sourceAgent.isPublic ?? false;
  if (!isPublic && !sourceAgent.isMyAgent) {
    throw new UnauthorizedError('Agent is not public and you do not own it');
  }

  // Create a new agent using the repository
  const newAgent = await agentRepository.createAgent(userId, {
    name: request.name || `${sourceAgent.name} (Cloned)`,
    description: sourceAgent.description,
    systemPrompt: sourceAgent.systemPrompt,
    modelId: sourceAgent.modelId,
    mcpServers: sourceAgent.mcpServers || [],
    codeExecutionEnabled: sourceAgent.codeExecutionEnabled || false,
    webSearchEnabled: sourceAgent.webSearchEnabled || false,
    tags: sourceAgent.tags || [],
    isPublic: false, // Cloned agents are private by default
  });

  console.log(
    `Agent cloned: ${newAgent.agentId} from ${request.sourceAgentId} by user: ${userId}`
  );

  return {
    agentId: newAgent.agentId,
    name: newAgent.name,
    description: newAgent.description,
    systemPrompt: newAgent.systemPrompt,
    modelId: newAgent.modelId,
    mcpServers: newAgent.mcpServers,
    codeExecutionEnabled: newAgent.codeExecutionEnabled,
    webSearchEnabled: newAgent.webSearchEnabled,
    tags: newAgent.tags,
    isPublic: newAgent.isPublic,
    createdAt: newAgent.createdAt,
    updatedAt: newAgent.updatedAt,
  };
}
