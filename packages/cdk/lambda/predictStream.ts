import { Handler, Context } from 'aws-lambda';
import { PredictRequest } from 'generative-ai-use-cases';
import api from './utils/api';
import { defaultModel } from './utils/models';
import { verifyToken } from './utils/auth';
import { bedrockRequestMetadata } from './utils/requestMetadata';
import { AttachmentError, resolveAttachments } from './utils/attachments';
import { streamingChunk } from './utils/streamingChunk';

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
    context.callbackWaitsForEmptyEventLoop = false;
    const model = event.model || defaultModel;
    // This Lambda is invoked directly, so the user comes from the verified
    // id token; an unverifiable token only leaves the user out of the tags.
    const userSub = event.idToken
      ? (await verifyToken(event.idToken))?.sub
      : undefined;
    // The browser sends the S3 URL of each image and document; read them here
    let messages = event.messages;
    try {
      messages = await resolveAttachments(event.messages, {
        bucketName: process.env.BUCKET_NAME!,
        region: process.env.AWS_REGION!,
      });
    } catch (e) {
      if (!(e instanceof AttachmentError)) throw e;
      console.error(e);
      responseStream.write(
        streamingChunk({ text: '', stopReason: 'error', errorCode: e.code })
      );
      responseStream.end();
      return;
    }
    for await (const token of api[model.type].invokeStream?.(
      model,
      messages,
      event.id,
      event.idToken,
      bedrockRequestMetadata({ userSub, id: event.id })
    ) ?? []) {
      responseStream.write(token);
    }
    responseStream.end();
  }
);
