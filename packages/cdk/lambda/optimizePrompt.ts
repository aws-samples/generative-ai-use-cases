import { Handler, Context } from 'aws-lambda';
import { OptimizePromptRequest } from 'generative-ai-use-cases';
import bedrockOptimizePrompt from './utils/bedrockOptimizePrompt';

declare global {
  namespace awslambda {
    function streamifyResponse(
      f: (
        event: OptimizePromptRequest,
        responseStream: NodeJS.WritableStream,
        context: Context
      ) => Promise<void>
    ): Handler;
  }
}

export const handler = awslambda.streamifyResponse(
  async (
    event: OptimizePromptRequest,
    responseStream: NodeJS.WritableStream,
    context: Context
  ) => {
    try {
      context.callbackWaitsForEmptyEventLoop = false;

      for await (const token of bedrockOptimizePrompt.execute({
        targetModelId: event.targetModelId,
        prompt: event.prompt,
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
