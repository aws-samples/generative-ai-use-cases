import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CreateMessagesRequest, ExtraData } from 'generative-ai-use-cases';
import { batchCreateMessages, findChatById } from './repository';

const FILE_UPLOAD_BUCKET_NAME = process.env.BUCKET_NAME!;

const FILTER_OPERATORS = new Set([
  'equals',
  'notEquals',
  'greaterThan',
  'greaterThanOrEquals',
  'lessThan',
  'lessThanOrEquals',
  'in',
  'notIn',
  'startsWith',
  'listContains',
  'stringContains',
]);

const LOGICAL_FILTER_OPERATORS = new Set(['andAll', 'orAll']);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isScalarFilterValue = (value: unknown): boolean => {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
};

const isFilterValue = (value: unknown): boolean => {
  if (isScalarFilterValue(value)) {
    return true;
  }

  return (
    Array.isArray(value) && value.length > 0 && value.every(isScalarFilterValue)
  );
};

const isFilterAttribute = (value: unknown): boolean => {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    value.key.length > 0 &&
    isFilterValue(value.value)
  );
};

const isRetrievalFilter = (value: unknown, depth = 0): boolean => {
  if (!isRecord(value) || depth > 5) return false;

  const entries = Object.entries(value);
  if (entries.length !== 1) return false;

  const [operator, filterValue] = entries[0];
  if (FILTER_OPERATORS.has(operator)) {
    return isFilterAttribute(filterValue);
  }

  if (LOGICAL_FILTER_OPERATORS.has(operator)) {
    return (
      Array.isArray(filterValue) &&
      filterValue.length > 0 &&
      filterValue.every((nestedFilter) =>
        isRetrievalFilter(nestedFilter, depth + 1)
      )
    );
  }

  return false;
};

const isValidFilterExtraData = (extra: ExtraData): boolean => {
  if (
    extra.type !== 'json' ||
    extra.name !== 'filter' ||
    extra.source.type !== 'json' ||
    extra.source.mediaType !== 'application/json'
  ) {
    return false;
  }

  try {
    return isRetrievalFilter(JSON.parse(extra.source.data));
  } catch {
    return false;
  }
};

const isValidExtraData = (extra: ExtraData, bucketName: string): boolean => {
  if (extra.source.type === 'json') {
    return isValidFilterExtraData(extra);
  }

  if (extra.source.type !== 's3') {
    return false;
  }

  return extra.source.data.startsWith(
    `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/`
  );
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const req: CreateMessagesRequest = JSON.parse(event.body!);
    const userId: string =
      event.requestContext.authorizer!.claims['cognito:username'];
    const chatId = event.pathParameters!.chatId!;

    // Authorization check: Verify if the specified chat belongs to the user
    const chat = await findChatById(userId, chatId);
    if (chat === null) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'You do not have permission to post messages in the chat.',
        }),
      };
    }

    if (req.messages) {
      for (const message of req.messages) {
        if (message.extraData && message.extraData.length > 0) {
          for (const extra of message.extraData) {
            if (!isValidExtraData(extra, FILE_UPLOAD_BUCKET_NAME)) {
              return {
                statusCode: 400,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                  message: 'Invalid extraData',
                }),
              };
            }
          }
        }
      }
    }

    const messages = await batchCreateMessages(req.messages, userId, chatId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        messages,
      }),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
