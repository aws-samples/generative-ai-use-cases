import {
  IsFavorite,
  IsShared,
  UseCaseCommon,
  UseCaseInTable,
  UseCaseAsOutput,
  UseCaseContent,
  ListUseCasesResponse,
  ListFavoriteUseCasesResponse,
  ListRecentlyUsedUseCasesResponse,
  ListPublicUseCasesResponse,
} from 'generative-ai-use-cases';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  BatchWriteCommand,
  TransactWriteCommand,
  QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import * as crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const USECASE_TABLE_NAME: string = process.env.USECASE_TABLE_NAME!;
const USECASE_ID_INDEX_NAME: string = process.env.USECASE_ID_INDEX_NAME!;
const dynamoDb = new DynamoDBClient({});
const dynamoDbDocument = DynamoDBDocumentClient.from(dynamoDb);

// Max number of recently used use cases
// Actually, it becomes RECENTLY_USED_SAVE_LIMIT + 1 in some cases
// See the updateRecentlyUsedUseCase function for details
const RECENTLY_USED_SAVE_LIMIT = 100;

// A shared use case (isShared) can be used by everyone who can sign in, so it
// is listed as public, named like the public agents of the Agent Builder
// (public-agents / public#{agentId}). The list is one small record per
// shared use case: id=PUBLIC_LIST_ID,
// dataType=`public#{sharedAt}#{useCaseId}`, useCaseId. It holds no content, so updating a use case needs no change here; the
// content is read by useCaseId, as for favorites. The record carries
// useCaseId, so it is also in the useCaseId index, where deleteUseCase finds
// it and deletes it with the use case.
const PUBLIC_LIST_ID = 'public-use-cases';
const PUBLIC_DATA_TYPE_PREFIX = 'public#';

const getUserIdFromKey = (key: string): string => {
  return key.split('#').slice(1).join('#');
};

// Create a query command to get use case by useCaseId
const createFindUseCaseByUseCaseIdCommand = (useCaseId: string) =>
  new QueryCommand({
    TableName: USECASE_TABLE_NAME,
    IndexName: USECASE_ID_INDEX_NAME,
    KeyConditionExpression:
      '#useCaseId = :useCaseId and begins_with(#dataType, :dataTypePrefix)',
    ExpressionAttributeNames: {
      '#useCaseId': 'useCaseId',
      '#dataType': 'dataType',
    },
    ExpressionAttributeValues: {
      ':useCaseId': useCaseId,
      ':dataTypePrefix': 'useCase',
    },
  });

// Get use case by useCaseId
const innerFindUseCaseByUseCaseId = async (
  useCaseId: string
): Promise<UseCaseInTable | null> => {
  const command = createFindUseCaseByUseCaseIdCommand(useCaseId);
  const useCaseInTable = await dynamoDbDocument.send(command);
  return (useCaseInTable.Items?.[0] as UseCaseInTable) || null;
};

// Get use case list by userId
const innerFindUseCasesByUserId = async (
  userId: string,
  _exclusiveStartKey?: string
): Promise<{ useCases: UseCaseInTable[]; lastEvaluatedKey?: string }> => {
  const exclusiveStartKey = _exclusiveStartKey
    ? JSON.parse(Buffer.from(_exclusiveStartKey, 'base64').toString())
    : undefined;
  const useCasesInTable = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: USECASE_TABLE_NAME,
      KeyConditionExpression:
        '#id = :id and begins_with(#dataType, :dataTypePrefix)',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#dataType': 'dataType',
      },
      ExpressionAttributeValues: {
        ':id': `useCase#${userId}`,
        ':dataTypePrefix': 'useCase',
      },
      ScanIndexForward: false,
      Limit: 30, // Number of my use cases per page
      ExclusiveStartKey: exclusiveStartKey,
    })
  );

  return {
    useCases: (useCasesInTable.Items || []) as UseCaseInTable[],
    lastEvaluatedKey: useCasesInTable.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(useCasesInTable.LastEvaluatedKey)).toString(
          'base64'
        )
      : undefined,
  };
};

// Get use case list from useCaseId array
const innerFindUseCasesByUseCaseIds = async (
  useCaseIds: string[]
): Promise<UseCaseInTable[]> => {
  // Run multiple queries in parallel
  const useCasesInTable: QueryCommandOutput[] = await Promise.all(
    useCaseIds.map((useCaseId) =>
      dynamoDb.send(createFindUseCaseByUseCaseIdCommand(useCaseId))
    )
  );
  return useCasesInTable.flatMap(
    (useCaseInTable) =>
      (useCaseInTable.Items?.slice(0, 1) || []) as UseCaseInTable[]
  );
};

// Get list of specific data type (favorite, recently used) by userId (all)
const innerFindCommonsByUserIdAndDataType = async (
  userId: string,
  dataTypePrefix: string
): Promise<UseCaseCommon[]> => {
  const commons = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: USECASE_TABLE_NAME,
      KeyConditionExpression:
        '#id = :id and begins_with(#dataType, :dataTypePrefix)',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#dataType': 'dataType',
      },
      ExpressionAttributeValues: {
        ':id': `useCase#${userId}`,
        ':dataTypePrefix': dataTypePrefix,
      },
      ScanIndexForward: false,
    })
  );

  return (commons.Items || []) as UseCaseCommon[];
};

// Get list of specific data type (favorite, recently used) by userId (pagination supported)
const innerFindCommonsByUserIdAndDataTypePagniation = async (
  userId: string,
  dataTypePrefix: string,
  _exclusiveStartKey?: string
): Promise<{ commons: UseCaseCommon[]; lastEvaluatedKey?: string }> => {
  const exclusiveStartKey = _exclusiveStartKey
    ? JSON.parse(Buffer.from(_exclusiveStartKey, 'base64').toString())
    : undefined;
  const commons = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: USECASE_TABLE_NAME,
      KeyConditionExpression:
        '#id = :id and begins_with(#dataType, :dataTypePrefix)',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#dataType': 'dataType',
      },
      ExpressionAttributeValues: {
        ':id': `useCase#${userId}`,
        ':dataTypePrefix': dataTypePrefix,
      },
      ScanIndexForward: false,
      Limit: 20, // Number of favorites/recently used per page
      ExclusiveStartKey: exclusiveStartKey,
    })
  );

  return {
    commons: (commons.Items || []) as UseCaseCommon[],
    lastEvaluatedKey: commons.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(commons.LastEvaluatedKey)).toString('base64')
      : undefined,
  };
};

// Get all data (body, favorite, recently used) related to useCaseId
const innerFindCommonsByUseCaseId = async (
  useCaseId: string
): Promise<UseCaseCommon[]> => {
  const commons = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: USECASE_TABLE_NAME,
      IndexName: USECASE_ID_INDEX_NAME,
      KeyConditionExpression: '#useCaseId = :useCaseId',
      ExpressionAttributeNames: {
        '#useCaseId': 'useCaseId',
      },
      ExpressionAttributeValues: {
        ':useCaseId': useCaseId,
      },
    })
  );

  return (commons.Items || []) as UseCaseCommon[];
};

// The records that list a use case as public (normally zero or one)
const innerFindPublicRecordsByUseCaseId = async (
  useCaseId: string
): Promise<UseCaseCommon[]> => {
  const records = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: USECASE_TABLE_NAME,
      IndexName: USECASE_ID_INDEX_NAME,
      KeyConditionExpression:
        '#useCaseId = :useCaseId and begins_with(#dataType, :dataTypePrefix)',
      ExpressionAttributeNames: {
        '#useCaseId': 'useCaseId',
        '#dataType': 'dataType',
      },
      ExpressionAttributeValues: {
        ':useCaseId': useCaseId,
        ':dataTypePrefix': PUBLIC_DATA_TYPE_PREFIX,
      },
    })
  );

  return (records.Items || []) as UseCaseCommon[];
};

const publicRecord = (useCaseId: string): UseCaseCommon => ({
  id: PUBLIC_LIST_ID,
  dataType: `${PUBLIC_DATA_TYPE_PREFIX}${Date.now()}#${useCaseId}`,
  useCaseId,
});

export const createUseCase = async (
  userId: string,
  content: UseCaseContent
): Promise<UseCaseAsOutput> => {
  const id = `useCase#${userId}`;
  const useCaseId = crypto.randomUUID();
  const dataType = `useCase#${Date.now()}`;

  const item: UseCaseInTable = {
    id,
    dataType,
    useCaseId,
    title: content.title,
    description: content.description,
    promptTemplate: content.promptTemplate,
    inputExamples: content.inputExamples,
    fixedModelId: content.fixedModelId,
    fileUpload: content.fileUpload,
    isShared: false,
  };

  await dynamoDbDocument.send(
    new PutCommand({
      TableName: USECASE_TABLE_NAME,
      Item: item,
    })
  );

  return {
    ...item,
    isFavorite: false,
    isMyUseCase: true,
  };
};

export const getUseCase = async (
  userId: string,
  useCaseId: string
): Promise<UseCaseAsOutput | null> => {
  const useCaseInTable = await innerFindUseCaseByUseCaseId(useCaseId);

  if (!useCaseInTable) {
    return null;
  }

  const isMyUseCase = getUserIdFromKey(useCaseInTable.id) === userId;
  const isShared = useCaseInTable.isShared;

  // If it is not my use case and not shared, do not get it
  if (!isMyUseCase && !isShared) {
    return null;
  }

  const favorites = await innerFindCommonsByUserIdAndDataType(
    userId,
    'favorite'
  );
  const favoritesUseCaseIds = favorites.map((f) => f.useCaseId);

  const useCaseAsOutput: UseCaseAsOutput = {
    ...useCaseInTable,
    isFavorite: favoritesUseCaseIds.includes(useCaseId),
    isMyUseCase,
  };

  return useCaseAsOutput;
};

export const listUseCases = async (
  userId: string,
  exclusiveStartKey?: string
): Promise<ListUseCasesResponse> => {
  const { useCases: useCasesInTable, lastEvaluatedKey } =
    await innerFindUseCasesByUserId(userId, exclusiveStartKey);

  const favorites = await innerFindCommonsByUserIdAndDataType(
    userId,
    'favorite'
  );
  const favoritesUseCaseIds = favorites.map((f) => f.useCaseId);

  const useCasesAsOutput: UseCaseAsOutput[] = useCasesInTable.map((u) => {
    return {
      ...u,
      isFavorite: favoritesUseCaseIds.includes(u.useCaseId),
      isMyUseCase: getUserIdFromKey(u.id) === userId,
    };
  });

  return {
    data: useCasesAsOutput,
    lastEvaluatedKey,
  };
};

export const updateUseCase = async (
  userId: string,
  useCaseId: string,
  content: UseCaseContent
): Promise<void> => {
  const useCaseInTable = await innerFindUseCaseByUseCaseId(useCaseId);

  if (!useCaseInTable) {
    console.error(
      `Use case doesn't exist for userId=${userId} and useCaseId=${useCaseId}`
    );
    return;
  }

  if (getUserIdFromKey(useCaseInTable.id) !== userId) {
    console.error(
      `userId mismatch ${userId} vs ${getUserIdFromKey(useCaseInTable.id)}`
    );
    return;
  }

  await dynamoDbDocument.send(
    new UpdateCommand({
      TableName: USECASE_TABLE_NAME,
      Key: {
        id: useCaseInTable.id,
        dataType: useCaseInTable.dataType,
      },
      UpdateExpression:
        'set title = :title, promptTemplate = :promptTemplate, description = :description, inputExamples = :inputExamples, fixedModelId = :fixedModelId, fileUpload = :fileUpload',
      ExpressionAttributeValues: {
        ':title': content.title,
        ':promptTemplate': content.promptTemplate,
        ':description': content.description ?? '',
        ':inputExamples': content.inputExamples ?? [],
        ':fixedModelId': content.fixedModelId ?? '',
        ':fileUpload': !!content.fileUpload,
      },
    })
  );

  // Use cases shared before the public list existed have no record yet.
  // Saving one adds it, so it appears in the list from then on.
  if (useCaseInTable.isShared) {
    const records = await innerFindPublicRecordsByUseCaseId(useCaseId);
    if (records.length === 0) {
      await dynamoDbDocument.send(
        new PutCommand({
          TableName: USECASE_TABLE_NAME,
          Item: publicRecord(useCaseId),
        })
      );
    }
  }
};

export const deleteUseCase = async (
  userId: string,
  useCaseId: string
): Promise<void> => {
  const useCaseInTable = await innerFindUseCaseByUseCaseId(useCaseId);

  if (!useCaseInTable) {
    console.error(
      `Use case doesn't exist for userId=${userId} and useCaseId=${useCaseId}`
    );
    return;
  }

  if (getUserIdFromKey(useCaseInTable.id) !== userId) {
    console.error(
      `userId mismatch ${userId} vs ${getUserIdFromKey(useCaseInTable.id)}`
    );
    return;
  }

  const commons = await innerFindCommonsByUseCaseId(useCaseId);
  const requestItems = commons.map((common) => {
    return {
      DeleteRequest: {
        Key: {
          id: common.id,
          dataType: common.dataType,
        },
      },
    };
  });

  // Delete body, favorite, recently used at once
  await dynamoDbDocument.send(
    new BatchWriteCommand({
      RequestItems: {
        [USECASE_TABLE_NAME]: requestItems,
      },
    })
  );
};

export const listFavoriteUseCases = async (
  userId: string,
  exclusiveStartKey?: string
): Promise<ListFavoriteUseCasesResponse> => {
  const { commons, lastEvaluatedKey } =
    await innerFindCommonsByUserIdAndDataTypePagniation(
      userId,
      'favorite',
      exclusiveStartKey
    );
  const useCaseIds = commons.map((c) => c.useCaseId);
  const useCasesInTable = await innerFindUseCasesByUseCaseIds(useCaseIds);
  const useCasesAsOutput: UseCaseAsOutput[] = useCasesInTable.map((u) => {
    return {
      ...u,
      isFavorite: true,
      isMyUseCase: getUserIdFromKey(u.id) === userId,
    };
  });

  // My use case or shared
  const useCasesAsOutputFiltered = useCasesAsOutput.filter((u) => {
    return u.isMyUseCase || u.isShared;
  });

  return {
    data: useCasesAsOutputFiltered,
    lastEvaluatedKey,
  };
};

export const toggleFavorite = async (
  userId: string,
  useCaseId: string
): Promise<IsFavorite> => {
  // Get my favorite list and check if it is already registered
  // MEMO: If the number of favorites is large, it may overflow from the list
  const commons = await innerFindCommonsByUserIdAndDataType(userId, 'favorite');
  const useCaseIds = commons.map((c) => c.useCaseId);
  const index = useCaseIds.indexOf(useCaseId);

  if (index >= 0) {
    // Unfavorite
    const common = commons[index];

    await dynamoDbDocument.send(
      new DeleteCommand({
        TableName: USECASE_TABLE_NAME,
        Key: {
          id: common.id,
          dataType: common.dataType,
        },
      })
    );

    return { isFavorite: false };
  } else {
    // Register favorite
    await dynamoDbDocument.send(
      new PutCommand({
        TableName: USECASE_TABLE_NAME,
        Item: {
          id: `useCase#${userId}`,
          dataType: `favorite#${Date.now()}`,
          useCaseId: useCaseId,
        },
      })
    );

    return { isFavorite: true };
  }
};

export const toggleShared = async (
  userId: string,
  useCaseId: string
): Promise<IsShared> => {
  const useCaseInTable = await innerFindUseCaseByUseCaseId(useCaseId);

  if (!useCaseInTable) {
    console.error(
      `Use case doesn't exist for userId=${userId} and useCaseId=${useCaseId}`
    );
    return { isShared: false };
  }

  if (getUserIdFromKey(useCaseInTable.id) !== userId) {
    console.error(
      `userId mismatch ${userId} vs ${getUserIdFromKey(useCaseInTable.id)}`
    );
    return { isShared: false };
  }

  const isShared = !useCaseInTable.isShared;
  const records = await innerFindPublicRecordsByUseCaseId(useCaseId);

  // Change the flag and the public list together
  await dynamoDbDocument.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: USECASE_TABLE_NAME,
            Key: {
              id: useCaseInTable.id,
              dataType: useCaseInTable.dataType,
            },
            UpdateExpression: 'set isShared = :isShared',
            ExpressionAttributeValues: {
              ':isShared': isShared,
            },
          },
        },
        ...(isShared
          ? records.length === 0
            ? [
                {
                  Put: {
                    TableName: USECASE_TABLE_NAME,
                    Item: publicRecord(useCaseId),
                  },
                },
              ]
            : []
          : records.map((record) => ({
              Delete: {
                TableName: USECASE_TABLE_NAME,
                Key: { id: record.id, dataType: record.dataType },
              },
            }))),
      ],
    })
  );

  return { isShared };
};

// Use cases shared by anyone (the public list), the most recently shared first
export const listPublicUseCases = async (
  userId: string,
  _exclusiveStartKey?: string
): Promise<ListPublicUseCasesResponse> => {
  const exclusiveStartKey = _exclusiveStartKey
    ? JSON.parse(Buffer.from(_exclusiveStartKey, 'base64').toString())
    : undefined;
  const records = await dynamoDbDocument.send(
    new QueryCommand({
      TableName: USECASE_TABLE_NAME,
      KeyConditionExpression:
        '#id = :id and begins_with(#dataType, :dataTypePrefix)',
      ExpressionAttributeNames: {
        '#id': 'id',
        '#dataType': 'dataType',
      },
      ExpressionAttributeValues: {
        ':id': PUBLIC_LIST_ID,
        ':dataTypePrefix': PUBLIC_DATA_TYPE_PREFIX,
      },
      ScanIndexForward: false,
      Limit: 30, // Number of public use cases per page
      ExclusiveStartKey: exclusiveStartKey,
    })
  );
  const useCaseIds = ((records.Items || []) as UseCaseCommon[]).map(
    (r) => r.useCaseId
  );

  const [useCasesInTable, favorites] = await Promise.all([
    innerFindUseCasesByUseCaseIds(useCaseIds),
    innerFindCommonsByUserIdAndDataType(userId, 'favorite'),
  ]);
  const favoritesUseCaseIds = new Set(favorites.map((f) => f.useCaseId));

  const useCasesAsOutput: UseCaseAsOutput[] = useCasesInTable
    // The flag is the source of truth if a record is left behind
    .filter((u) => u.isShared)
    .map((u) => ({
      ...u,
      isFavorite: favoritesUseCaseIds.has(u.useCaseId),
      isMyUseCase: getUserIdFromKey(u.id) === userId,
    }));

  return {
    data: useCasesAsOutput,
    lastEvaluatedKey: records.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(records.LastEvaluatedKey)).toString('base64')
      : undefined,
  };
};

export const listRecentlyUsedUseCases = async (
  userId: string,
  exclusiveStartKey?: string
): Promise<ListRecentlyUsedUseCasesResponse> => {
  const { commons, lastEvaluatedKey } =
    await innerFindCommonsByUserIdAndDataTypePagniation(
      userId,
      'recentlyUsed',
      exclusiveStartKey
    );
  const useCaseIds = commons.map((c) => c.useCaseId);

  const [useCasesInTable, favorites] = await Promise.all([
    // List user's use cases
    innerFindUseCasesByUseCaseIds(useCaseIds),
    // List user's favorites
    innerFindCommonsByUserIdAndDataType(userId, 'favorite'),
  ]);
  const favoritesUseCaseIds = new Set(favorites.map((f) => f.useCaseId));

  const useCasesAsOutput: UseCaseAsOutput[] = useCasesInTable.map((u) => {
    return {
      ...u,
      isFavorite: favoritesUseCaseIds.has(u.useCaseId),
      isMyUseCase: getUserIdFromKey(u.id) === userId,
    };
  });

  // Own or shared
  const useCasesAsOutputFiltered = useCasesAsOutput.filter((u) => {
    return u.isMyUseCase || u.isShared;
  });

  return {
    data: useCasesAsOutputFiltered,
    lastEvaluatedKey,
  };
};

export const updateRecentlyUsedUseCase = async (
  userId: string,
  useCaseId: string
): Promise<void> => {
  const itemsToDelete: UseCaseCommon[] = [];

  // Scan is running for recently used use case data
  const commons = await innerFindCommonsByUserIdAndDataType(
    userId,
    'recentlyUsed'
  );

  // Max number of recently used use cases
  if (commons.length > RECENTLY_USED_SAVE_LIMIT) {
    itemsToDelete.push(...commons.slice(RECENTLY_USED_SAVE_LIMIT));
  }

  const useCaseIds = commons.map((c) => c.useCaseId);
  const index = useCaseIds.indexOf(useCaseId);

  // If there is an older history for the same use case, it is a deletion target
  if (0 <= index && index <= RECENTLY_USED_SAVE_LIMIT - 1) {
    itemsToDelete.push(commons[index]);
  }

  // Delete and add at the same time
  // If a new history is added (no existing history), the number of histories will be RECENTLY_USED_SAVE_LIMIT + 1, but this is acceptable
  await dynamoDbDocument.send(
    new TransactWriteCommand({
      TransactItems: [
        ...itemsToDelete.map((item: UseCaseCommon) => {
          return {
            Delete: {
              TableName: USECASE_TABLE_NAME,
              Key: {
                id: item.id,
                dataType: item.dataType,
              },
            },
          };
        }),
        {
          Put: {
            TableName: USECASE_TABLE_NAME,
            Item: {
              id: `useCase#${userId}`,
              dataType: `recentlyUsed#${Date.now()}`,
              useCaseId,
            },
          },
        },
      ],
    })
  );
};
