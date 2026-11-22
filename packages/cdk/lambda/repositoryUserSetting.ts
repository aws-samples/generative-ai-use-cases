import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DefaultChat, UserSettings } from 'generative-ai-use-cases';

const TABLE_NAME: string = process.env.TABLE_NAME!;
const dynamoDb = new DynamoDBClient({});
const dynamoDbDocument = DynamoDBDocumentClient.from(dynamoDb);

// One settings record per user in the main table. The sort key is fixed,
// because each user has only one. Each setting is its own attribute, so one
// setting can be changed without touching the others.
const key = (userId: string) => ({
  id: `userSetting#${userId}`,
  createdDate: 'userSetting',
});

export const getUserSettings = async (
  userId: string
): Promise<UserSettings> => {
  const res = await dynamoDbDocument.send(
    new GetCommand({ TableName: TABLE_NAME, Key: key(userId) })
  );
  const defaultChat = res.Item?.defaultChat as DefaultChat | undefined;
  return defaultChat ? { defaultChat } : {};
};

export const setDefaultChat = async (
  userId: string,
  defaultChat: DefaultChat
): Promise<void> => {
  await dynamoDbDocument.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: key(userId),
      UpdateExpression: 'SET defaultChat = :defaultChat',
      ExpressionAttributeValues: { ':defaultChat': defaultChat },
    })
  );
};

export const deleteDefaultChat = async (userId: string): Promise<void> => {
  await dynamoDbDocument
    .send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: key(userId),
        UpdateExpression: 'REMOVE defaultChat',
        // Without a settings record there is nothing to remove; do not create one
        ConditionExpression: 'attribute_exists(id)',
      })
    )
    .catch((error: unknown) => {
      if ((error as Error).name !== 'ConditionalCheckFailedException') {
        throw error;
      }
    });
};
