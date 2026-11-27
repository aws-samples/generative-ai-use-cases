import './fileRoutesEnv';
import { PredictRequest } from 'generative-ai-use-cases';
import { verifyToken } from '../../lambda/utils/auth';

// predictStream registers its handler through the Lambda streaming runtime.
(globalThis as unknown as { awslambda: unknown }).awslambda = {
  streamifyResponse: (f: unknown) => f,
};
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
jest.mock('../../lambda/utils/api', () => ({ __esModule: true, default: {} }));
jest.mock('../../lambda/utils/models', () => ({ defaultModel: {} }));
jest.mock('../../lambda/utils/auth');
const s3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual('@aws-sdk/client-s3'),
  S3Client: jest.fn().mockImplementation(() => ({ send: s3Send })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { handler, s3ReferencesAllowed } = require('../../lambda/predictStream');

const BUCKET = 'file-bucket';
const video = (uri: string): PredictRequest => ({
  id: 'x',
  idToken: 'token',
  messages: [
    {
      role: 'user',
      content: 'describe',
      extraData: [
        {
          type: 'video',
          name: 'v.mp4',
          source: { type: 's3', mediaType: 'video/mp4', data: uri },
        },
      ],
    },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  (verifyToken as jest.Mock).mockResolvedValue({ sub: 'alice' });
});

describe('PredictStream S3 references', () => {
  test.each([
    [`s3://${BUCKET}/users/alice/attachments/u/v.mp4`, true],
    [`s3://${BUCKET}/users/bob/attachments/u/v.mp4`, false],
    // A file from an earlier version
    [`s3://${BUCKET}/0b7e5a1c/v.mp4`, false],
    // Not normalized: must not slip past the owner check.
    [`s3://${BUCKET}//users/bob/videos/j/output.mp4`, false],
    [`s3://${BUCKET}/x/../users/bob/videos/j/output.mp4`, false],
    // Another bucket.
    ['s3://other-bucket/users/alice/attachments/u/v.mp4', false],
  ])('%s -> %s', async (uri, expected) => {
    expect(await s3ReferencesAllowed(video(uri))).toBe(expected);
  });

  test.each([
    [
      `https://${BUCKET}.s3.us-east-1.amazonaws.com/users/alice/attachments/u/a.png`,
      true,
    ],
    [
      `https://${BUCKET}.s3.us-east-1.amazonaws.com/users/bob/attachments/u/a.png`,
      false,
    ],
    // A file from an earlier version
    [`https://${BUCKET}.s3.us-east-1.amazonaws.com/0b7e5a1c/a.png`, false],
  ])('image %s -> %s', async (url, expected) => {
    const request: PredictRequest = {
      id: 'x',
      idToken: 'token',
      messages: [
        {
          role: 'user',
          content: 'look',
          extraData: [
            {
              type: 'image',
              name: 'a.png',
              source: { type: 's3', mediaType: 'image/png', data: url },
            },
          ],
        },
      ],
    };
    expect(await s3ReferencesAllowed(request)).toBe(expected);
  });

  test("another user's document is refused before anything is read", async () => {
    const written: string[] = [];
    const stream = {
      write: (chunk: string) => written.push(chunk),
      end: jest.fn(),
    };
    const request: PredictRequest = {
      id: 'x',
      idToken: 'token',
      messages: [
        {
          role: 'user',
          content: 'summarize',
          extraData: [
            {
              type: 'file',
              name: 'b.pdf',
              source: {
                type: 's3',
                mediaType: 'application/pdf',
                data: `https://${BUCKET}.s3.us-east-1.amazonaws.com/users/bob/attachments/u/b.pdf`,
              },
            },
          ],
        },
      ],
    };

    await handler(request, stream, {});

    expect(written.join('')).toContain('ACCESS_DENIED');
    expect(s3Send).not.toHaveBeenCalled();
    expect(stream.end).toHaveBeenCalled();
  });

  test('refused when the token cannot be verified', async () => {
    (verifyToken as jest.Mock).mockResolvedValue(undefined);
    expect(
      await s3ReferencesAllowed(
        video(`s3://${BUCKET}/users/alice/attachments/u/v.mp4`)
      )
    ).toBe(false);
  });
});
