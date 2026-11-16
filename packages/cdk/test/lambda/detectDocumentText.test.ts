import { APIGatewayProxyEvent } from 'aws-lambda';

const s3Send = jest.fn();
const textractSend = jest.fn();
let textractRegion: string | undefined;

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: s3Send })),
  GetObjectCommand: jest.fn((input) => ({ type: 'Get', input })),
  DeleteObjectCommand: jest.fn((input) => ({ type: 'Delete', input })),
}));
jest.mock('@aws-sdk/client-textract', () => ({
  TextractClient: jest.fn((config: { region?: string }) => {
    textractRegion = config.region;
    return { send: textractSend };
  }),
  DetectDocumentTextCommand: jest.fn((input) => ({ input })),
}));

import { handler } from '../../lambda/detectDocumentText';

const KEY = '123e4567-e89b-42d3-a456-426614174000/scan.png';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

const call = (fileName: unknown) =>
  handler({ body: JSON.stringify({ fileName }) } as APIGatewayProxyEvent);

const deleted = () =>
  s3Send.mock.calls.filter(([c]) => c.type === 'Delete').map(([c]) => c.input);

const mockObject = (bytes: Uint8Array, length = bytes.length) =>
  s3Send.mockImplementation(async (c) =>
    c.type === 'Get'
      ? {
          ContentLength: length,
          Body: { transformToByteArray: async () => bytes },
        }
      : {}
  );

describe('detectDocumentText handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = 'bucket';
    process.env.TEXTRACT_REGION = 'ap-northeast-1';
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('rejects an invalid key without touching S3', async () => {
    const res = await call('../other/object.png');
    expect(res.statusCode).toBe(400);
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('detects text, uses the configured region and deletes the object', async () => {
    mockObject(PNG);
    textractSend.mockResolvedValue({
      Blocks: [
        {
          BlockType: 'LINE',
          Id: 'l1',
          Text: 'abc',
          Confidence: 99,
          Geometry: {
            BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.3, Height: 0.4 },
          },
        },
      ],
    });
    const res = await call(KEY);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.region).toBe('ap-northeast-1');
    expect(body.blockCount).toBe(1);
    expect(body.pages[0].lines[0].boundingBox).toEqual({
      left: 0.1,
      top: 0.2,
      width: 0.3,
      height: 0.4,
    });
    expect(textractRegion).toBe('ap-northeast-1');
    expect(textractSend.mock.calls[0][0].input.Document.Bytes).toBe(PNG);
    expect(deleted()).toEqual([{ Bucket: 'bucket', Key: KEY }]);
  });

  it('returns 400 for unsupported content and still deletes the object', async () => {
    mockObject(new Uint8Array([1, 2, 3, 4]));
    const res = await call(KEY);
    expect(res.statusCode).toBe(400);
    expect(textractSend).not.toHaveBeenCalled();
    expect(deleted()).toHaveLength(1);
  });

  it('returns 400 for files over 10 MB and still deletes the object', async () => {
    mockObject(PNG, 10 * 1024 * 1024 + 1);
    const res = await call(KEY);
    expect(res.statusCode).toBe(400);
    expect(textractSend).not.toHaveBeenCalled();
    expect(deleted()).toHaveLength(1);
  });

  it('maps UnsupportedDocumentException to 400 and deletes the object', async () => {
    mockObject(PNG);
    textractSend.mockRejectedValue(
      Object.assign(new Error('x'), { name: 'UnsupportedDocumentException' })
    );
    const res = await call(KEY);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/multi-page/);
    expect(deleted()).toHaveLength(1);
  });

  it('returns 500 on unexpected errors and still deletes the object', async () => {
    mockObject(PNG);
    textractSend.mockRejectedValue(new Error('boom'));
    const res = await call(KEY);
    expect(res.statusCode).toBe(500);
    expect(deleted()).toHaveLength(1);
  });
});
