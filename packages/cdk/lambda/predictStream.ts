import { Handler, Context } from 'aws-lambda';
import { PredictRequest } from 'generative-ai-use-cases';
import api from './utils/api';
import { defaultModel } from './utils/models';

declare global {
  namespace awslambda {
    function streamifyResponse(
      f: (
        event: PredictRequest,
        responseStream: NodeJS.WritableStream,
        context: Context
      ) => Promise<void>
    ): Handler;
  }
}

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    try {
      context.callbackWaitsForEmptyEventLoop = false;
      const model = event.model || defaultModel;
      for await (const token of api[model.type].invokeStream?.(
        model,
        event.messages,
        event.id,
        event.idToken,
        event.kbId
      ) ?? []) {
        responseStream.write(token);
      }
      responseStream.end();
    } catch (error) {
      console.error('Error in stream processing:', error);
      responseStream.write(
        JSON.stringify({ error: 'Stream processing failed' })
      );
      responseStream.end();
    }
  }
);
