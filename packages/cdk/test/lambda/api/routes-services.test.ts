// The handlers read these at load time.
process.env.BUCKET_NAME = 'file-bucket';
process.env.AWS_REGION = 'us-east-1';
process.env.MODEL_REGION = 'us-east-1';
process.env.INDEX_ID = 'index';
process.env.KNOWLEDGE_BASE_ID = 'kb';

import { Router } from 'express';
import { createTestApp, callApi } from './testApp';
import { router as chatsRouter } from '../../../lambda/api/routes/chats';
import { router as sharesRouter } from '../../../lambda/api/routes/shares';
import { router as fileRouter } from '../../../lambda/api/routes/file';
import { router as imageRouter } from '../../../lambda/api/routes/image';
import { router as predictRouter } from '../../../lambda/api/routes/predict';
import { router as ragRouter } from '../../../lambda/api/routes/rag';
import { router as ragKnowledgeBaseRouter } from '../../../lambda/api/routes/ragKnowledgeBase';
import { router as speechToSpeechRouter } from '../../../lambda/api/routes/speechToSpeech';
import { router as webTextRouter } from '../../../lambda/api/routes/webText';
import { router as transcribeRouter } from '../../../lambda/api/routes/transcribe';
import { router as videoRouter } from '../../../lambda/api/routes/video';
import * as repository from '../../../lambda/repository';
import * as videoRepository from '../../../lambda/repositoryVideoJob';
import api from '../../../lambda/utils/api';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Route wiring for the routes whose handlers call AWS services directly:
// method + path -> handler, parameters, and the exact body the web client
// reads (signed URLs, base64 images and titles are sent as plain strings).

jest.mock('../../../lambda/repository');
jest.mock('../../../lambda/utils/request', () => ({
  ...jest.requireActual('../../../lambda/utils/request'),
  // The caller's Knowledge Base filters come from a verified id token
  callerRetrievalFilters: async () => [],
}));
jest.mock('../../../lambda/repositoryVideoJob');
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));
jest.mock('../../../lambda/utils/api', () => ({
  __esModule: true,
  default: {
    bedrock: {
      invoke: jest.fn(),
      generateImage: jest.fn(),
      generateVideo: jest.fn(),
    },
  },
}));

const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({
      send: (...args: unknown[]) => mockS3Send(...args),
    })),
  };
});
const mockKendraSend = jest.fn();
jest.mock('@aws-sdk/client-kendra', () => {
  const actual = jest.requireActual('@aws-sdk/client-kendra');
  return {
    ...actual,
    KendraClient: jest.fn().mockImplementation(() => ({
      send: (...args: unknown[]) => mockKendraSend(...args),
    })),
  };
});
const mockLambdaSend = jest.fn();
jest.mock('@aws-sdk/client-lambda', () => {
  const actual = jest.requireActual('@aws-sdk/client-lambda');
  return {
    ...actual,
    LambdaClient: jest.fn().mockImplementation(() => ({
      send: (...args: unknown[]) => mockLambdaSend(...args),
    })),
  };
});
const mockTranscribeSend = jest.fn();
jest.mock('@aws-sdk/client-transcribe', () => {
  const actual = jest.requireActual('@aws-sdk/client-transcribe');
  return {
    ...actual,
    TranscribeClient: jest.fn().mockImplementation(() => ({
      send: (...args: unknown[]) => mockTranscribeSend(...args),
    })),
  };
});
const mockAgentRuntimeSend = jest.fn();
jest.mock('../../../lambda/utils/bedrockClient', () => ({
  initBedrockAgentRuntimeClient: async () => ({
    send: (...args: unknown[]) => mockAgentRuntimeSend(...args),
  }),
  initKnowledgeBaseS3Client: async () => ({}),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mock = (fn: unknown) => fn as jest.Mock<any, any>;
const bedrock = api.bedrock as unknown as Record<string, jest.Mock>;

// The test app gives alice the sub `sub-alice`, the owner segment of her keys
const ALICE_FILE = 'users/sub-alice/attachments/u1/a.png';
const ALICE_FILE_URL = `https://file-bucket.s3.us-east-1.amazonaws.com/${ALICE_FILE}`;
const SIGNED_URL = 'https://file-bucket.s3.amazonaws.com/k?X-Amz-Signature=s';
const INTERNAL_ERROR = JSON.stringify({ message: 'Internal Server Error' });
const model = { type: 'bedrock', modelId: 'm' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mock(getSignedUrl).mockResolvedValue(SIGNED_URL);
});

type Case = {
  name: string;
  mount: [string, Router];
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  setup?: () => void;
  status: number;
  responseBody: string;
  calls?: [unknown, unknown[]][];
};

const chats: [string, Router] = ['/chats', chatsRouter];
const shares: [string, Router] = ['/shares', sharesRouter];
const file: [string, Router] = ['/file', fileRouter];
const image: [string, Router] = ['/image', imageRouter];
const predict: [string, Router] = ['/predict', predictRouter];
const rag: [string, Router] = ['/rag', ragRouter];
const ragKb: [string, Router] = ['/rag-knowledge-base', ragKnowledgeBaseRouter];
const speech: [string, Router] = ['/speech-to-speech', speechToSpeechRouter];
const webText: [string, Router] = ['/web-text', webTextRouter];
const transcribe: [string, Router] = ['/transcribe', transcribeRouter];
const video: [string, Router] = ['/video', videoRouter];

const chat = { id: 'user#alice', createdDate: '1', chatId: 'chat#c1' };
const message = {
  id: 'chat#c1',
  createdDate: '10',
  userId: 'user#alice',
  role: 'user',
  content: 'hi',
};

const cases: Case[] = [
  // chats
  {
    name: 'POST /chats/:chatId/messages',
    mount: chats,
    method: 'POST',
    path: '/chats/c1/messages',
    body: { messages: [{ role: 'user', content: 'hi' }] },
    setup: () => {
      mock(repository.findChatById).mockResolvedValue(chat);
      mock(repository.batchCreateMessages).mockResolvedValue([message]);
    },
    status: 200,
    responseBody: JSON.stringify({ messages: [message] }),
    calls: [
      [repository.findChatById, ['alice', 'c1']],
      [
        repository.batchCreateMessages,
        [[{ role: 'user', content: 'hi' }], 'alice', 'c1'],
      ],
    ],
  },
  {
    name: 'POST /chats/:chatId/feedbacks',
    mount: chats,
    method: 'POST',
    path: '/chats/c1/feedbacks',
    body: { createdDate: '10', feedback: 'good' },
    setup: () => {
      mock(repository.listMessages).mockResolvedValue([message]);
      mock(repository.updateFeedback).mockResolvedValue({
        ...message,
        feedback: 'good',
      });
    },
    status: 200,
    responseBody: JSON.stringify({ message: { ...message, feedback: 'good' } }),
    calls: [
      [repository.listMessages, ['c1']],
      [
        repository.updateFeedback,
        ['c1', { createdDate: '10', feedback: 'good' }],
      ],
    ],
  },
  // shares
  {
    name: 'POST /shares/chat/:chatId',
    mount: shares,
    method: 'POST',
    path: '/shares/chat/c1',
    setup: () => {
      mock(repository.findChatById).mockResolvedValue(chat);
      mock(repository.createShareId).mockResolvedValue({ shareId: 's1' });
    },
    status: 200,
    responseBody: JSON.stringify({ shareId: 's1' }),
    calls: [[repository.createShareId, ['alice', 'c1', 'sub-alice']]],
  },
  {
    name: 'DELETE /shares/share/:shareId',
    mount: shares,
    method: 'DELETE',
    path: '/shares/share/s1',
    setup: () =>
      mock(repository.findUserIdAndChatId).mockResolvedValue({
        userId: 'user#alice',
        chatId: 'chat#c1',
      }),
    status: 204,
    responseBody: '',
    calls: [[repository.deleteShareId, ['s1']]],
  },
  // file
  {
    name: 'POST /file/url',
    mount: file,
    method: 'POST',
    path: '/file/url',
    body: { filename: 'a.png', mediaFormat: 'png' },
    status: 200,
    responseBody: SIGNED_URL,
  },
  {
    name: 'GET /file/url',
    mount: file,
    method: 'GET',
    path: '/file/url',
    query: { uri: ALICE_FILE_URL },
    status: 200,
    responseBody: SIGNED_URL,
  },
  {
    name: 'DELETE /file',
    mount: file,
    method: 'DELETE',
    path: '/file',
    query: { key: ALICE_FILE },
    setup: () => mockS3Send.mockResolvedValue({}),
    status: 204,
    responseBody: '',
  },
  // image
  {
    name: 'POST /image/generate',
    mount: image,
    method: 'POST',
    path: '/image/generate',
    body: { model, params: { prompt: 'cat' } },
    setup: () => bedrock.generateImage.mockResolvedValue('aW1hZ2U='),
    status: 200,
    responseBody: 'aW1hZ2U=',
  },
  {
    name: 'POST /image/generate when the model fails',
    mount: image,
    method: 'POST',
    path: '/image/generate',
    body: { model, params: { prompt: 'cat' } },
    setup: () => bedrock.generateImage.mockRejectedValue(new Error('boom')),
    status: 500,
    responseBody: JSON.stringify({ message: 'boom' }),
  },
  // predict
  {
    name: 'POST /predict',
    mount: predict,
    method: 'POST',
    path: '/predict',
    body: { model, messages: [], id: 'p1' },
    setup: () => bedrock.invoke.mockResolvedValue('answer'),
    status: 200,
    responseBody: JSON.stringify('answer'),
  },
  {
    name: 'POST /predict/title',
    mount: predict,
    method: 'POST',
    path: '/predict/title',
    body: {
      prompt: 'p',
      chat: { id: 'user#alice', createdDate: '1', chatId: 'chat#c1' },
      id: 'p1',
    },
    setup: () => {
      mock(repository.findChatById).mockResolvedValue(chat);
      bedrock.invoke.mockResolvedValue('<output>Title</output>');
    },
    status: 200,
    responseBody: 'Title',
    calls: [[repository.setChatTitle, ['user#alice', '1', 'Title', undefined]]],
  },
  {
    name: 'POST /predict/title with an invalid request',
    mount: predict,
    method: 'POST',
    path: '/predict/title',
    body: {},
    status: 500,
    responseBody: INTERNAL_ERROR,
  },
  // rag (Kendra)
  {
    name: 'POST /rag/query',
    mount: rag,
    method: 'POST',
    path: '/rag/query',
    body: { query: 'q' },
    setup: () => mockKendraSend.mockResolvedValue({ ResultItems: [] }),
    status: 200,
    responseBody: JSON.stringify({ ResultItems: [] }),
  },
  {
    name: 'POST /rag/query without a query',
    mount: rag,
    method: 'POST',
    path: '/rag/query',
    body: {},
    status: 400,
    responseBody: JSON.stringify({ error: 'query is not specified' }),
  },
  {
    name: 'POST /rag/query when Kendra fails',
    mount: rag,
    method: 'POST',
    path: '/rag/query',
    body: { query: 'q' },
    setup: () => mockKendraSend.mockRejectedValue(new Error('boom')),
    status: 500,
    responseBody: INTERNAL_ERROR,
  },
  {
    name: 'POST /rag/retrieve',
    mount: rag,
    method: 'POST',
    path: '/rag/retrieve',
    body: { query: 'q' },
    setup: () => mockKendraSend.mockResolvedValue({ ResultItems: [] }),
    status: 200,
    responseBody: JSON.stringify({ ResultItems: [] }),
  },
  {
    name: 'POST /rag/retrieve when Kendra fails',
    mount: rag,
    method: 'POST',
    path: '/rag/retrieve',
    body: { query: 'q' },
    setup: () => mockKendraSend.mockRejectedValue(new Error('boom')),
    status: 500,
    responseBody: INTERNAL_ERROR,
  },
  // rag (Knowledge Base)
  {
    name: 'POST /rag-knowledge-base/retrieve',
    mount: ragKb,
    method: 'POST',
    path: '/rag-knowledge-base/retrieve',
    body: { query: 'q' },
    setup: () =>
      mockAgentRuntimeSend.mockResolvedValue({ retrievalResults: [] }),
    status: 200,
    responseBody: JSON.stringify({ retrievalResults: [] }),
  },
  {
    name: 'POST /rag-knowledge-base/retrieve without a query',
    mount: ragKb,
    method: 'POST',
    path: '/rag-knowledge-base/retrieve',
    body: {},
    status: 400,
    responseBody: JSON.stringify({ error: 'query is not specified' }),
  },
  {
    name: 'POST /rag-knowledge-base/retrieve when Bedrock fails',
    mount: ragKb,
    method: 'POST',
    path: '/rag-knowledge-base/retrieve',
    body: { query: 'q' },
    setup: () => mockAgentRuntimeSend.mockRejectedValue(new Error('boom')),
    status: 500,
    responseBody: INTERNAL_ERROR,
  },
  // speech to speech
  {
    name: 'POST /speech-to-speech',
    mount: speech,
    method: 'POST',
    path: '/speech-to-speech',
    body: { channel: 'ch1', model: { modelId: 'amazon.nova-sonic-v1:0' } },
    setup: () => mockLambdaSend.mockResolvedValue({}),
    status: 200,
    responseBody: JSON.stringify({ channel: 'ch1' }),
  },
  {
    name: 'POST /speech-to-speech with an unknown voice',
    mount: speech,
    method: 'POST',
    path: '/speech-to-speech',
    body: {
      channel: 'ch1',
      model: { modelId: 'amazon.nova-sonic-v1:0' },
      voiceId: 'nobody',
    },
    status: 400,
    responseBody: JSON.stringify({ message: 'Invalid voiceId' }),
  },
  // web text
  {
    name: 'GET /web-text without a url',
    mount: webText,
    method: 'GET',
    path: '/web-text',
    status: 400,
    responseBody: JSON.stringify({ message: 'url is missing' }),
  },
  // transcribe
  {
    name: 'POST /transcribe/start',
    mount: transcribe,
    method: 'POST',
    path: '/transcribe/start',
    body: { audioUrl: `s3://file-bucket/${ALICE_FILE}`, speakerLabel: false },
    setup: () =>
      mockTranscribeSend.mockResolvedValue({
        TranscriptionJob: { TranscriptionJobName: 'test-uuid' },
      }),
    status: 200,
    responseBody: JSON.stringify({ jobName: 'test-uuid' }),
  },
  {
    name: 'POST /transcribe/url',
    mount: transcribe,
    method: 'POST',
    path: '/transcribe/url',
    body: { filename: 'a.mp3', mediaFormat: 'mp3' },
    status: 200,
    responseBody: SIGNED_URL,
  },
  // video
  {
    name: 'POST /video/generate',
    mount: video,
    method: 'POST',
    path: '/video/generate',
    body: { model, params: { prompt: 'cat' } },
    setup: () => {
      bedrock.generateVideo.mockResolvedValue('arn:invocation');
      mock(videoRepository.createJob).mockResolvedValue({ jobId: 'j1' });
    },
    status: 200,
    responseBody: JSON.stringify({ jobId: 'j1' }),
    calls: [
      [
        videoRepository.createJob,
        [
          'alice',
          'sub-alice',
          'arn:invocation',
          { model, params: { prompt: 'cat' } },
        ],
      ],
    ],
  },
];

describe('API routes that call AWS services', () => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', async (_n, c) => {
    c.setup?.();
    const app = createTestApp(c.mount[0], c.mount[1]);
    const res = await callApi(app, {
      method: c.method,
      path: c.path,
      user: 'alice',
      query: c.query,
      body: c.body,
    });
    expect(res.statusCode).toBe(c.status);
    expect(res.body).toBe(c.responseBody);
    if (c.status !== 204) {
      expect(res.headers['content-type']).toMatch(/^application\/json/);
    }
    for (const [fn, args] of c.calls ?? []) {
      expect(fn).toHaveBeenCalledWith(...args);
    }
  });

  test('DELETE /file deletes that key in the file bucket', async () => {
    mockS3Send.mockResolvedValue({});
    const app = createTestApp(...file);
    await callApi(app, {
      method: 'DELETE',
      path: '/file',
      user: 'alice',
      query: { key: ALICE_FILE },
    });
    expect(mockS3Send.mock.calls[0][0].input).toEqual({
      Bucket: 'file-bucket',
      Key: ALICE_FILE,
    });
  });

  test('POST /file/url signs an upload key under a new uuid', async () => {
    const app = createTestApp(...file);
    await callApi(app, {
      method: 'POST',
      path: '/file/url',
      user: 'alice',
      body: { filename: 'a.png' },
    });
    expect(mock(getSignedUrl).mock.calls[0][1].input).toEqual({
      Bucket: 'file-bucket',
      Key: 'users/sub-alice/attachments/test-uuid/a.png',
    });
  });
});
