import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetFileUploadSignedUrlRequest } from 'generative-ai-use-cases';
import { sendText } from './utils/http';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const req: GetFileUploadSignedUrlRequest = request.body;
  const filename = req.filename;
  const uuid = uuidv4();

  const client = new S3Client({});
  // The upload destination is XXXXX/image.png format. The file can be downloaded with the correct file name when downloaded.
  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: `${uuid}/${filename}`,
  });

  const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

  return sendText(response, 200, signedUrl);
};
