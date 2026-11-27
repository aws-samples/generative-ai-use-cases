import { APIGatewayProxyEvent } from 'aws-lambda';

// A token the API Gateway authorizer let through; its payload names a group
jest.mock('../../lambda/utils/auth', () => ({
  verifyToken: async (token: string) =>
    token === 'id-token' ? { 'cognito:groups': ['sales'] } : undefined,
}));

// A deployment that hides drafts from everyone and limits each user to their
// group's documents, as rag-knowledge-base.ts lets an operator configure
jest.mock('@generative-ai-use-cases/common', () => ({
  ...jest.requireActual('@generative-ai-use-cases/common'),
  hiddenStaticExplicitFilters: [
    { notEquals: { key: 'status', value: 'draft' } },
  ],
  getDynamicFilters: (payload: { 'cognito:groups'?: string[] }) => [
    { in: { key: 'group', value: payload['cognito:groups'] ?? [] } },
  ],
}));

const mockSend = jest.fn();
jest.mock('../../lambda/utils/bedrockClient', () => ({
  initBedrockAgentRuntimeClient: async () => ({
    send: (...args: unknown[]) => mockSend(...args),
  }),
}));

import { handler } from '../../lambda/retrieveKnowledgeBase';

function createEvent(opts: {
  body?: unknown;
  authorization?: string;
}): APIGatewayProxyEvent {
  return {
    body: opts.body ? JSON.stringify(opts.body) : null,
    headers: opts.authorization
      ? { Authorization: opts.authorization }
      : {},
    pathParameters: {},
    requestContext: {},
  } as unknown as APIGatewayProxyEvent;
}

const searchConfig = () =>
  mockSend.mock.calls[0][0].input.retrievalConfiguration
    .vectorSearchConfiguration;

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({ retrievalResults: [] });
});

describe('POST /rag-knowledge-base/retrieve access filters', () => {
  test('applies the same filters as the RAG chat', async () => {
    const event = createEvent({
      authorization: 'Bearer id-token',
      body: { query: 'q' },
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(searchConfig().filter).toEqual({
      andAll: [
        { notEquals: { key: 'status', value: 'draft' } },
        { in: { key: 'group', value: ['sales'] } },
      ],
    });
  });

  test('applies filters without Bearer prefix', async () => {
    const event = createEvent({
      authorization: 'id-token',
      body: { query: 'q' },
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    expect(searchConfig().filter).toEqual({
      andAll: [
        { notEquals: { key: 'status', value: 'draft' } },
        { in: { key: 'group', value: ['sales'] } },
      ],
    });
  });

  test('refuses to search without a verified ID token', async () => {
    const event = createEvent({
      authorization: 'not-a-token',
      body: { query: 'q' },
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('refuses to search without Authorization header', async () => {
    const event = createEvent({
      body: { query: 'q' },
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('returns 400 when query is not specified', async () => {
    const event = createEvent({
      authorization: 'Bearer id-token',
      body: {},
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
