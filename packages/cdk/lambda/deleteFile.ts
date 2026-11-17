import { Request, Response } from 'express';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DeleteFileRequest } from 'generative-ai-use-cases';
import { sendText } from './utils/http';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const req = request.params as DeleteFileRequest;

  const client = new S3Client({});
  const command = new DeleteObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: req.fileName,
  });

  await client.send(command);

  return sendText(response, 204);
};
