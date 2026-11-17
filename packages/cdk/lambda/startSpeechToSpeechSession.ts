import { Request, Response } from 'express';
import { sendResponse } from './utils/http';
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from '@aws-sdk/client-lambda';
import { SpeechToSpeechSessionRequest } from 'generative-ai-use-cases';
import { isSpeechToSpeechVoice } from '@generative-ai-use-cases/common';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { channel, model, voiceId }: SpeechToSpeechSessionRequest =
      request.body ?? {};

    // The voiceId is passed to Bedrock as is, so accept only the voices of the model
    if (
      voiceId !== undefined &&
      !isSpeechToSpeechVoice(model?.modelId ?? '', voiceId)
    ) {
      return sendResponse(
        response,
        400,
        JSON.stringify({ message: 'Invalid voiceId' })
      );
    }

    const lambda = new LambdaClient({});

    await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.SPEECH_TO_SPEECH_TASK_FUNCTION_ARN,
        InvocationType: InvocationType.Event,
        Payload: JSON.stringify({ channelId: channel, model, voiceId }),
      })
    );

    return sendResponse(response, 200, JSON.stringify({ channel }));
  } catch (error) {
    console.log(error);
    return sendResponse(
      response,
      500,
      JSON.stringify({ message: 'Internal Server Error' })
    );
  }
};
