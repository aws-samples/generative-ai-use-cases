import {
  Chat,
  RecordedMessage,
  ToBeRecordedMessage,
  ShareId,
  UserIdAndChatId,
  SystemContext,
  UpdateFeedbackRequest,
  ListChatsResponse,
  TokenUsageStats,
} from 'generative-ai-use-cases';
import * as crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE_NAME: string = process.env.TABLE_NAME!;
const TOKEN_USAGE_TABLE_NAME: string = process.env.TOKEN_USAGE_TABLE_NAME!;
const TOKEN_USAGE_BY_USECASE_TABLE_NAME: string =
  process.env.TOKEN_USAGE_BY_USECASE_TABLE_NAME!;
const TOKEN_USAGE_BY_MODEL_TABLE_NAME: string =
  process.env.TOKEN_USAGE_BY_MODEL_TABLE_NAME!;
const dynamoDb = new DynamoDBClient({});
const dynamoDbDocument = DynamoDBDocumentClient.from(dynamoDb);

export const createChat = async (_userId: string): Promise<Chat> => {
  const userId = `user#${_userId}`;
  const chatId = `chat#${crypto.randomUUID()}`;
  const item = {
    id: userId,
    createdDate: `${Date.now()}`,
    chatId,
    usecase: '',
    title: '',
    updatedDate: '',
  };

  await dynamoDbDocument.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return item;
};

export const findChatById = async (
  _userId: string,
  _chatId: string
): Promise<Chat | null> => {
  const userId = `user#${_userId}`;
  const chatId = `chat#${_chatId}`;
  const res = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#id = :id',
      FilterExpression: '#chatId = :chatId',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#chatId': 'chatId',
      },
      ExpressionAttributeValues: {
        ':id': userId,
        ':chatId': chatId,
      },
    })
  );

  if (!res.Items || res.Items.length === 0) {
    return null;
  } else {
    return res.Items[0] as Chat;
  }
};

export const findSystemContextById = async (
  _userId: string,
  _systemContextId: string
): Promise<SystemContext | null> => {
  const userId = `systemContext#${_userId}`;
  const systemContextId = `systemContext#${_systemContextId}`;
  const res = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#id = :id',
      FilterExpression: '#systemContextId = :systemContextId',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#systemContextId': 'systemContextId',
      },
      ExpressionAttributeValues: {
        ':id': userId,
        ':systemContextId': systemContextId,
      },
    })
  );

  if (!res.Items || res.Items.length === 0) {
    return null;
  } else {
    return res.Items[0] as SystemContext;
  }
};

export const listChats = async (
  _userId: string,
  _exclusiveStartKey?: string
): Promise<ListChatsResponse> => {
  const exclusiveStartKey = _exclusiveStartKey
    ? JSON.parse(Buffer.from(_exclusiveStartKey, 'base64').toString())
    : undefined;
  const userId = `user#${_userId}`;
  const res = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#id = :id',
      ExpressionAttributeNames: {
        '#id': 'id',
      },
      ExpressionAttributeValues: {
        ':id': userId,
      },
      ScanIndexForward: false,
      Limit: 100, // Return the list of chats in 100 items at a time
      ExclusiveStartKey: exclusiveStartKey,
    })
  );

  return {
    data: res.Items as Chat[],
    lastEvaluatedKey: res.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString('base64')
      : undefined,
  };
};

export const listSystemContexts = async (
  _userId: string
): Promise<SystemContext[]> => {
  const userId = `systemContext#${_userId}`;
  const res = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#id = :id',
      ExpressionAttributeNames: {
        '#id': 'id',
      },
      ExpressionAttributeValues: {
        ':id': userId,
      },
      ScanIndexForward: false,
    })
  );
  return res.Items as SystemContext[];
};

export const createSystemContext = async (
  _userId: string,
  title: string,
  systemContext: string
): Promise<SystemContext> => {
  const userId = `systemContext#${_userId}`;
  const systemContextId = `systemContext#${crypto.randomUUID()}`;
  const item = {
    id: userId,
    createdDate: `${Date.now()}`,
    systemContextId: systemContextId,
    systemContext: systemContext,
    systemContextTitle: title,
  };

  await dynamoDbDocument.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return item;
};

export const listMessages = async (
  _chatId: string
): Promise<RecordedMessage[]> => {
  const chatId = `chat#${_chatId}`;
  const res = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#id = :id',
      ExpressionAttributeNames: {
        '#id': 'id',
      },
      ExpressionAttributeValues: {
        ':id': chatId,
      },
    })
  );

  return res.Items as RecordedMessage[];
};

// Update token usage
async function updateTokenUsage(message: RecordedMessage): Promise<void> {
  const timestamp = message.createdDate.split('#')[0];
  const date = new Date(parseInt(timestamp));
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const userId = message.userId.replace('user#', '');
  const modelId = message.llmType || 'unknown';
  const usecase = message.usecase || 'unknown';
  const usage = message.metadata?.usage || {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheWriteInputTokens: 0,
  };

  try {
    // Define 3 update commands for 3 tables
    const mainTableUpdate = {
      TableName: TOKEN_USAGE_TABLE_NAME,
      Key: {
        userId,
        date: dateStr,
      },
      UpdateExpression: `
        SET totalExecutions = if_not_exists(totalExecutions, :zero) + :one,
            totalInputTokens = if_not_exists(totalInputTokens, :zero) + :inputTokens,
            totalOutputTokens = if_not_exists(totalOutputTokens, :zero) + :outputTokens,
            totalCacheReadInputTokens = if_not_exists(totalCacheReadInputTokens, :zero) + :cacheReadInputTokens,
            totalCacheWriteInputTokens = if_not_exists(totalCacheWriteInputTokens, :zero) + :cacheWriteInputTokens
      `,
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1,
        ':inputTokens': usage.inputTokens || 0,
        ':outputTokens': usage.outputTokens || 0,
        ':cacheReadInputTokens': usage.cacheReadInputTokens || 0,
        ':cacheWriteInputTokens': usage.cacheWriteInputTokens || 0,
      },
    };

    const usecaseUpdate = {
      TableName: TOKEN_USAGE_BY_USECASE_TABLE_NAME,
      Key: {
        userId,
        dateUsecase: `${dateStr}#${usecase}`,
      },
      UpdateExpression: `
        SET #date = :date,
            #usecase = :usecase,
            executions = if_not_exists(executions, :zero) + :one,
            inputTokens = if_not_exists(inputTokens, :zero) + :inputTokens,
            outputTokens = if_not_exists(outputTokens, :zero) + :outputTokens,
            cacheReadInputTokens = if_not_exists(cacheReadInputTokens, :zero) + :cacheReadInputTokens,
            cacheWriteInputTokens = if_not_exists(cacheWriteInputTokens, :zero) + :cacheWriteInputTokens
      `,
      ExpressionAttributeNames: {
        '#date': 'date',
        '#usecase': 'usecase',
      },
      ExpressionAttributeValues: {
        ':date': dateStr,
        ':usecase': usecase,
        ':zero': 0,
        ':one': 1,
        ':inputTokens': usage.inputTokens || 0,
        ':outputTokens': usage.outputTokens || 0,
        ':cacheReadInputTokens': usage.cacheReadInputTokens || 0,
        ':cacheWriteInputTokens': usage.cacheWriteInputTokens || 0,
      },
    };

    const modelUpdate = {
      TableName: TOKEN_USAGE_BY_MODEL_TABLE_NAME,
      Key: {
        userId,
        dateModel: `${dateStr}#${modelId}`,
      },
      UpdateExpression: `
        SET #date = :date,
            #modelId = :modelId,
            executions = if_not_exists(executions, :zero) + :one,
            inputTokens = if_not_exists(inputTokens, :zero) + :inputTokens,
            outputTokens = if_not_exists(outputTokens, :zero) + :outputTokens,
            cacheReadInputTokens = if_not_exists(cacheReadInputTokens, :zero) + :cacheReadInputTokens,
            cacheWriteInputTokens = if_not_exists(cacheWriteInputTokens, :zero) + :cacheWriteInputTokens
      `,
      ExpressionAttributeNames: {
        '#date': 'date',
        '#modelId': 'modelId',
      },
      ExpressionAttributeValues: {
        ':date': dateStr,
        ':modelId': modelId,
        ':zero': 0,
        ':one': 1,
        ':inputTokens': usage.inputTokens || 0,
        ':outputTokens': usage.outputTokens || 0,
        ':cacheReadInputTokens': usage.cacheReadInputTokens || 0,
        ':cacheWriteInputTokens': usage.cacheWriteInputTokens || 0,
      },
    };

    // Update 3 tables in parallel
    await Promise.all([
      dynamoDbDocument.send(new UpdateCommand(mainTableUpdate)),
      dynamoDbDocument.send(new UpdateCommand(usecaseUpdate)),
      dynamoDbDocument.send(new UpdateCommand(modelUpdate)),
    ]);
  } catch (error) {
    console.error('Error updating token usage:', error);
    throw error;
  }
}

export const batchCreateMessages = async (
  messages: ToBeRecordedMessage[],
  _userId: string,
  _chatId: string
): Promise<RecordedMessage[]> => {
  const userId = `user#${_userId}`;
  const chatId = `chat#${_chatId}`;
  const createdDate = Date.now();
  const feedback = 'none';

  const items: RecordedMessage[] = messages.map(
    (m: ToBeRecordedMessage, i: number) => {
      return {
        id: chatId,
        createdDate: m.createdDate ?? `${createdDate + i}#0`,
        messageId: m.messageId,
        role: m.role,
        content: m.content,
        trace: m.trace,
        extraData: m.extraData,
        userId,
        feedback,
        usecase: m.usecase,
        llmType: m.llmType ?? '',
        metadata: m.metadata,
      };
    }
  );

  // Save messages
  await dynamoDbDocument.send(
    new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: items.map((m) => {
          return {
            PutRequest: {
              Item: m,
            },
          };
        }),
      },
    })
  );

  // Update token usage in parallel
  await Promise.all(items.map(updateTokenUsage));

  return items;
};

export const setChatTitle = async (
  id: string,
  createdDate: string,
  title: string
) => {
  const res = await dynamoDbDocument.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        id: id,
        createdDate: createdDate,
      },
      UpdateExpression: 'set title = :title',
      ExpressionAttributeValues: {
        ':title': title,
      },
      ReturnValues: 'ALL_NEW',
    })
  );
  return res.Attributes as Chat;
};

export const updateFeedback = async (
  _chatId: string,
  feedbackData: UpdateFeedbackRequest
): Promise<RecordedMessage> => {
  const chatId = `chat#${_chatId}`;
  const { createdDate, feedback, reasons, detailedFeedback } = feedbackData;
  let updateExpression = 'set feedback = :feedback';
  const expressionAttributeValues: {
    ':feedback': string;
    ':reasons'?: string[];
    ':detailedFeedback'?: string;
  } = {
    ':feedback': feedback,
  };

  if (reasons && reasons.length > 0) {
    updateExpression += ', reasons = :reasons';
    expressionAttributeValues[':reasons'] = reasons;
  }

  if (detailedFeedback) {
    updateExpression += ', detailedFeedback = :detailedFeedback';
    expressionAttributeValues[':detailedFeedback'] = detailedFeedback;
  }

  const res = await dynamoDbDocument.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        id: chatId,
        createdDate,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return res.Attributes as RecordedMessage;
};

export const deleteChat = async (
  _userId: string,
  _chatId: string
): Promise<void> => {
  // Delete Chat
  const chatItem = await findChatById(_userId, _chatId);
  await dynamoDbDocument.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        id: chatItem?.id,
        createdDate: chatItem?.createdDate,
      },
    })
  );

  // Delete Messages
  const messageItems = await listMessages(_chatId);
  await dynamoDbDocument.send(
    new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: messageItems.map((m) => {
          return {
            DeleteRequest: {
              Key: {
                id: m.id,
                createdDate: m.createdDate,
              },
            },
          };
        }),
      },
    })
  );
};

export const updateSystemContextTitle = async (
  _userId: string,
  _systemContextId: string,
  title: string
): Promise<SystemContext> => {
  const systemContext = await findSystemContextById(_userId, _systemContextId);
  const res = await dynamoDbDocument.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        id: systemContext?.id,
        createdDate: systemContext?.createdDate,
      },
      UpdateExpression: 'set systemContextTitle = :systemContextTitle',
      ExpressionAttributeValues: {
        ':systemContextTitle': title,
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  return res.Attributes as SystemContext;
};

export const deleteSystemContext = async (
  _userId: string,
  _systemContextId: string
): Promise<void> => {
  // Delete System Context
  const systemContext = await findSystemContextById(_userId, _systemContextId);
  await dynamoDbDocument.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        id: systemContext?.id,
        createdDate: systemContext?.createdDate,
      },
    })
  );
};

export const createShareId = async (
  _userId: string,
  _chatId: string
): Promise<{
  shareId: ShareId;
  userIdAndChatId: UserIdAndChatId;
}> => {
  const userId = `user#${_userId}`;
  const chatId = `chat#${_chatId}`;
  const createdDate = `${Date.now()}`;
  const shareId = `share#${crypto.randomUUID()}`;

  const itemShareId = {
    id: `${userId}_${chatId}`,
    createdDate,
    shareId,
  };

  const itemUserIdAndChatId = {
    id: shareId,
    createdDate,
    userId,
    chatId,
  };

  await dynamoDbDocument.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: itemShareId,
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: itemUserIdAndChatId,
          },
        },
      ],
    })
  );

  return {
    shareId: itemShareId,
    userIdAndChatId: itemUserIdAndChatId,
  };
};

export const findUserIdAndChatId = async (
  _shareId: string
): Promise<UserIdAndChatId | null> => {
  const shareId = `share#${_shareId}`;
  const res = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#id = :id',
      ExpressionAttributeNames: {
        '#id': 'id',
      },
      ExpressionAttributeValues: {
        ':id': shareId,
      },
    })
  );

  if (!res.Items || res.Items.length === 0) {
    return null;
  } else {
    return res.Items[0] as UserIdAndChatId;
  }
};

export const findShareId = async (
  _userId: string,
  _chatId: string
): Promise<ShareId | null> => {
  const userId = `user#${_userId}`;
  const chatId = `chat#${_chatId}`;
  const res = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#id = :id',
      ExpressionAttributeNames: {
        '#id': 'id',
      },
      ExpressionAttributeValues: {
        ':id': `${userId}_${chatId}`,
      },
    })
  );

  if (!res.Items || res.Items.length === 0) {
    return null;
  } else {
    return res.Items[0] as ShareId;
  }
};

export const deleteShareId = async (_shareId: string): Promise<void> => {
  const userIdAndChatId = await findUserIdAndChatId(_shareId);
  const share = await findShareId(
    // SAML authentication includes # in userId
    // Example: user#EntraID_hogehoge.com#EXT#@hogehoge.onmicrosoft.com
    userIdAndChatId!.userId.split('#').slice(1).join('#'),
    userIdAndChatId!.chatId.split('#')[1]
  );

  await dynamoDbDocument.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: TABLE_NAME,
            Key: {
              id: share!.id,
              createdDate: share!.createdDate,
            },
          },
        },
        {
          Delete: {
            TableName: TABLE_NAME,
            Key: {
              id: userIdAndChatId!.id,
              createdDate: userIdAndChatId!.createdDate,
            },
          },
        },
      ],
    })
  );
};

export const aggregateTokenUsage = async (
  startDate: string,
  endDate: string,
  userIds?: string[]
): Promise<TokenUsageStats[]> => {
  const userId = userIds?.[0];
  if (!userId) {
    throw new Error('userId is required');
  }

  // Calculate the difference between dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // getRecentTokenUsage to get data
  return getRecentTokenUsage(diffDays, userId);
};

// Get token usage for the last N days
export const getRecentTokenUsage = async (
  days: number = 7,
  userId?: string
): Promise<TokenUsageStats[]> => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);

  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  try {
    // Define queries with date range
    const mainTableQuery = {
      TableName: TOKEN_USAGE_TABLE_NAME,
      KeyConditionExpression:
        '#userId = :userId AND #date BETWEEN :startDate AND :endDate',
      ExpressionAttributeNames: {
        '#userId': 'userId',
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':startDate': startDateStr,
        ':endDate': endDateStr,
      },
    };

    const usecaseQuery = {
      TableName: TOKEN_USAGE_BY_USECASE_TABLE_NAME,
      KeyConditionExpression:
        '#userId = :userId AND #dateUsecase BETWEEN :startDatePrefix AND :endDatePrefix',
      ExpressionAttributeNames: {
        '#userId': 'userId',
        '#dateUsecase': 'dateUsecase',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':startDatePrefix': `${startDateStr}#`,
        ':endDatePrefix': `${endDateStr}#\uffff`, // \uffff is the highest Unicode character
      },
    };

    const modelQuery = {
      TableName: TOKEN_USAGE_BY_MODEL_TABLE_NAME,
      KeyConditionExpression:
        '#userId = :userId AND #dateModel BETWEEN :startDatePrefix AND :endDatePrefix',
      ExpressionAttributeNames: {
        '#userId': 'userId',
        '#dateModel': 'dateModel',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':startDatePrefix': `${startDateStr}#`,
        ':endDatePrefix': `${endDateStr}#\uffff`, // \uffff is the highest Unicode character
      },
    };

    // Execute queries in parallel
    const [mainResults, usecaseResults, modelResults] = await Promise.all([
      dynamoDbDocument.send(new QueryCommand(mainTableQuery)),
      dynamoDbDocument.send(new QueryCommand(usecaseQuery)),
      dynamoDbDocument.send(new QueryCommand(modelQuery)),
    ]);

    // Create a map of dates to store aggregated data
    const statsMap = new Map<string, TokenUsageStats>();

    // Initialize stats for all dates in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      statsMap.set(dateStr, {
        date: dateStr,
        userId: userId || 'all',
        totalExecutions: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadInputTokens: 0,
        totalCacheWriteInputTokens: 0,
        usecaseStats: {},
        modelStats: {},
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process main table results
    mainResults.Items?.forEach((item) => {
      const stats = statsMap.get(item.date);
      if (stats) {
        stats.totalExecutions = item.totalExecutions || 0;
        stats.totalInputTokens = item.totalInputTokens || 0;
        stats.totalOutputTokens = item.totalOutputTokens || 0;
        stats.totalCacheReadInputTokens = item.totalCacheReadInputTokens || 0;
        stats.totalCacheWriteInputTokens = item.totalCacheWriteInputTokens || 0;
      }
    });

    // Process usecase results
    usecaseResults.Items?.forEach((item) => {
      const [date, usecase] = item.dateUsecase.split('#');
      const stats = statsMap.get(date);
      if (stats) {
        stats.usecaseStats[usecase] = {
          executions: item.executions || 0,
          inputTokens: item.inputTokens || 0,
          outputTokens: item.outputTokens || 0,
          cacheReadInputTokens: item.cacheReadInputTokens || 0,
          cacheWriteInputTokens: item.cacheWriteInputTokens || 0,
        };
      }
    });

    // Process model results
    modelResults.Items?.forEach((item) => {
      const [date, modelId] = item.dateModel.split('#');
      const stats = statsMap.get(date);
      if (stats) {
        stats.modelStats[modelId] = {
          executions: item.executions || 0,
          inputTokens: item.inputTokens || 0,
          outputTokens: item.outputTokens || 0,
          cacheReadInputTokens: item.cacheReadInputTokens || 0,
          cacheWriteInputTokens: item.cacheWriteInputTokens || 0,
        };
      }
    });

    // Convert map to array and sort by date
    return Array.from(statsMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  } catch (error) {
    console.error('Error fetching token usage data:', error);
    throw error;
  }
};
