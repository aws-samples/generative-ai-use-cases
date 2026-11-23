// The handlers read these at load time.
process.env.BUCKET_NAME = 'file-bucket';
process.env.AWS_REGION = 'us-east-1';
process.env.MODEL_REGION = 'us-east-1';

import { Router } from 'express';
import { createTestApp, callApi } from './testApp';
import { router as chatsRouter } from '../../../lambda/api/routes/chats';
import { router as systemContextsRouter } from '../../../lambda/api/routes/systemContexts';
import { router as sharesRouter } from '../../../lambda/api/routes/shares';
import { router as useCasesRouter } from '../../../lambda/api/routes/useCases';
import { router as videoRouter } from '../../../lambda/api/routes/video';
import { router as tokenUsageRouter } from '../../../lambda/api/routes/tokenUsage';
import { router as meetingMinutesRouter } from '../../../lambda/api/routes/meetingMinutes';
import { router as transcribeRouter } from '../../../lambda/api/routes/transcribe';
import { router as agentBuilderRouter } from '../../../lambda/api/routes/agentBuilder';
import * as agentHandlers from '../../../lambda/agentBuilder/handlers/agent-handlers';
import * as repository from '../../../lambda/repository';
import * as videoRepository from '../../../lambda/repositoryVideoJob';
import * as useCaseRepository from '../../../lambda/useCaseBuilder/useCaseBuilderRepository';
import * as minutesRepository from '../../../lambda/meetingMinutes/repository';

// Route wiring: method + path -> handler, path parameters, query, body and the
// exact response the web client reads. The handlers' own logic is covered by
// the per-handler suites.

jest.mock('../../../lambda/repository');
jest.mock('../../../lambda/repositoryVideoJob');
jest.mock('../../../lambda/useCaseBuilder/useCaseBuilderRepository');
jest.mock('../../../lambda/meetingMinutes/repository');
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
jest.mock('../../../lambda/agentBuilder/handlers/agent-handlers');

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mock = (fn: unknown) => fn as jest.Mock<any, any>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
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
const systemContexts: [string, Router] = [
  '/systemcontexts',
  systemContextsRouter,
];
const shares: [string, Router] = ['/shares', sharesRouter];
const useCases: [string, Router] = ['/usecases', useCasesRouter];
const video: [string, Router] = ['/video', videoRouter];
const tokenUsage: [string, Router] = ['/token-usage', tokenUsageRouter];
const minutes: [string, Router] = ['/meeting-minutes', meetingMinutesRouter];
const transcribe: [string, Router] = ['/transcribe', transcribeRouter];
const agents: [string, Router] = ['/agents', agentBuilderRouter];

const chat = { id: 'chat#c1', createdDate: '1', title: 't' };

const cases: Case[] = [
  // chats
  {
    name: 'POST /chats',
    mount: chats,
    method: 'POST',
    path: '/chats',
    setup: () => mock(repository.createChat).mockResolvedValue(chat),
    status: 200,
    responseBody: JSON.stringify({ chat }),
    calls: [[repository.createChat, ['alice']]],
  },
  {
    name: 'GET /chats',
    mount: chats,
    method: 'GET',
    path: '/chats',
    query: { exclusiveStartKey: 'k1' },
    setup: () => mock(repository.listChats).mockResolvedValue({ data: [chat] }),
    status: 200,
    responseBody: JSON.stringify({ data: [chat] }),
    calls: [[repository.listChats, ['alice', 'k1']]],
  },
  {
    name: 'GET /chats/:chatId',
    mount: chats,
    method: 'GET',
    path: '/chats/c1',
    setup: () => mock(repository.findChatById).mockResolvedValue(chat),
    status: 200,
    responseBody: JSON.stringify({ chat }),
    calls: [[repository.findChatById, ['alice', 'c1']]],
  },
  {
    name: 'DELETE /chats/:chatId',
    mount: chats,
    method: 'DELETE',
    path: '/chats/c1',
    setup: () =>
      mock(repository.findShareId).mockResolvedValue({
        shareId: 'share#s1',
      }),
    status: 204,
    responseBody: '',
    calls: [
      [repository.deleteChat, ['alice', 'c1']],
      [repository.deleteShareId, ['s1']],
    ],
  },
  {
    name: 'PUT /chats/:chatId/title',
    mount: chats,
    method: 'PUT',
    path: '/chats/c1/title',
    body: { title: 'new', usecase: 'chat' },
    setup: () => {
      mock(repository.findChatById).mockResolvedValue(chat);
      mock(repository.setChatTitle).mockResolvedValue({
        ...chat,
        title: 'new',
      });
    },
    status: 200,
    responseBody: JSON.stringify({ chat: { ...chat, title: 'new' } }),
    calls: [[repository.setChatTitle, ['chat#c1', '1', 'new', 'chat']]],
  },
  {
    name: 'PUT /chats/:chatId/title on another user chat',
    mount: chats,
    method: 'PUT',
    path: '/chats/c1/title',
    body: { title: 'new' },
    setup: () => mock(repository.findChatById).mockResolvedValue(null),
    status: 404,
    responseBody: '',
  },
  {
    name: 'GET /chats/:chatId/messages',
    mount: chats,
    method: 'GET',
    path: '/chats/c1/messages',
    setup: () => {
      mock(repository.findChatById).mockResolvedValue(chat);
      mock(repository.listMessages).mockResolvedValue([{ id: 'm1' }]);
    },
    status: 200,
    responseBody: JSON.stringify({ messages: [{ id: 'm1' }] }),
    calls: [
      [repository.findChatById, ['alice', 'c1']],
      [repository.listMessages, ['c1']],
    ],
  },
  {
    name: 'GET /chats/:chatId/messages on another user chat',
    mount: chats,
    method: 'GET',
    path: '/chats/c1/messages',
    setup: () => mock(repository.findChatById).mockResolvedValue(null),
    status: 403,
    responseBody: JSON.stringify({ message: 'Forbidden' }),
  },
  {
    name: 'GET /chats when the repository fails',
    mount: chats,
    method: 'GET',
    path: '/chats',
    setup: () =>
      mock(repository.listChats).mockRejectedValue(new Error('boom')),
    status: 500,
    responseBody: JSON.stringify({ message: 'Internal Server Error' }),
  },

  // system contexts
  {
    name: 'POST /systemcontexts',
    mount: systemContexts,
    method: 'POST',
    path: '/systemcontexts',
    body: { systemContextTitle: 'st', systemContext: 'sc' },
    setup: () =>
      mock(repository.createSystemContext).mockResolvedValue({ id: 'x' }),
    status: 200,
    responseBody: JSON.stringify({ messages: { id: 'x' } }),
    calls: [[repository.createSystemContext, ['alice', 'st', 'sc']]],
  },
  {
    name: 'GET /systemcontexts',
    mount: systemContexts,
    method: 'GET',
    path: '/systemcontexts',
    setup: () =>
      mock(repository.listSystemContexts).mockResolvedValue([{ id: 'x' }]),
    status: 200,
    responseBody: JSON.stringify([{ id: 'x' }]),
    calls: [[repository.listSystemContexts, ['alice']]],
  },
  {
    name: 'DELETE /systemcontexts/:systemContextId',
    mount: systemContexts,
    method: 'DELETE',
    path: '/systemcontexts/s1',
    status: 204,
    responseBody: '',
    calls: [[repository.deleteSystemContext, ['alice', 's1']]],
  },
  {
    name: 'PUT /systemcontexts/:systemContextId/title',
    mount: systemContexts,
    method: 'PUT',
    path: '/systemcontexts/s1/title',
    body: { title: 'nt' },
    setup: () =>
      mock(repository.updateSystemContextTitle).mockResolvedValue({
        id: 's1',
      }),
    status: 200,
    responseBody: JSON.stringify({ systemContext: { id: 's1' } }),
    calls: [[repository.updateSystemContextTitle, ['alice', 's1', 'nt']]],
  },

  // shares
  {
    name: 'GET /shares/chat/:chatId',
    mount: shares,
    method: 'GET',
    path: '/shares/chat/c1',
    setup: () =>
      mock(repository.findShareId).mockResolvedValue({ shareId: 'share#s1' }),
    status: 200,
    responseBody: JSON.stringify({ shareId: 'share#s1' }),
    calls: [[repository.findShareId, ['alice', 'c1']]],
  },
  {
    name: 'GET /shares/chat/:chatId without a share',
    mount: shares,
    method: 'GET',
    path: '/shares/chat/c1',
    setup: () => mock(repository.findShareId).mockResolvedValue(null),
    status: 204,
    responseBody: '',
  },
  {
    name: 'GET /shares/share/:shareId',
    mount: shares,
    method: 'GET',
    path: '/shares/share/s1',
    setup: () => {
      mock(repository.findUserIdAndChatId).mockResolvedValue({
        userId: 'user#bob',
        chatId: 'chat#c9',
      });
      mock(repository.findChatById).mockResolvedValue(chat);
      mock(repository.listMessages).mockResolvedValue([]);
    },
    status: 200,
    responseBody: JSON.stringify({ chat, messages: [] }),
    calls: [
      [repository.findUserIdAndChatId, ['s1']],
      [repository.findChatById, ['bob', 'c9']],
      [repository.listMessages, ['c9']],
    ],
  },
  {
    name: 'GET /shares/share/:shareId unknown',
    mount: shares,
    method: 'GET',
    path: '/shares/share/s1',
    setup: () => mock(repository.findUserIdAndChatId).mockResolvedValue(null),
    status: 404,
    responseBody: '',
  },

  // use cases
  {
    name: 'GET /usecases',
    mount: useCases,
    method: 'GET',
    path: '/usecases',
    query: { exclusiveStartKey: 'k' },
    setup: () =>
      mock(useCaseRepository.listUseCases).mockResolvedValue({ data: [] }),
    status: 200,
    responseBody: JSON.stringify({ data: [] }),
    calls: [[useCaseRepository.listUseCases, ['alice', 'k']]],
  },
  {
    name: 'GET /usecases/favorite',
    mount: useCases,
    method: 'GET',
    path: '/usecases/favorite',
    setup: () =>
      mock(useCaseRepository.listFavoriteUseCases).mockResolvedValue({
        data: [],
      }),
    status: 200,
    responseBody: JSON.stringify({ data: [] }),
    calls: [[useCaseRepository.listFavoriteUseCases, ['alice', undefined]]],
  },
  {
    name: 'GET /usecases/recent',
    mount: useCases,
    method: 'GET',
    path: '/usecases/recent',
    setup: () =>
      mock(useCaseRepository.listRecentlyUsedUseCases).mockResolvedValue({
        data: [],
      }),
    status: 200,
    responseBody: JSON.stringify({ data: [] }),
    calls: [[useCaseRepository.listRecentlyUsedUseCases, ['alice', undefined]]],
  },
  {
    name: 'PUT /usecases/recent/:useCaseId',
    mount: useCases,
    method: 'PUT',
    path: '/usecases/recent/u1',
    status: 200,
    responseBody: '',
    calls: [[useCaseRepository.updateRecentlyUsedUseCase, ['alice', 'u1']]],
  },
  {
    name: 'GET /usecases/:useCaseId',
    mount: useCases,
    method: 'GET',
    path: '/usecases/u1',
    setup: () =>
      mock(useCaseRepository.getUseCase).mockResolvedValue({ useCaseId: 'u1' }),
    status: 200,
    responseBody: JSON.stringify({ useCaseId: 'u1' }),
    calls: [[useCaseRepository.getUseCase, ['alice', 'u1']]],
  },
  {
    name: 'GET /usecases/:useCaseId not found',
    mount: useCases,
    method: 'GET',
    path: '/usecases/u1',
    setup: () => mock(useCaseRepository.getUseCase).mockResolvedValue(null),
    status: 404,
    responseBody: JSON.stringify({ message: 'Use case not found' }),
  },
  {
    name: 'POST /usecases',
    mount: useCases,
    method: 'POST',
    path: '/usecases',
    body: { title: 't', promptTemplate: 'p' },
    setup: () =>
      mock(useCaseRepository.createUseCase).mockResolvedValue({
        useCaseId: 'u1',
      }),
    status: 200,
    responseBody: JSON.stringify({ useCaseId: 'u1' }),
    calls: [
      [
        useCaseRepository.createUseCase,
        ['alice', { title: 't', promptTemplate: 'p' }],
      ],
    ],
  },
  {
    name: 'PUT /usecases/:useCaseId',
    mount: useCases,
    method: 'PUT',
    path: '/usecases/u1',
    body: { title: 't2' },
    status: 200,
    responseBody: '',
    calls: [
      [useCaseRepository.updateUseCase, ['alice', 'u1', { title: 't2' }]],
    ],
  },
  {
    name: 'DELETE /usecases/:useCaseId',
    mount: useCases,
    method: 'DELETE',
    path: '/usecases/u1',
    status: 204,
    responseBody: '',
    calls: [[useCaseRepository.deleteUseCase, ['alice', 'u1']]],
  },
  {
    name: 'PUT /usecases/:useCaseId/favorite',
    mount: useCases,
    method: 'PUT',
    path: '/usecases/u1/favorite',
    setup: () =>
      mock(useCaseRepository.toggleFavorite).mockResolvedValue({
        isFavorite: true,
      }),
    status: 200,
    responseBody: JSON.stringify({ isFavorite: true }),
    calls: [[useCaseRepository.toggleFavorite, ['alice', 'u1']]],
  },
  {
    name: 'PUT /usecases/:useCaseId/shared',
    mount: useCases,
    method: 'PUT',
    path: '/usecases/u1/shared',
    setup: () =>
      mock(useCaseRepository.toggleShared).mockResolvedValue({
        isShared: true,
      }),
    status: 200,
    responseBody: JSON.stringify({ isShared: true }),
    calls: [[useCaseRepository.toggleShared, ['alice', 'u1']]],
  },

  // video jobs
  {
    name: 'GET /video/generate',
    mount: video,
    method: 'GET',
    path: '/video/generate',
    query: { exclusiveStartKey: 'k' },
    setup: () =>
      mock(videoRepository.listVideoJobs).mockResolvedValue({ data: [] }),
    status: 200,
    responseBody: JSON.stringify({ data: [] }),
    calls: [[videoRepository.listVideoJobs, ['alice', 'k']]],
  },
  {
    name: 'DELETE /video/generate/:createdDate',
    mount: video,
    method: 'DELETE',
    path: '/video/generate/123',
    status: 204,
    responseBody: '',
    calls: [[videoRepository.deleteVideoJob, ['alice', '123']]],
  },

  // token usage
  {
    name: 'GET /token-usage',
    mount: tokenUsage,
    method: 'GET',
    path: '/token-usage',
    query: { startDate: '2026-01-01', endDate: '2026-01-31' },
    setup: () =>
      mock(repository.aggregateTokenUsage).mockResolvedValue([{ d: 1 }]),
    status: 200,
    // The API adds the estimated cost of each day.
    responseBody: JSON.stringify([{ d: 1, estimatedCostUsd: { overall: 0 } }]),
    calls: [
      [repository.aggregateTokenUsage, ['2026-01-01', '2026-01-31', ['alice']]],
    ],
  },
  {
    name: 'GET /token-usage without dates',
    mount: tokenUsage,
    method: 'GET',
    path: '/token-usage',
    status: 400,
    responseBody: JSON.stringify({
      message: 'startDate and endDate parameters are required',
    }),
  },

  // meeting minutes custom prompts
  {
    name: 'GET /meeting-minutes/custom-prompts',
    mount: minutes,
    method: 'GET',
    path: '/meeting-minutes/custom-prompts',
    setup: () =>
      mock(minutesRepository.listMeetingMinutesCustomPrompts).mockResolvedValue(
        [{ id: 'p1' }]
      ),
    status: 200,
    responseBody: JSON.stringify([{ id: 'p1' }]),
    calls: [[minutesRepository.listMeetingMinutesCustomPrompts, ['alice']]],
  },
  {
    name: 'POST /meeting-minutes/custom-prompts',
    mount: minutes,
    method: 'POST',
    path: '/meeting-minutes/custom-prompts',
    body: {
      meetingMinutesCustomPromptTitle: 't',
      meetingMinutesCustomPromptBody: 'b',
    },
    setup: () =>
      mock(
        minutesRepository.createMeetingMinutesCustomPrompt
      ).mockResolvedValue({ id: 'p1' }),
    status: 200,
    responseBody: JSON.stringify({ meetingMinutesCustomPrompt: { id: 'p1' } }),
    calls: [
      [minutesRepository.createMeetingMinutesCustomPrompt, ['alice', 't', 'b']],
    ],
  },
  {
    name: 'PUT /meeting-minutes/custom-prompts/:id',
    mount: minutes,
    method: 'PUT',
    path: '/meeting-minutes/custom-prompts/p1',
    body: {
      meetingMinutesCustomPromptTitle: 't',
      meetingMinutesCustomPromptBody: 'b',
    },
    setup: () =>
      mock(
        minutesRepository.updateMeetingMinutesCustomPrompt
      ).mockResolvedValue({ id: 'p1' }),
    status: 200,
    responseBody: JSON.stringify({ meetingMinutesCustomPrompt: { id: 'p1' } }),
    calls: [
      [
        minutesRepository.updateMeetingMinutesCustomPrompt,
        ['alice', 'p1', 't', 'b'],
      ],
    ],
  },
  {
    name: 'DELETE /meeting-minutes/custom-prompts/:id',
    mount: minutes,
    method: 'DELETE',
    path: '/meeting-minutes/custom-prompts/p1',
    status: 204,
    responseBody: '',
    calls: [
      [minutesRepository.deleteMeetingMinutesCustomPrompt, ['alice', 'p1']],
    ],
  },

  // transcription results are checked against the caller's Cognito sub
  {
    name: 'GET /transcribe/result/:jobName of another user',
    mount: transcribe,
    method: 'GET',
    path: '/transcribe/result/job1',
    setup: () =>
      mockTranscribeSend.mockResolvedValue({
        TranscriptionJob: {
          TranscriptionJobStatus: 'IN_PROGRESS',
          Tags: [{ Key: 'userId', Value: 'sub-bob' }],
        },
      }),
    status: 403,
    responseBody: JSON.stringify({ message: 'Forbidden' }),
  },
  {
    name: 'GET /transcribe/result/:jobName in progress',
    mount: transcribe,
    method: 'GET',
    path: '/transcribe/result/job1',
    setup: () =>
      mockTranscribeSend.mockResolvedValue({
        TranscriptionJob: {
          TranscriptionJobStatus: 'IN_PROGRESS',
          Tags: [{ Key: 'userId', Value: 'sub-alice' }],
        },
      }),
    status: 200,
    responseBody: JSON.stringify({ status: 'IN_PROGRESS' }),
    calls: [
      [
        mockTranscribeSend,
        [
          expect.objectContaining({
            input: { TranscriptionJobName: 'job1' },
          }),
        ],
      ],
    ],
  },

  // agent builder takes the user from the same request context
  {
    name: 'GET /agents/:agentId',
    mount: agents,
    method: 'GET',
    path: '/agents/a1',
    setup: () =>
      mock(agentHandlers.handleGetAgent).mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ agentId: 'a1' }),
      }),
    status: 200,
    responseBody: JSON.stringify({ agentId: 'a1' }),
    calls: [[agentHandlers.handleGetAgent, ['alice', 'a1']]],
  },
];

describe('API routes', () => {
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
    // Every answer but a 204 carries the JSON content type, even when empty
    if (c.status !== 204) {
      expect(res.headers['content-type']).toMatch(/^application\/json/);
    }
    for (const [fn, args] of c.calls ?? []) {
      expect(fn).toHaveBeenCalledWith(...args);
    }
  });

  test('rejects a request without the request context', async () => {
    const app = createTestApp(...chats);
    const res = await callApi(app, { method: 'GET', path: '/chats' });
    expect(res.statusCode).toBe(401);
    expect(repository.listChats).not.toHaveBeenCalled();
  });
});
