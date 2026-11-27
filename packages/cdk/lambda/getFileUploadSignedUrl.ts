import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { GetFileUploadSignedUrlRequest } from 'generative-ai-use-cases';
import { attachmentKey } from '@generative-ai-use-cases/common';
import { requireUserSub, sendText } from './utils/http';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const userSub = requireUserSub(request);
  const req: Partial<GetFileUploadSignedUrlRequest> = request.body ?? {};
  // Transcription and video analysis send only the media format.
  const fileName =
    typeof req.filename === 'string' && req.filename !== ''
      ? req.filename
      : `file.${req.mediaFormat ?? 'bin'}`;

  // The key is chosen here: users/<sub>/attachments/<uuid>/<file name>.
  // The last segment keeps the file name for downloads.
  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: attachmentKey(userSub, uuidv4(), fileName),
  });

  const signedUrl = await getSignedUrl(new S3Client({}), command, {
    expiresIn: 3600,
  });

  return sendText(response, 200, signedUrl);
};
