import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from '@aws-sdk/client-lambda';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { channel, model } = JSON.parse(event.body!);
    const lambda = new LambdaClient({});

    await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.SPEECH_TO_SPEECH_TASK_FUNCTION_ARN,
        InvocationType: InvocationType.Event,
        Payload: JSON.stringify({ channelId: channel, model }),
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
