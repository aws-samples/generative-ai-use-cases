import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from '@aws-sdk/client-lambda';
import { SpeechToSpeechSessionRequest } from 'generative-ai-use-cases';
import { isSpeechToSpeechVoice } from '@generative-ai-use-cases/common';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { channel, model, voiceId }: SpeechToSpeechSessionRequest =
      JSON.parse(event.body!);

    // The voiceId is passed to Bedrock as is, so accept only the voices of the model
    if (
      voiceId !== undefined &&
      !isSpeechToSpeechVoice(model?.modelId ?? '', voiceId)
    ) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Invalid voiceId' }),
      };
    }

    const lambda = new LambdaClient({});

    await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.SPEECH_TO_SPEECH_TASK_FUNCTION_ARN,
        InvocationType: InvocationType.Event,
        Payload: JSON.stringify({ channelId: channel, model, voiceId }),
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ channel }),
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
