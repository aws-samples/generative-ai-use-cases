import { Request, Response } from 'express';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DeleteFileRequest } from 'generative-ai-use-cases';
import { canAccessFile } from '@generative-ai-use-cases/common';
import { queryParams, requireUserSub, sendJson, sendText } from './utils/http';

/** `DELETE /file?key=`: delete one of the caller's own files. */
export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userSub = requireUserSub(request);
  const req = queryParams(request) as Partial<DeleteFileRequest>;
  if (!req.key) {
    return sendJson(response, 400, { message: 'key is required' });
  }
  if (!canAccessFile({ caller: userSub, key: req.key })) {
    return sendJson(response, 403, { message: 'Forbidden' });
  }

  await new S3Client({}).send(
    new DeleteObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: req.key,
    })
  );

  return sendText(response, 204);
};
