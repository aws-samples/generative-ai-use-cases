import { Handler, Context } from 'aws-lambda';
import { PredictRequest } from 'generative-ai-use-cases';
import { canAccessFile, fileBucketKey } from '@generative-ai-use-cases/common';
import api from './utils/api';
import { defaultModel } from './utils/models';
import { verifyToken } from './utils/auth';
import { streamingChunk } from './utils/streamingChunk';
import { bedrockRequestMetadata } from './utils/requestMetadata';
import { AttachmentError, resolveAttachments } from './utils/attachments';

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

/**
 * S3 references are read with this function's role: images and documents by
 * this function (resolveAttachments), videos by Bedrock. Each one must be one
 * of the caller's own files in the file bucket.
 */
export const s3ReferencesAllowed = async (
  event: PredictRequest
): Promise<boolean> => {
  const bucket = process.env.BUCKET_NAME!;
  const urls = (event.messages ?? []).flatMap((message) =>
    (message.extraData ?? [])
      .filter((extra) => extra?.source?.type === 's3')
      .map((extra) => extra.source.data ?? '')
  );
  if (urls.length === 0) return true;

  const caller = (await verifyToken(event.idToken ?? ''))?.sub;
  if (!caller) return false;
  return urls.every((url) => {
    const key = fileBucketKey(url, bucket);
    return key !== null && canAccessFile({ caller, key });
  });
};

export const handler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    if (!(await s3ReferencesAllowed(event))) {
      responseStream.write(
        streamingChunk({
          text: '',
          stopReason: 'error',
          errorCode: 'ACCESS_DENIED',
        })
      );
      responseStream.end();
      return;
    }

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
