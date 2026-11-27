import { Request, Response } from 'express';
import { requireUserName, requireUserSub, sendJson } from './utils/http';
import { CreateMessagesRequest, ExtraData } from 'generative-ai-use-cases';
import { canAccessFile, fileBucketKey } from '@generative-ai-use-cases/common';
import {
  batchCreateMessages,
  findChatById,
  setChatUpdatedDate,
} from './repository';

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

/**
 * Shape check for one `extraData` entry. Returns the file bucket key for an
 * S3 entry (checked against the sender afterwards), null for a valid filter
 * entry, and false for anything else.
 */
const checkExtraData = (
  extra: ExtraData,
  bucketName: string
): string | null | false => {
  if (extra?.source?.type === 'json') {
    return isValidFilterExtraData(extra) ? null : false;
  }

  if (
    extra?.source?.type !== 's3' ||
    typeof extra.source.data !== 'string' ||
    !extra.source.data.startsWith(
      `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/`
    )
  ) {
    return false;
  }

  return fileBucketKey(extra.source.data, bucketName) ?? false;
};

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const req: CreateMessagesRequest = request.body ?? {};
  const userId: string = requireUserName(request);
  const chatId = request.params.chatId;
  const invalidExtraData = () =>
    sendJson(response, 400, { message: 'Invalid extraData' });

  // Authorization check: Verify if the specified chat belongs to the user
  const chat = await findChatById(userId, chatId);
  if (chat === null) {
    return sendJson(response, 403, {
      message: 'You do not have permission to post messages in the chat.',
    });
  }

  // Attachments must be the sender's own uploads.
  for (const message of req.messages ?? []) {
    for (const extra of message.extraData ?? []) {
      const key = checkExtraData(extra, FILE_UPLOAD_BUCKET_NAME);
      if (key === false) return invalidExtraData();
      if (
        key !== null &&
        !canAccessFile({ caller: requireUserSub(request), key })
      ) {
        return invalidExtraData();
      }
    }
  }

  const messages = await batchCreateMessages(req.messages, userId, chatId);

  // The messages are already saved, so a failure here must not fail the
  // request; the chat just keeps its previous position in the history.
  try {
    await setChatUpdatedDate(chat.id, chat.createdDate);
  } catch (error) {
    console.log('Failed to update updatedDate', error);
  }

  return sendJson(response, 200, {
    messages,
  });
};
