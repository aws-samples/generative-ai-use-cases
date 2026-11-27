import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ExtraData, UnrecordedMessage } from 'generative-ai-use-cases';
import { fileBucketKey } from '@generative-ai-use-cases/common';

/**
 * Upper bound for the images and documents sent to the model in one request.
 *
 * Bedrock rejects a request whose attachments add up to more than about
 * 23 MB with "Input is too long for requested model." (measured with Claude
 * Haiku 5.5 through the Converse API: 23.06 MB of PDFs passed and 24.1 MB
 * failed, whether in one file or split across several). Attachments from
 * earlier turns are sent again with every message, so they count as well.
 */
export const MAX_ATTACHMENT_BYTES = 22 * 1000 * 1000;

export type AttachmentErrorCode =
  | 'ATTACHMENT_NOT_FOUND'
  | 'ATTACHMENTS_TOO_LARGE';

export class AttachmentError extends Error {
  constructor(
    readonly code: AttachmentErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AttachmentError';
  }
}

type ResolveOptions = {
  bucketName: string;
  s3?: S3Client;
};

const isS3Attachment = (extra: ExtraData): boolean =>
  (extra.type === 'image' || extra.type === 'file') &&
  extra.source.type === 's3';

const isNotFound = (e: unknown): boolean => {
  const name = (e as { name?: string })?.name;
  return name === 'NoSuchKey' || name === 'NotFound';
};

/**
 * Replace the S3 URLs of images and documents with their contents.
 *
 * The browser sends only the URL of each uploaded file, so the request to
 * this function stays under the Lambda payload limit (6 MB) however many
 * files the conversation has. The model needs the bytes, so they are read
 * here. Each object is read once even when several messages refer to it.
 *
 * Who may read each file is checked before this is called
 * (`s3ReferencesAllowed` in predictStream.ts). The key is parsed with the same
 * `fileBucketKey`, so the file read here is the file that was checked.
 *
 * Throws AttachmentError when a file is gone or the attachments add up to
 * more than MAX_ATTACHMENT_BYTES; the size is checked from the response
 * headers before any body is read.
 */
export const resolveAttachments = async (
  messages: UnrecordedMessage[],
  { bucketName, s3 = new S3Client({}) }: ResolveOptions
): Promise<UnrecordedMessage[]> => {
  const urls = messages.flatMap(
    (m) =>
      m.extraData?.filter(isS3Attachment).map((extra) => extra.source.data) ??
      []
  );
  if (urls.length === 0) return messages;

  const keys = new Map<string, string>();
  for (const url of new Set(urls)) {
    const key = fileBucketKey(url, bucketName);
    if (key === null) {
      throw new AttachmentError(
        'ATTACHMENT_NOT_FOUND',
        `Not a file in the upload bucket: ${url}`
      );
    }
    keys.set(url, key);
  }

  const responses = new Map(
    await Promise.all(
      [...keys].map(async ([url, key]) => {
        try {
          const response = await s3.send(
            new GetObjectCommand({ Bucket: bucketName, Key: key })
          );
          return [url, response] as const;
        } catch (e) {
          if (isNotFound(e)) {
            throw new AttachmentError(
              'ATTACHMENT_NOT_FOUND',
              `No such file: ${key}`
            );
          }
          throw e;
        }
      })
    )
  );

  const discardBodies = () => {
    for (const response of responses.values()) {
      (response.Body as { destroy?: () => void } | undefined)?.destroy?.();
    }
  };

  // Every reference is sent to the model, so a file attached in an earlier
  // turn counts each time it appears.
  const total = urls.reduce(
    (sum, url) => sum + (responses.get(url)?.ContentLength ?? 0),
    0
  );
  if (total > MAX_ATTACHMENT_BYTES) {
    discardBodies();
    throw new AttachmentError(
      'ATTACHMENTS_TOO_LARGE',
      `Attachments add up to ${total} bytes (limit ${MAX_ATTACHMENT_BYTES})`
    );
  }

  const contents = new Map<string, string>();
  for (const [url, response] of responses) {
    const bytes = await response.Body!.transformToByteArray();
    contents.set(url, Buffer.from(bytes).toString('base64'));
  }

  return messages.map((m) => {
    if (!m.extraData?.some(isS3Attachment)) return m;
    return {
      ...m,
      extraData: m.extraData.map((extra) =>
        isS3Attachment(extra)
          ? {
              ...extra,
              source: {
                type: 'base64',
                mediaType: extra.source.mediaType,
                data: contents.get(extra.source.data)!,
              },
            }
          : extra
      ),
    };
  });
};
