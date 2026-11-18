import { Request, Response } from 'express';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetFileDownloadSignedUrlRequest } from 'generative-ai-use-cases';
import { initKnowledgeBaseS3Client } from './utils/bedrockClient';
import { queryParams, sendText } from './utils/http';

const MODEL_REGION = process.env.MODEL_REGION as string;

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const req = queryParams(
    request
  ) as unknown as GetFileDownloadSignedUrlRequest;

  // We pass `s3Type` parameter since Knowledge Base may need to reference S3 in a different account
  // default and agentcore currently reside in same account and region is specifed in request
  const client =
    req.s3Type === 'knowledgeBase'
      ? await initKnowledgeBaseS3Client({
          region: req.region ?? MODEL_REGION,
        })
      : new S3Client({ region: req.region });
  const command = new GetObjectCommand({
    Bucket: req.bucketName,
    Key: req.filePrefix,
    ResponseContentType: req.contentType,
  });

  const signedUrl = await getSignedUrl(client, command, { expiresIn: 60 });

  return sendText(response, 200, signedUrl);
};
