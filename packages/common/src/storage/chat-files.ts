import { UnrecordedMessage } from 'generative-ai-use-cases';
import { isOwnedFileKey, parseS3ObjectUrl, userFileOwner } from './file-keys';

/**
 * Who may use a file in the file bucket. Every route that signs, deletes,
 * attaches or passes a file to a model decides with `canAccessFile`. No IO:
 * the caller loads the shared chat's messages when there is a share.
 *
 * 1. A caller may use their own files (`users/<caller>/...`).
 * 2. With a share link, a caller may also read the files the shared chat
 *    attaches, when they belong to the chat owner.
 * 3. Nothing else.
 *
 * Where each route decides:
 * - `GET /file/url` (getFileDownloadSignedUrl): read, with `shareId` loads
 *   the shared chat. Other buckets go to the cited document check
 *   (getDocumentDownloadSignedUrl).
 * - `DELETE /file`, `POST /transcribe/start`, attachments of
 *   `POST /chats/:chatId/messages`, S3 references of PredictStream: own files.
 * - `POST /file/url`: the server picks a key under the caller's prefix.
 */

/** File bucket key of an S3 URL, or null when it points anywhere else. */
export const fileBucketKey = (
  url: string,
  fileBucket: string
): string | null => {
  const location = parseS3ObjectUrl(url);
  return location && location.bucket === fileBucket ? location.key : null;
};

/** File bucket keys the messages attach (S3 entries in `extraData`). */
export const attachedFileKeys = (
  messages: UnrecordedMessage[],
  fileBucket: string
): Set<string> => {
  const keys = new Set<string>();
  for (const message of messages) {
    for (const extra of message.extraData ?? []) {
      if (extra?.source?.type !== 's3') continue;
      const key = fileBucketKey(extra.source.data, fileBucket);
      if (key !== null) keys.add(key);
    }
  }
  return keys;
};

export type SharedChat = {
  /** The chat owner's Cognito `sub` (the owner segment of their keys). */
  owner: string;
  /** Keys the chat's messages attach (`attachedFileKeys`). */
  attached: Set<string>;
};

export const canAccessFile = (params: {
  /** The caller's Cognito `sub`. */
  caller: string;
  key: string;
  /** The shared chat the caller opened, for reads through a share link. */
  share?: SharedChat;
}): boolean => {
  const { caller, key, share } = params;
  if (isOwnedFileKey(caller, key)) return true;
  return (
    share !== undefined &&
    userFileOwner(key) === share.owner &&
    share.attached.has(key)
  );
};
