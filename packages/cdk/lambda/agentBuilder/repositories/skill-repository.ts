/**
 * Skill Repository
 *
 * DynamoDB Key Design (same table as the agents):
 *
 * Skill Records:
 *   - PK: skill#{userId}
 *   - SK: skill#{skillId}
 *   - Purpose: Store a user's skills
 *   - Access: Query the user's skills, or get / batch get by skillId
 *
 * An agent keeps only the IDs of its skills (skillIds). The skills are always
 * read from the partition of the agent's creator.
 */

import {
  BatchGetCommand,
  BatchGetCommandOutput,
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
  AgentSkillContent,
  AgentSkillInTable,
  AgentSkillSummary,
} from 'generative-ai-use-cases';

const TABLE_NAME: string = process.env.USECASE_TABLE_NAME!;
const dynamoDb = new DynamoDBClient({});
const dynamoDbDocument = DynamoDBDocumentClient.from(dynamoDb);

// BatchGetItem reads at most 100 keys per call
const BATCH_GET_MAX_KEYS = 100;

const skillKey = (userId: string, skillId: string) => ({
  id: `skill#${userId}`,
  dataType: `skill#${skillId}`,
});

export const createSkill = async (
  userId: string,
  content: AgentSkillContent
): Promise<AgentSkillInTable> => {
  const skillId = uuidv7();
  const now = new Date().toISOString();
  const item: AgentSkillInTable = {
    ...skillKey(userId, skillId),
    skillId,
    name: content.name,
    description: content.description,
    instructions: content.instructions,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await dynamoDbDocument.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: 'attribute_not_exists(id)',
    })
  );

  return item;
};

export const getSkill = async (
  userId: string,
  skillId: string
): Promise<AgentSkillInTable | null> => {
  const result = await dynamoDbDocument.send(
    new GetCommand({ TableName: TABLE_NAME, Key: skillKey(userId, skillId) })
  );
  return (result.Item as AgentSkillInTable) ?? null;
};

// All the user's skills, without their instructions
export const listSkills = async (
  userId: string
): Promise<AgentSkillSummary[]> => {
  const skills: AgentSkillSummary[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await dynamoDbDocument.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression:
          '#id = :id and begins_with(#dataType, :dataTypePrefix)',
        ProjectionExpression:
          'skillId, #name, description, createdAt, updatedAt',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#dataType': 'dataType',
          '#name': 'name',
        },
        ExpressionAttributeValues: {
          ':id': `skill#${userId}`,
          ':dataTypePrefix': 'skill#',
        },
        ScanIndexForward: false,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    skills.push(...((result.Items || []) as AgentSkillSummary[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return skills;
};

// The given skills of a user, in the given order. Missing ones are left out.
export const getSkills = async (
  userId: string,
  skillIds: string[]
): Promise<AgentSkillInTable[]> => {
  const found = new Map<string, AgentSkillInTable>();

  for (let i = 0; i < skillIds.length; i += BATCH_GET_MAX_KEYS) {
    let keys: Record<string, unknown>[] | undefined = skillIds
      .slice(i, i + BATCH_GET_MAX_KEYS)
      .map((skillId) => skillKey(userId, skillId));

    while (keys && keys.length > 0) {
      const result: BatchGetCommandOutput = await dynamoDbDocument.send(
        new BatchGetCommand({
          RequestItems: { [TABLE_NAME]: { Keys: keys } },
        })
      );
      for (const item of result.Responses?.[TABLE_NAME] || []) {
        const skill = item as AgentSkillInTable;
        found.set(skill.skillId, skill);
      }
      keys = result.UnprocessedKeys?.[TABLE_NAME]?.Keys;
    }
  }

  return skillIds.flatMap((skillId) => found.get(skillId) ?? []);
};

export const updateSkill = async (
  userId: string,
  skillId: string,
  content: AgentSkillContent
): Promise<AgentSkillInTable> => {
  const result = await dynamoDbDocument.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: skillKey(userId, skillId),
      UpdateExpression:
        'set #name = :name, description = :description, instructions = :instructions, updatedAt = :updatedAt',
      ConditionExpression: 'attribute_exists(id)',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':name': content.name,
        ':description': content.description,
        ':instructions': content.instructions,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    })
  );
  return result.Attributes as AgentSkillInTable;
};

export const deleteSkill = async (
  userId: string,
  skillId: string
): Promise<void> => {
  await dynamoDbDocument.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: skillKey(userId, skillId) })
  );
};
