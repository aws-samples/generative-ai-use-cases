import './fileRoutesEnv';
import { RecordedMessage } from 'generative-ai-use-cases';
import { handler as downloadHandler } from '../../lambda/getFileDownloadSignedUrl';
import { handler as deleteHandler } from '../../lambda/deleteFile';
import { handler as createMessagesHandler } from '../../lambda/createMessages';
import { handler as startTranscriptionHandler } from '../../lambda/startTranscription';
import { handler as deleteShareIdHandler } from '../../lambda/deleteShareId';
import {
  batchCreateMessages,
  deleteShareId,
  findChatById,
  findUserIdAndChatId,
  listMessages,
} from '../../lambda/repository';
import { callerRetrievalFilters } from '../../lambda/utils/request';
import { InvokeParams, invokeHandler } from './api/testApp';

// How each route applies canAccessFile and the document sources. The rules
// themselves are covered by the table in fileAccess.test.ts.

jest.mock('../../lambda/repository');
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
jest.mock('../../lambda/utils/request', () => ({
  ...jest.requireActual('../../lambda/utils/request'),
  callerRetrievalFilters: jest.fn(),
}));

const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  };
});
jest.mock('../../lambda/utils/bedrockClient', () => ({
  initKnowledgeBaseS3Client: jest.fn(async () => ({ send: mockS3Send })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(
    async (
      _client: unknown,
      command: { input: { Bucket: string; Key: string } }
    ) => `signed:${command.input.Bucket}/${command.input.Key}`
  ),
}));
const mockTranscribeSend = jest.fn();
jest.mock('@aws-sdk/client-transcribe', () => {
  const actual = jest.requireActual('@aws-sdk/client-transcribe');
  return {
    ...actual,
    TranscribeClient: jest
      .fn()
      .mockImplementation(() => ({ send: mockTranscribeSend })),
  };
});

const mocked = <T extends (...args: never[]) => unknown>(fn: T) =>
  fn as unknown as jest.MockedFunction<T>;

const BUCKET = 'file-bucket';
const ALICE_FILE = 'users/alice/attachments/u1/a.png';
const BOB_FILE = 'users/bob/attachments/u2/b.png';
const s3Url = (key: string, bucket = BUCKET) =>
  `https://${bucket}.s3.us-east-1.amazonaws.com/${key}`;

const event = (params: {
  user?: string;
  query?: Record<string, string | string[]>;
  path?: Record<string, string>;
  body?: unknown;
}): InvokeParams => ({
  method: params.body === undefined ? 'GET' : 'POST',
  user: params.user,
  // The caller's sub is their name, so users/alice/... is alice's file
  sub: params.user,
  query: params.query,
  path: params.path,
  body: params.body,
  headers: { authorization: 'token' },
});

const message = (extraKeys: string[]): RecordedMessage =>
  ({
    id: 'chat#c1',
    createdDate: '1',
    messageId: 'm',
    usecase: 'chat',
    userId: 'user#alice',
    feedback: 'none',
    role: 'user',
    content: '',
    extraData: extraKeys.map((key) => ({
      type: 'image',
      name: 'x.png',
      source: { type: 's3', mediaType: 'image/png', data: s3Url(key) },
    })),
  }) as RecordedMessage;

const ALICE_SHARE = {
  id: 'share#s1',
  createdDate: '1',
  userId: 'user#alice',
  chatId: 'chat#c1',
  ownerSub: 'alice',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /file/url', () => {
  const get = (user: string | undefined, query: Record<string, unknown>) =>
    invokeHandler(
      downloadHandler,
      event({ user, query: query as Record<string, string> })
    );

  test('signs the caller own file', async () => {
    const res = await get('alice', { uri: s3Url(ALICE_FILE) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(`signed:${BUCKET}/${ALICE_FILE}`);
  });

  test('refuses another user file, also as a path-style URL', async () => {
    expect((await get('alice', { uri: s3Url(BOB_FILE) })).statusCode).toBe(403);
    const pathStyle = `https://s3.us-east-1.amazonaws.com/${BUCKET}/${BOB_FILE}`;
    expect((await get('alice', { uri: pathStyle })).statusCode).toBe(403);
  });

  test('through a share: loads the shared chat attachments', async () => {
    mocked(findUserIdAndChatId).mockResolvedValue(ALICE_SHARE as never);
    mocked(listMessages).mockResolvedValue([message([ALICE_FILE])]);

    const res = await get('carol', { uri: s3Url(ALICE_FILE), shareId: 's1' });
    expect(res.statusCode).toBe(200);
    expect(listMessages).toHaveBeenCalledWith('c1');
  });

  test('through a share without the owner sub: refused', async () => {
    const legacyShare = { ...ALICE_SHARE, ownerSub: undefined };
    mocked(findUserIdAndChatId).mockResolvedValue(legacyShare as never);
    mocked(listMessages).mockResolvedValue([message([ALICE_FILE])]);

    const res = await get('carol', { uri: s3Url(ALICE_FILE), shareId: 's1' });
    expect(res.statusCode).toBe(403);
  });

  test('through an unknown share: refused', async () => {
    mocked(findUserIdAndChatId).mockResolvedValue(null);
    const res = await get('carol', { uri: s3Url(ALICE_FILE), shareId: 'x' });
    expect(res.statusCode).toBe(403);
  });

  test.each([
    ['the old bucketName/filePrefix parameters', { bucketName: 'b' }],
    ['repeated parameters', { uri: s3Url(ALICE_FILE), shareId: ['a', 'b'] }],
  ])('rejects %s with 400', async (_name, query) => {
    expect((await get('alice', query)).statusCode).toBe(400);
  });

  test('signs nothing for a request without Cognito claims', async () => {
    // API Gateway and the request context middleware answer 401 before a
    // handler runs; a handler that still gets no claims fails closed.
    const res = await get(undefined, { uri: s3Url(ALICE_FILE) });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('signed:');
  });

  test('the file bucket is never signed as a document', async () => {
    const original = process.env.DOCUMENT_SOURCES;
    process.env.DOCUMENT_SOURCES = JSON.stringify([
      { kind: 'knowledgeBase', bucket: BUCKET, prefix: '' },
    ]);
    try {
      mocked(callerRetrievalFilters).mockResolvedValue([]);
      expect((await get('alice', { uri: s3Url(BOB_FILE) })).statusCode).toBe(
        403
      );
      expect(callerRetrievalFilters).not.toHaveBeenCalled();
    } finally {
      process.env.DOCUMENT_SOURCES = original;
    }
  });
});

describe('GET /file/url for cited documents', () => {
  const get = (uri: string) =>
    invokeHandler(downloadHandler, event({ user: 'alice', query: { uri } }));

  test.each([
    ['a Kendra document', s3Url('docs/a.pdf', 'kendra-bucket'), 200],
    ['an AgentCore output in the old layout', s3Url('a/o.csv', 'ac'), 403],
    ['a key outside the source prefix', s3Url('x/a.pdf', 'kendra-bucket'), 403],
    ['any other bucket', s3Url('docs/a.pdf', 'other-bucket'), 403],
    ['a metadata sidecar', s3Url('docs/a.pdf.metadata.json', 'kb-bucket'), 403],
  ])('%s -> %s', async (_name, uri, status) => {
    mocked(callerRetrievalFilters).mockResolvedValue([]);
    expect((await get(uri)).statusCode).toBe(status);
  });

  test('Knowledge Base: evaluates the caller filters on the metadata', async () => {
    mocked(callerRetrievalFilters).mockResolvedValue([
      { equals: { key: 'group', value: 'sales' } },
    ]);
    const metadata = (group: string) => ({
      Body: {
        transformToString: async () =>
          JSON.stringify({ metadataAttributes: { group } }),
      },
    });

    mockS3Send.mockResolvedValueOnce(metadata('sales'));
    expect((await get(s3Url('docs/a.pdf', 'kb-bucket'))).statusCode).toBe(200);

    mockS3Send.mockResolvedValueOnce(metadata('hr'));
    expect((await get(s3Url('docs/a.pdf', 'kb-bucket'))).statusCode).toBe(403);
  });

  test('Knowledge Base: denies when the token cannot be verified', async () => {
    mocked(callerRetrievalFilters).mockResolvedValue(null);
    expect((await get(s3Url('docs/a.pdf', 'kb-bucket'))).statusCode).toBe(403);
  });
});

describe('routes that take a file of the caller', () => {
  test('DELETE /file deletes the caller own file only', async () => {
    const del = (key: string) =>
      invokeHandler(deleteHandler, event({ user: 'alice', query: { key } }));
    expect((await del(BOB_FILE)).statusCode).toBe(403);
    expect(mockS3Send).not.toHaveBeenCalled();
    expect((await del(ALICE_FILE)).statusCode).toBe(204);
    expect(mockS3Send).toHaveBeenCalledTimes(1);
  });

  test('POST /chats/:chatId/messages accepts the sender own uploads only', async () => {
    mocked(findChatById).mockResolvedValue({} as never);
    mocked(batchCreateMessages).mockResolvedValue([]);
    const post = (key: string) =>
      invokeHandler(
        createMessagesHandler,
        event({
          user: 'alice',
          path: { chatId: 'c1' },
          body: { messages: [{ ...message([key]), messageId: 'm2' }] },
        })
      );
    expect((await post(BOB_FILE)).statusCode).toBe(400);
    expect(batchCreateMessages).not.toHaveBeenCalled();
    expect((await post(ALICE_FILE)).statusCode).toBe(200);
  });

  test('POST /transcribe/start takes only the caller own upload', async () => {
    const start = (audioUrl: string) =>
      invokeHandler(
        startTranscriptionHandler,
        event({
          user: 'alice',
          body: { audioUrl, speakerLabel: false, maxSpeakers: 1 },
        })
      );
    expect((await start(s3Url(BOB_FILE))).statusCode).toBe(403);
    expect((await start(s3Url('docs/a.pdf', 'kb'))).statusCode).toBe(403);
    expect(mockTranscribeSend).not.toHaveBeenCalled();

    mockTranscribeSend.mockResolvedValueOnce({
      TranscriptionJob: { TranscriptionJobName: 'job' },
    });
    expect((await start(s3Url(ALICE_FILE))).statusCode).toBe(200);
    expect(mockTranscribeSend.mock.calls[0][0].input.Media.MediaFileUri).toBe(
      `s3://${BUCKET}/${ALICE_FILE}`
    );
  });
});

describe('DELETE /shares/share/:shareId', () => {
  test('only the chat owner can revoke the link', async () => {
    mocked(findUserIdAndChatId).mockResolvedValue(ALICE_SHARE as never);
    const revoke = (user: string) =>
      invokeHandler(
        deleteShareIdHandler,
        event({ user, path: { shareId: 's1' } })
      );

    expect((await revoke('mallory')).statusCode).toBe(403);
    expect(deleteShareId).not.toHaveBeenCalled();
    expect((await revoke('alice')).statusCode).toBe(204);
  });
});
