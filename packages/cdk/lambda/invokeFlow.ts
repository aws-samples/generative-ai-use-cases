import { Handler, Context } from 'aws-lambda';
import { FlowRequest } from 'generative-ai-use-cases';
import bedrockFlowApi from './utils/bedrockFlowApi';

declare global {
  namespace awslambda {
    function streamifyResponse(
      f: (
        event: FlowRequest,
        responseStream: NodeJS.WritableStream,
        context: Context
      ) => Promise<void>
    ): Handler;
  }
}

export const handler = awslambda.streamifyResponse(
  async (
    event: FlowRequest,
    responseStream: NodeJS.WritableStream,
    context: Context
  ) => {
    try {
      context.callbackWaitsForEmptyEventLoop = false;

      for await (const token of bedrockFlowApi.invokeFlow({
        flowIdentifier: event.flowIdentifier,
        flowAliasIdentifier: event.flowAliasIdentifier,
        document: event.document,
      })) {
        responseStream.write(token);
      }

      responseStream.end();
    } catch (e) {
      console.error('Error in handler:', e);
      responseStream.write(
        JSON.stringify({ error: 'An error occurred processing your request' })
      );
      responseStream.end();
    }
  }
);
