import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';
import { StartTranscriptionRequest } from 'generative-ai-use-cases';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const client = new TranscribeClient({});
    const req: StartTranscriptionRequest = JSON.parse(event.body!);
    const userId = event.requestContext.authorizer!.claims.sub;

    const { audioUrl, speakerLabel, maxSpeakers } = req;

    const uuid = uuidv4();

    const command = new StartTranscriptionJobCommand({
      IdentifyLanguage: true,
      LanguageOptions: ['ja-JP', 'en-US'],
      Media: { MediaFileUri: audioUrl },
      TranscriptionJobName: uuid,
      Settings: {
        ShowSpeakerLabels: speakerLabel,
        MaxSpeakerLabels: speakerLabel ? maxSpeakers : undefined,
      },
      OutputBucketName: process.env.TRANSCRIPT_BUCKET_NAME,
      Tags: [
        {
          Key: 'userId',
          Value: userId,
        },
      ],
    });
    const res = await client.send(command);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        jobName: res.TranscriptionJob!.TranscriptionJobName,
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
