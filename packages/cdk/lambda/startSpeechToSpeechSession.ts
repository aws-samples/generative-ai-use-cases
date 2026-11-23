import { Request, Response } from 'express';
import { sendJson } from './utils/http';
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
  const { channel, model, voiceId }: SpeechToSpeechSessionRequest =
    request.body ?? {};

  // The voiceId is passed to Bedrock as is, so accept only the voices of the model
  if (
    voiceId !== undefined &&
    !isSpeechToSpeechVoice(model?.modelId ?? '', voiceId)
  ) {
    return sendJson(response, 400, { message: 'Invalid voiceId' });
  }

  const lambda = new LambdaClient({});

  await lambda.send(
    new InvokeCommand({
      FunctionName: process.env.SPEECH_TO_SPEECH_TASK_FUNCTION_ARN,
      InvocationType: InvocationType.Event,
      Payload: JSON.stringify({ channelId: channel, model, voiceId }),
    })
  );

  return sendJson(response, 200, { channel });
};
