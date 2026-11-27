import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ExtraData, UnrecordedMessage } from 'generative-ai-use-cases';
import {
  AttachmentError,
  MAX_ATTACHMENT_BYTES,
  resolveAttachments,
} from '../../../lambda/utils/attachments';

const BUCKET = 'file-bucket';
const REGION = 'ap-northeast-1';
const url = (key: string) =>
  `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

const s3File = (
  type: 'image' | 'file',
  key: string,
  mediaType = 'application/pdf'
): ExtraData => ({
  type,
  name: key.split('/').pop()!,
  source: { type: 's3', mediaType, data: url(key) },
});

// A fake S3 client serving the given objects. `sizes` overrides the reported
// ContentLength so the size limit can be tested without large buffers.
const fakeS3 = (
  objects: Record<string, string>,
  sizes: Record<string, number> = {}
) => {
  const destroyed: string[] = [];
  const send = jest.fn(async (command: GetObjectCommand) => {
    const key = command.input.Key!;
    if (!(key in objects)) {
      throw Object.assign(new Error('The specified key does not exist.'), {
        name: 'NoSuchKey',
      });
    }
    const bytes = Buffer.from(objects[key]);
    return {
      ContentLength: sizes[key] ?? bytes.length,
      Body: {
        transformToByteArray: async () => new Uint8Array(bytes),
        destroy: () => destroyed.push(key),
      },
    };
  });
  return { s3: { send } as unknown as S3Client, send, destroyed };
};

const options = (s3: S3Client) => ({ bucketName: BUCKET, s3 });

describe('resolveAttachments keys', () => {
  test('reads the decoded key of the URL', async () => {
    const { s3, send } = fakeS3({ 'abc/report v2.pdf': 'pdf' });
    const messages: UnrecordedMessage[] = [
      {
        role: 'user',
        content: 'x',
        extraData: [s3File('file', 'abc/report%20v2.pdf')],
      },
    ];

    await resolveAttachments(messages, options(s3));

    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: BUCKET,
      Key: 'abc/report v2.pdf',
    });
  });

  test.each([
    ['another bucket', `https://other.s3.${REGION}.amazonaws.com/abc/a.pdf`],
    ['another host', `https://example.com/${BUCKET}/abc/a.pdf`],
    ['the bucket root', `https://${BUCKET}.s3.${REGION}.amazonaws.com/`],
  ])('rejects %s without reading it', async (_, data) => {
    const { s3, send } = fakeS3({});
    const messages: UnrecordedMessage[] = [
      {
        role: 'user',
        content: 'x',
        extraData: [
          {
            type: 'file',
            name: 'a.pdf',
            source: { type: 's3', mediaType: 'application/pdf', data },
          },
        ],
      },
    ];

    await expect(resolveAttachments(messages, options(s3))).rejects.toEqual(
      expect.objectContaining({ code: 'ATTACHMENT_NOT_FOUND' })
    );
    expect(send).not.toHaveBeenCalled();
  });
});

describe('resolveAttachments', () => {
  test('replaces images and documents with their contents', async () => {
    const { s3 } = fakeS3({ 'a/doc.pdf': 'pdf bytes', 'b/cat.png': 'png' });
    const messages: UnrecordedMessage[] = [
      {
        role: 'user',
        content: 'Compare them',
        extraData: [
          s3File('file', 'a/doc.pdf'),
          s3File('image', 'b/cat.png', 'image/png'),
        ],
      },
    ];

    const resolved = await resolveAttachments(messages, options(s3));

    expect(resolved[0].content).toBe('Compare them');
    expect(resolved[0].extraData).toEqual([
      {
        type: 'file',
        name: 'doc.pdf',
        source: {
          type: 'base64',
          mediaType: 'application/pdf',
          data: Buffer.from('pdf bytes').toString('base64'),
        },
      },
      {
        type: 'image',
        name: 'cat.png',
        source: {
          type: 'base64',
          mediaType: 'image/png',
          data: Buffer.from('png').toString('base64'),
        },
      },
    ]);
  });

  test('leaves videos, filters and messages without files as they are', async () => {
    const { s3, send } = fakeS3({});
    const video: ExtraData = {
      type: 'video',
      name: 'clip.mp4',
      source: { type: 's3', mediaType: 'video/mp4', data: 's3://b/clip.mp4' },
    };
    const filter: ExtraData = {
      type: 'json',
      name: 'filter',
      source: { type: 'json', mediaType: 'application/json', data: '{}' },
    };
    const messages: UnrecordedMessage[] = [
      { role: 'user', content: 'hi' },
      { role: 'user', content: 'watch', extraData: [video, filter] },
    ];

    const resolved = await resolveAttachments(messages, options(s3));

    expect(resolved).toEqual(messages);
    expect(send).not.toHaveBeenCalled();
  });

  test('reads a file attached in an earlier turn only once', async () => {
    const { s3, send } = fakeS3({ 'a/doc.pdf': 'pdf' });
    const messages: UnrecordedMessage[] = [
      {
        role: 'user',
        content: 'one',
        extraData: [s3File('file', 'a/doc.pdf')],
      },
      { role: 'assistant', content: 'ok' },
      {
        role: 'user',
        content: 'two',
        extraData: [s3File('file', 'a/doc.pdf')],
      },
    ];

    const resolved = await resolveAttachments(messages, options(s3));

    expect(send).toHaveBeenCalledTimes(1);
    expect(resolved[2].extraData![0].source.type).toBe('base64');
  });

  test('rejects a URL outside the upload bucket without reading it', async () => {
    const { s3, send } = fakeS3({});
    const messages: UnrecordedMessage[] = [
      {
        role: 'user',
        content: 'read this',
        extraData: [
          {
            type: 'file',
            name: 'secret.pdf',
            source: {
              type: 's3',
              mediaType: 'application/pdf',
              data: `https://kb-bucket.s3.${REGION}.amazonaws.com/secret.pdf`,
            },
          },
        ],
      },
    ];

    await expect(resolveAttachments(messages, options(s3))).rejects.toEqual(
      expect.objectContaining({ code: 'ATTACHMENT_NOT_FOUND' })
    );
    expect(send).not.toHaveBeenCalled();
  });

  test('reports a deleted file as not found', async () => {
    const { s3 } = fakeS3({});
    const messages: UnrecordedMessage[] = [
      { role: 'user', content: 'x', extraData: [s3File('file', 'gone.pdf')] },
    ];

    const error = await resolveAttachments(messages, options(s3)).catch(
      (e) => e
    );
    expect(error).toBeInstanceOf(AttachmentError);
    expect(error.code).toBe('ATTACHMENT_NOT_FOUND');
  });

  test('passes other S3 errors through', async () => {
    const send = jest.fn(async () => {
      throw Object.assign(new Error('Access Denied'), { name: 'AccessDenied' });
    });
    const messages: UnrecordedMessage[] = [
      { role: 'user', content: 'x', extraData: [s3File('file', 'a.pdf')] },
    ];

    const error = await resolveAttachments(
      messages,
      options({ send } as unknown as S3Client)
    ).catch((e) => e);
    expect(error).not.toBeInstanceOf(AttachmentError);
    expect(error.name).toBe('AccessDenied');
  });

  test('allows attachments up to the limit', async () => {
    const { s3 } = fakeS3(
      { 'a.pdf': 'a', 'b.pdf': 'b' },
      { 'a.pdf': MAX_ATTACHMENT_BYTES - 1, 'b.pdf': 1 }
    );
    const messages: UnrecordedMessage[] = [
      {
        role: 'user',
        content: 'x',
        extraData: [s3File('file', 'a.pdf'), s3File('file', 'b.pdf')],
      },
    ];

    await expect(
      resolveAttachments(messages, options(s3))
    ).resolves.toHaveLength(1);
  });

  test('stops before reading when the attachments add up to more than the limit, counting earlier turns', async () => {
    const half = MAX_ATTACHMENT_BYTES / 2;
    const { s3, destroyed } = fakeS3(
      { 'a.pdf': 'a', 'b.png': 'b' },
      { 'a.pdf': half, 'b.png': 1 }
    );
    // The same PDF is sent with both user turns, so it counts twice
    const messages: UnrecordedMessage[] = [
      { role: 'user', content: 'one', extraData: [s3File('file', 'a.pdf')] },
      { role: 'assistant', content: 'ok' },
      {
        role: 'user',
        content: 'two',
        extraData: [
          s3File('file', 'a.pdf'),
          s3File('image', 'b.png', 'image/png'),
        ],
      },
    ];

    const error = await resolveAttachments(messages, options(s3)).catch(
      (e) => e
    );
    expect(error).toBeInstanceOf(AttachmentError);
    expect(error.code).toBe('ATTACHMENTS_TOO_LARGE');
    expect(destroyed.sort()).toEqual(['a.pdf', 'b.png']);
  });
});
