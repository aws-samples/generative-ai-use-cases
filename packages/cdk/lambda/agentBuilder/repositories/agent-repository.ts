/**
 * Agent Repository
 *
 * DynamoDB Key Design:
 *
 * 1. User Agent Records:
 *    - PK: agent#{userId}
 *    - SK: agent#{agentId}
 *    - Purpose: Store user's own agents
 *    - Access: Direct access by userId + agentId
 *
 * 2. Public Agent Records (Denormalized):
 *    - PK: public-agents
 *    - SK: public#{agentId}
 *    - Purpose: Store public agents for discovery
 *    - Access: Query all public agents or get specific public agent
 *    - Note: Contains full agent data with public-specific keys
 *
 * 3. Favorite Records:
 *    - PK: agent#{userId}
 *    - SK: favorite#{agentId}
 *    - Purpose: Track user's favorite agents
 *    - Access: Query user's favorites or check specific favorite
 *    - Additional Fields: createdBy (for optimization), createdAt
 *
 * Key Benefits:
 * - Single table design with efficient access patterns
 * - BatchGetItem optimization for multiple record retrieval
 * - Denormalized public records for fast public queries
 * - Favorite records with createdBy for direct agent access
 *
 * Access Patterns:
 * 1. Get user's agents: Query PK=agent#{userId}, SK begins_with agent#
 * 2. Get public agents: Query PK=public-agents, SK begins_with public#
 * 3. Get user's favorites: Query PK=agent#{userId}, SK begins_with favorite#
 * 4. Get specific agent: BatchGet user + public locations
 * 5. Check favorite status: BatchGet favorite records for specific agents
 */

import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { v7 as uuidv7 } from 'uuid';
import {
  AgentInTable,
  AgentAsOutput,
  AgentContent,
  RepositoryListAgentsResponse,
} from 'generative-ai-use-cases';

const TABLE_NAME: string = process.env.USECASE_TABLE_NAME!;
const dynamoDb = new DynamoDBClient({});
const dynamoDbDocument = DynamoDBDocumentClient.from(dynamoDb);

// Get agent by agentId with userId context (optimized with BatchGetItem)
const findAgentByAgentId = async (
  agentId: string,
  userId: string
): Promise<AgentInTable | null> => {
  // Use BatchGetItem to check both locations simultaneously
  const result = await dynamoDbDocument.send(
    new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: [
            { id: `agent#${userId}`, dataType: `agent#${agentId}` },
            { id: 'public-agents', dataType: `public#${agentId}` },
          ],
        },
      },
    })
  );

  if (!result.Responses?.[TABLE_NAME]) {
    return null;
  }

  // Prioritize user's own agent over public agent
  for (const item of result.Responses[TABLE_NAME]) {
    if (item.id === `agent#${userId}`) {
      return item as AgentInTable;
    }
  }

  // If no user agent found, return public agent with key mapping
  for (const item of result.Responses[TABLE_NAME]) {
    if (item.id === 'public-agents') {
      return {
        ...item,
        id: `agent#${item.createdBy}`,
        dataType: `agent#${item.agentId}`,
      } as AgentInTable;
    }
  }

  return null;
};

// Get agent list by userId
const findAgentsByUserId = async (
  userId: string,
  exclusiveStartKey?: string,
  limit: number = 12
): Promise<{ agents: AgentInTable[]; lastEvaluatedKey?: string }> => {
  const startKey = exclusiveStartKey
    ? JSON.parse(Buffer.from(exclusiveStartKey, 'base64').toString())
    : undefined;

  const result = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression:
        '#id = :id and begins_with(#dataType, :dataTypePrefix)',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#dataType': 'dataType',
      },
      ExpressionAttributeValues: {
        ':id': `agent#${userId}`,
        ':dataTypePrefix': 'agent#',
      },
      ScanIndexForward: false,
      Limit: Math.min(limit, 100),
      ExclusiveStartKey: startKey,
    })
  );

  const agents = (result.Items || []) as AgentInTable[];

  return {
    agents,
    lastEvaluatedKey: result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined,
  };
};

// Get favorites by userId
const findFavoritesByUserId = async (
  userId: string,
  exclusiveStartKey?: string,
  limit: number = 12
): Promise<{
  favorites: Array<{ dataType: string; agentId: string; createdBy: string }>;
  lastEvaluatedKey?: string;
}> => {
  const startKey = exclusiveStartKey
    ? JSON.parse(Buffer.from(exclusiveStartKey, 'base64').toString())
    : undefined;

  const result = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression:
        '#id = :id and begins_with(#dataType, :dataTypePrefix)',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#dataType': 'dataType',
      },
      ExpressionAttributeValues: {
        ':id': `agent#${userId}`,
        ':dataTypePrefix': 'favorite#',
      },
      ScanIndexForward: false,
      Limit: Math.min(limit, 100),
      ExclusiveStartKey: startKey,
    })
  );

  const favorites = (result.Items || []).map((item) => ({
    dataType: item.dataType,
    agentId: item.dataType.replace('favorite#', ''),
    createdBy: item.createdBy || '',
  }));

  return {
    favorites,
    lastEvaluatedKey: result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined,
  };
};

// Get agents by favorites (optimized with single BatchGetItem)
const findAgentsByFavorites = async (
  favorites: Array<{ agentId: string; createdBy: string }>,
  userId: string
): Promise<AgentInTable[]> => {
  if (favorites.length === 0) return [];

  // Build all keys for single BatchGetItem call
  const allKeys = favorites.map(({ agentId, createdBy }) => {
    if (createdBy === userId) {
      return { id: `agent#${userId}`, dataType: `agent#${agentId}` };
    } else {
      return { id: 'public-agents', dataType: `public#${agentId}` };
    }
  });

  // Single BatchGetItem call for all agents
  const result = await dynamoDbDocument.send(
    new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: allKeys,
        },
      },
    })
  );

  if (!result.Responses?.[TABLE_NAME]) {
    return [];
  }

  // Map results to AgentInTable format
  const agents = result.Responses[TABLE_NAME].map((item) => {
    // Check if it's a public agent record (needs key mapping)
    if (item.id === 'public-agents') {
      return {
        ...item,
        id: `agent#${item.createdBy}`,
        dataType: `agent#${item.agentId}`,
      } as AgentInTable;
    } else {
      // User agent record (already in correct format)
      return item as AgentInTable;
    }
  });

  return agents;
};

// Manage public agent record
const managePublicAgentRecord = async (
  agentId: string,
  isPublic: boolean,
  agentData?: AgentInTable
): Promise<void> => {
  const key = { id: 'public-agents', dataType: `public#${agentId}` };

  console.log(
    `managePublicAgentRecord: agentId=${agentId}, isPublic=${isPublic}, hasAgentData=${!!agentData}`
  );

  if (isPublic && agentData) {
    // Add/update public record with full data, but preserve the public record keys
    console.log(`Creating/updating public record for agent ${agentId}`);
    await dynamoDbDocument.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...agentData,
          ...key,
        },
      })
    );
    console.log(`Public record created/updated for agent ${agentId}`);
  } else {
    // Remove public record
    console.log(`Removing public record for agent ${agentId}`);
    await dynamoDbDocument.send(
      new DeleteCommand({ TableName: TABLE_NAME, Key: key })
    );
    console.log(`Public record removed for agent ${agentId}`);
  }
};

// Get all public agents
export const listPublicAgents = async (): Promise<AgentInTable[]> => {
  const result = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression:
        '#id = :id AND begins_with(#dataType, :dataTypePrefix)',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#dataType': 'dataType',
      },
      ExpressionAttributeValues: {
        ':id': 'public-agents',
        ':dataTypePrefix': 'public#',
      },
    })
  );

  return (result.Items || []).map(
    (item) =>
      ({
        ...item,
        id: `agent#${item.createdBy}`,
        dataType: `agent#${item.agentId}`,
      }) as AgentInTable
  );
};

export const createAgent = async (
  userId: string,
  content: AgentContent
): Promise<AgentAsOutput> => {
  const agentId = uuidv7();
  const now = new Date().toISOString();

  const item: AgentInTable = {
    id: `agent#${userId}`,
    dataType: `agent#${agentId}`,
    agentId,
    name: content.name,
    description: content.description || '',
    systemPrompt: content.systemPrompt,
    modelId: content.modelId,
    mcpServers: content.mcpServers,
    codeExecutionEnabled: content.codeExecutionEnabled ?? false,
    webSearchEnabled: content.webSearchEnabled ?? false,
    tags: content.tags || [],
    isPublic: content.isPublic ?? false,
    starCount: 0,
    createdAt: now,
    updatedAt: now,
    createdByEmail: content.createdByEmail,
    createdBy: userId,
  };

  await dynamoDbDocument.send(
    new PutCommand({ TableName: TABLE_NAME, Item: item })
  );

  if (item.isPublic) {
    await managePublicAgentRecord(agentId, true, item);
  }

  return { ...item, isMyAgent: true };
};

export const getAgent = async (
  userId: string,
  agentId: string
): Promise<AgentAsOutput | null> => {
  const agent = await findAgentByAgentId(agentId, userId);
  if (!agent) return null;

  const isMyAgent = agent.createdBy === userId;

  // Access control: must be my agent or public
  if (!isMyAgent && !agent.isPublic) {
    return null;
  }

  return { ...agent, isMyAgent };
};

export const listAgents = async (
  userId: string,
  exclusiveStartKey?: string,
  limit?: number
): Promise<RepositoryListAgentsResponse> => {
  const { agents, lastEvaluatedKey } = await findAgentsByUserId(
    userId,
    exclusiveStartKey,
    limit
  );

  return {
    data: agents.map((agent) => ({ ...agent, isMyAgent: true })),
    lastEvaluatedKey,
  };
};

export const updateAgent = async (
  userId: string,
  agentId: string,
  content: AgentContent
): Promise<void> => {
  const agent = await findAgentByAgentId(agentId, userId);
  if (!agent || agent.createdBy !== userId) {
    throw new Error(`Agent not found or access denied: ${agentId}`);
  }

  const now = new Date().toISOString();
  const wasPublic = agent.isPublic;
  const isNowPublic = content.isPublic ?? false;

  // Update main agent record
  await dynamoDbDocument.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id: agent.id, dataType: agent.dataType },
      UpdateExpression:
        'set #name = :name, description = :description, systemPrompt = :systemPrompt, modelId = :modelId, mcpServers = :mcpServers, codeExecutionEnabled = :codeExecutionEnabled, webSearchEnabled = :webSearchEnabled, tags = :tags, isPublic = :isPublic, updatedAt = :updatedAt, createdByEmail = :createdByEmail',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':name': content.name,
        ':description': content.description || '',
        ':systemPrompt': content.systemPrompt,
        ':modelId': content.modelId,
        ':mcpServers': content.mcpServers,
        ':codeExecutionEnabled': content.codeExecutionEnabled ?? false,
        ':webSearchEnabled': content.webSearchEnabled ?? false,
        ':tags': content.tags || [],
        ':isPublic': isNowPublic,
        ':updatedAt': now,
        ':createdByEmail': content.createdByEmail,
      },
    })
  );

  // Update public record if needed
  const updatedAgent: AgentInTable = {
    ...agent,
    ...content,
    description: content.description || '',
    codeExecutionEnabled: content.codeExecutionEnabled ?? false,
    webSearchEnabled: content.webSearchEnabled ?? false,
    tags: content.tags || [],
    isPublic: isNowPublic,
    updatedAt: now,
  };

  if (wasPublic !== isNowPublic || isNowPublic) {
    await managePublicAgentRecord(agentId, isNowPublic, updatedAgent);
  }
};

export const deleteAgent = async (
  userId: string,
  agentId: string
): Promise<void> => {
  const agent = await findAgentByAgentId(agentId, userId);
  if (!agent || agent.createdBy !== userId) {
    throw new Error(`Agent not found or access denied: ${agentId}`);
  }

  await dynamoDbDocument.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id: agent.id, dataType: agent.dataType },
    })
  );

  if (agent.isPublic) {
    await managePublicAgentRecord(agentId, false);
  }
};

export const listAgentsWithFavorites = async (
  userId: string,
  exclusiveStartKey?: string,
  limit: number = 12
): Promise<{
  data: (AgentAsOutput & { isFavorite: boolean })[];
  lastEvaluatedKey?: string;
}> => {
  // First get the agents
  const agentsResult = await findAgentsByUserId(
    userId,
    exclusiveStartKey,
    limit
  );

  if (agentsResult.agents.length === 0) {
    return {
      data: [],
      lastEvaluatedKey: agentsResult.lastEvaluatedKey,
    };
  }

  // Build favorite keys for the specific agents we retrieved
  const favoriteKeys = agentsResult.agents.map((agent) => ({
    id: `agent#${userId}`,
    dataType: `favorite#${agent.agentId}`,
  }));

  // BatchGetItem to check favorite status for these specific agents
  const favoriteResult = await dynamoDbDocument.send(
    new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: favoriteKeys,
        },
      },
    })
  );

  // Create a set of favorited agent IDs for quick lookup
  const favoritedAgentIds = new Set(
    (favoriteResult.Responses?.[TABLE_NAME] || []).map((item) =>
      item.dataType.replace('favorite#', '')
    )
  );

  return {
    data: agentsResult.agents.map((agent) => ({
      ...agent,
      isMyAgent: true,
      isFavorite: favoritedAgentIds.has(agent.agentId),
    })),
    lastEvaluatedKey: agentsResult.lastEvaluatedKey,
  };
};

export const listPublicAgentsWithFavorites = async (
  userId: string,
  limit: number = 50
): Promise<(AgentInTable & { isFavorite: boolean; isMyAgent: boolean })[]> => {
  // Use the paginated version with a reasonable default limit
  const result = await listPublicAgentsWithFavoritesPaginated(
    userId,
    undefined,
    limit
  );
  return result.data;
};

export const listPublicAgentsWithFavoritesPaginated = async (
  userId: string,
  exclusiveStartKey?: string,
  limit: number = 12
): Promise<{
  data: (AgentAsOutput & { isFavorite: boolean; isMyAgent: boolean })[];
  lastEvaluatedKey?: string;
}> => {
  const startKey = exclusiveStartKey
    ? JSON.parse(Buffer.from(exclusiveStartKey, 'base64').toString())
    : undefined;

  // First get the public agents
  const publicResult = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression:
        '#id = :id AND begins_with(#dataType, :dataTypePrefix)',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#dataType': 'dataType',
      },
      ExpressionAttributeValues: {
        ':id': 'public-agents',
        ':dataTypePrefix': 'public#',
      },
      ScanIndexForward: false,
      Limit: Math.min(limit, 100),
      ExclusiveStartKey: startKey,
    })
  );

  const agents = (publicResult.Items || []).map(
    (item) =>
      ({
        ...item,
        id: `agent#${item.createdBy}`,
        dataType: `agent#${item.agentId}`,
      }) as AgentInTable
  );

  if (agents.length === 0) {
    return {
      data: [],
      lastEvaluatedKey: publicResult.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(publicResult.LastEvaluatedKey)).toString(
            'base64'
          )
        : undefined,
    };
  }

  // Build favorite keys for the specific public agents we retrieved
  const favoriteKeys = agents.map((agent) => ({
    id: `agent#${userId}`,
    dataType: `favorite#${agent.agentId}`,
  }));

  // BatchGetItem to check favorite status for these specific agents
  const favoriteResult = await dynamoDbDocument.send(
    new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: favoriteKeys,
        },
      },
    })
  );

  // Create a set of favorited agent IDs for quick lookup
  const favoritedAgentIds = new Set(
    (favoriteResult.Responses?.[TABLE_NAME] || []).map((item) =>
      item.dataType.replace('favorite#', '')
    )
  );

  return {
    data: agents.map((agent) => ({
      ...agent,
      isFavorite: favoritedAgentIds.has(agent.agentId),
      isMyAgent: agent.createdBy === userId,
    })),
    lastEvaluatedKey: publicResult.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(publicResult.LastEvaluatedKey)).toString(
          'base64'
        )
      : undefined,
  };
};

export const listFavoriteAgents = async (
  userId: string,
  exclusiveStartKey?: string,
  limit?: number
): Promise<{ data: AgentAsOutput[]; lastEvaluatedKey?: string }> => {
  const favoritesResult = await findFavoritesByUserId(
    userId,
    exclusiveStartKey,
    limit
  );

  const agents = await findAgentsByFavorites(favoritesResult.favorites, userId);

  // Create a map for quick agent lookup
  const agentMap = new Map(agents.map((agent) => [agent.agentId, agent]));

  // Maintain the order from favorites and include status information
  const orderedAgents = favoritesResult.favorites.map((favorite) => {
    const agent = agentMap.get(favorite.agentId);

    if (!agent) {
      // Agent was deleted - create a placeholder with minimal info
      return {
        id: `agent#unknown`,
        dataType: `agent#${favorite.agentId}`,
        agentId: favorite.agentId,
        name: 'Deleted Agent',
        description: 'This agent has been deleted',
        systemPrompt: '',
        modelId: '',
        mcpServers: [],
        codeExecutionEnabled: false,
        webSearchEnabled: false,
        tags: [],
        isPublic: false,
        starCount: 0,
        createdAt: '',
        updatedAt: '',
        createdBy: favorite.createdBy || '',
        createdByEmail: '',
        isMyAgent: false,
        status: 'deleted' as const,
      };
    }

    // Agent exists but check accessibility
    const isMyAgent = agent.createdBy === userId;
    let status: 'available' | 'private' = 'available';

    if (!isMyAgent && !agent.isPublic) {
      status = 'private';
    }

    return {
      ...agent,
      isMyAgent,
      status,
    };
  });

  return {
    data: orderedAgents,
    lastEvaluatedKey: favoritesResult.lastEvaluatedKey,
  };
};

export const isFavoriteAgent = async (
  userId: string,
  agentId: string
): Promise<boolean> => {
  const result = await dynamoDbDocument.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: `agent#${userId}`, dataType: `favorite#${agentId}` },
      ProjectionExpression: '#id', // Only need to check existence
      ExpressionAttributeNames: { '#id': 'id' },
    })
  );
  return !!result.Item;
};

export const toggleFavorite = async (
  userId: string,
  agentId: string
): Promise<{ isFavorite: boolean }> => {
  const key = { id: `agent#${userId}`, dataType: `favorite#${agentId}` };

  // Use BatchGetItem to get both favorite status and agent info simultaneously
  const result = await dynamoDbDocument.send(
    new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: [
            key,
            { id: `agent#${userId}`, dataType: `agent#${agentId}` },
            { id: 'public-agents', dataType: `public#${agentId}` },
          ],
        },
      },
    })
  );

  const items = result.Responses?.[TABLE_NAME] || [];
  const existingFavorite = items.find(
    (item) => item.id === key.id && item.dataType === key.dataType
  );

  // Find agent (prioritize user's own agent)
  let agent = items.find(
    (item) =>
      item.id === `agent#${userId}` && item.dataType === `agent#${agentId}`
  );
  if (!agent) {
    agent = items.find((item) => item.id === 'public-agents');
    if (agent) {
      // Map public agent to standard format
      agent = {
        ...agent,
        id: `agent#${agent.createdBy}`,
        dataType: `agent#${agent.agentId}`,
      };
    }
  }

  const updateOperations = [];

  if (existingFavorite) {
    // Remove from favorites - always allow this operation (even for deleted agents)
    updateOperations.push(
      dynamoDbDocument.send(
        new DeleteCommand({ TableName: TABLE_NAME, Key: key })
      )
    );

    // Only update star count if agent still exists
    if (agent) {
      updateOperations.push(
        dynamoDbDocument.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id: agent.id, dataType: agent.dataType },
            UpdateExpression: 'ADD starCount :dec',
            ExpressionAttributeValues: { ':dec': -1 },
          })
        )
      );

      // Update public record if agent is public
      if (agent.isPublic) {
        updateOperations.push(
          dynamoDbDocument.send(
            new UpdateCommand({
              TableName: TABLE_NAME,
              Key: { id: 'public-agents', dataType: `public#${agentId}` },
              UpdateExpression: 'ADD starCount :dec',
              ExpressionAttributeValues: { ':dec': -1 },
            })
          )
        );
      }
    }

    await Promise.all(updateOperations);
    return { isFavorite: false };
  } else {
    // Cannot add deleted/non-existent agents to favorites
    if (!agent) {
      throw new Error(
        `Cannot add deleted or non-existent agent to favorites: ${agentId}`
      );
    }

    // Add to favorites and increment star count
    updateOperations.push(
      dynamoDbDocument.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            ...key,
            agentId,
            createdBy: agent.createdBy,
            createdAt: new Date().toISOString(),
          },
        })
      ),
      dynamoDbDocument.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id: agent.id, dataType: agent.dataType },
          UpdateExpression: 'ADD starCount :inc',
          ExpressionAttributeValues: { ':inc': 1 },
        })
      )
    );

    // Update public record if agent is public
    if (agent.isPublic) {
      updateOperations.push(
        dynamoDbDocument.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id: 'public-agents', dataType: `public#${agentId}` },
            UpdateExpression: 'ADD starCount :inc',
            ExpressionAttributeValues: { ':inc': 1 },
          })
        )
      );
    }

    await Promise.all(updateOperations);
    return { isFavorite: true };
  }
};
