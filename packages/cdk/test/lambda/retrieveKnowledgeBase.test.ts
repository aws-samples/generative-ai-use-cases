import { invokeHandler } from './api/testApp';

const mockSend = jest.fn();
const mockCallerFilters = jest.fn();
jest.mock('../../lambda/utils/request', () => ({
  ...jest.requireActual('../../lambda/utils/request'),
  // The caller's Knowledge Base filters come from a verified id token
  callerRetrievalFilters: (...args: unknown[]) => mockCallerFilters(...args),
}));
jest.mock('../../lambda/utils/bedrockClient', () => ({
  initBedrockAgentRuntimeClient: async () => ({
    send: (...args: unknown[]) => mockSend(...args),
  }),
}));

// The handler reads the setting at load time, so each case loads it afresh.
const loadHandler = (hybrid: string | undefined, storageType?: string) => {
  if (hybrid === undefined) delete process.env.KNOWLEDGE_BASE_HYBRID_SEARCH;
  else process.env.KNOWLEDGE_BASE_HYBRID_SEARCH = hybrid;
  if (storageType === undefined) delete process.env.KNOWLEDGE_BASE_STORAGE_TYPE;
  else process.env.KNOWLEDGE_BASE_STORAGE_TYPE = storageType;
  let handler: typeof import('../../lambda/retrieveKnowledgeBase').handler;
  jest.isolateModules(() => {
    handler = jest.requireActual('../../lambda/retrieveKnowledgeBase').handler;
  });
  return handler!;
};

const searchConfig = () =>
  mockSend.mock.calls[0][0].input.retrievalConfiguration
    .vectorSearchConfiguration;

beforeEach(() => {
  mockCallerFilters.mockReset();
  mockCallerFilters.mockResolvedValue([]);
  mockSend.mockReset();
  mockSend.mockResolvedValue({ retrievalResults: [] });
});

describe('POST /rag-knowledge-base/retrieve search type', () => {
  test('asks for hybrid search on an OpenSearch Knowledge Base', async () => {
    const res = await invokeHandler(loadHandler('true'), {
      user: 'alice',
      body: { query: 'q' },
    });
    expect(res.statusCode).toBe(200);
    expect(searchConfig().overrideSearchType).toBe('HYBRID');
  });

  test.each([['false'], [undefined]])(
    'leaves the search type to Bedrock otherwise (%s)',
    async (hybrid) => {
      const res = await invokeHandler(loadHandler(hybrid), {
        user: 'alice',
        body: { query: 'q' },
      });
      expect(res.statusCode).toBe(200);
      expect(searchConfig()).not.toHaveProperty('overrideSearchType');
    }
  );
});

describe('POST /rag-knowledge-base/retrieve with a filter (#1416)', () => {
  const department = { equals: { key: 'department', value: 'sales' } };

  test("narrows the caller's filters with each condition, never in place of them", async () => {
    mockCallerFilters.mockResolvedValue([department]);
    const res = await invokeHandler(loadHandler(undefined), {
      user: 'alice',
      body: {
        query: 'q',
        filter: { category: 'AWS', year: { greaterThan: 2020 } },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(searchConfig().filter).toEqual({
      andAll: [
        department,
        { equals: { key: 'category', value: 'AWS' } },
        { greaterThan: { key: 'year', value: 2020 } },
      ],
    });
  });

  test('uses one condition alone when nothing else applies', async () => {
    const res = await invokeHandler(loadHandler(undefined), {
      user: 'alice',
      body: { query: 'q', filter: { tag: { in: ['AWS', 'Bedrock'] } } },
    });
    expect(res.statusCode).toBe(200);
    expect(searchConfig().filter).toEqual({
      in: { key: 'tag', value: ['AWS', 'Bedrock'] },
    });
  });

  test.each([
    [{ year: { between: [1, 2] } }, 'unknown operator between'],
    [{ year: { greaterThan: '2020' } }, 'greaterThan takes a number'],
    [{ tag: { in: [] } }, 'in takes a list of strings'],
    [[], 'must be a JSON object'],
  ])('refuses %j without searching', async (filter, message) => {
    const res = await invokeHandler(loadHandler(undefined), {
      user: 'alice',
      body: { query: 'q', filter },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).toContain(message);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('refuses an operator the vector store does not support', async () => {
    const res = await invokeHandler(loadHandler(undefined, 's3vectors'), {
      user: 'alice',
      body: { query: 'q', filter: { title: { startsWith: 'AWS' } } },
    });
    expect(res.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
