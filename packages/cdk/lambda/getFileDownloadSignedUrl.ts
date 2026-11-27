import { Request, Response } from 'express';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetFileDownloadSignedUrlRequest } from 'generative-ai-use-cases';
import {
  SharedChat,
  attachedFileKeys,
  canAccessFile,
  parseS3ObjectUrl,
} from '@generative-ai-use-cases/common';
import { findUserIdAndChatId, listMessages } from './repository';
import { sendDocumentDownloadUrl } from './getDocumentDownloadSignedUrl';
import { queryParams, requireUserSub, sendJson, sendText } from './utils/http';

const BUCKET_NAME = process.env.BUCKET_NAME!;
const DOWNLOAD_URL_TTL_SECONDS = 60;

/** The shared chat behind a share link, or undefined for an unknown link. */
const loadSharedChat = async (
  shareId: string
): Promise<SharedChat | undefined> => {
  const share = await findUserIdAndChatId(shareId);
  // A link created before the owner's sub was recorded serves no files until
  // the owner opens the share dialog again (createShareId records it).
  if (share === null || !share.ownerSub) return undefined;
  const chatId = share.chatId.split('#').slice(1).join('#');
  return {
    owner: share.ownerSub,
    attached: attachedFileKeys(await listMessages(chatId), BUCKET_NAME),
  };
};

/**
 * `GET /file/url?uri=[&shareId=]`: a download URL for a file or a
 * document shown to the caller. `uri` is an S3 URL.
 *
 * A file bucket object is signed when `canAccessFile` allows it. Any other
 * bucket is treated as a cited document (Knowledge Base, Kendra).
 */
export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userSub = requireUserSub(request);
  const req = queryParams(request) as Partial<
    Record<keyof GetFileDownloadSignedUrlRequest, unknown>
  >;
  if (
    [req.uri, req.shareId].some((v) => v !== undefined && typeof v !== 'string')
  ) {
    return sendJson(response, 400, { message: 'Invalid parameters' });
  }
  const params = req as Partial<GetFileDownloadSignedUrlRequest>;
  const location = params.uri ? parseS3ObjectUrl(params.uri) : null;
  if (location === null) {
    return sendJson(response, 400, { message: 'uri must be an S3 URL' });
  }

  if (location.bucket !== BUCKET_NAME) {
    return sendDocumentDownloadUrl(request, response, location);
  }

  const share = params.shareId
    ? await loadSharedChat(params.shareId)
    : undefined;
  if (!canAccessFile({ caller: userSub, key: location.key, share })) {
    return sendJson(response, 403, { message: 'Forbidden' });
  }

  const signedUrl = await getSignedUrl(
    new S3Client({}),
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: location.key }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
  );
  return sendText(response, 200, signedUrl);
};
