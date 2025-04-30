import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetFileUploadSignedUrlRequest } from 'generative-ai-use-cases';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const req: GetFileUploadSignedUrlRequest = JSON.parse(event.body!);
    const filename = req.filename;
    const uuid = uuidv4();

    const client = new S3Client({});
    // The upload destination is XXXXX/image.png format. The file can be downloaded with the correct file name when downloaded.
    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: `${uuid}/${filename}`,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

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
