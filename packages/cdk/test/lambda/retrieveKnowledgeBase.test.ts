import { invokeHandler } from './api/testApp';

const mockSend = jest.fn();
jest.mock('../../lambda/utils/request', () => ({
  ...jest.requireActual('../../lambda/utils/request'),
  // The caller's Knowledge Base filters come from a verified id token
  callerRetrievalFilters: async () => [],
}));
jest.mock('../../lambda/utils/bedrockClient', () => ({
  initBedrockAgentRuntimeClient: async () => ({
    send: (...args: unknown[]) => mockSend(...args),
  }),
}));

// The handler reads the setting at load time, so each case loads it afresh.
const loadHandler = (hybrid: string | undefined) => {
  if (hybrid === undefined) delete process.env.KNOWLEDGE_BASE_HYBRID_SEARCH;
  else process.env.KNOWLEDGE_BASE_HYBRID_SEARCH = hybrid;
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
