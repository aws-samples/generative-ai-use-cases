import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetFileDownloadSignedUrlRequest } from 'generative-ai-use-cases';
import { initKnowledgeBaseS3Client } from './utils/bedrockClient';

const MODEL_REGION = process.env.MODEL_REGION as string;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const req = event.queryStringParameters as GetFileDownloadSignedUrlRequest;

    // We pass `s3Type` parameter since Knowledge Base may need to reference S3 in a different account
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: signedUrl,
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
