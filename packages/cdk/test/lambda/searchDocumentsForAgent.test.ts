const mockSend = jest.fn();
const mockCallerFilters = jest.fn();
jest.mock('../../lambda/utils/request', () => ({
  ...jest.requireActual('../../lambda/utils/request'),
  callerRetrievalFilters: (...args: unknown[]) => mockCallerFilters(...args),
}));
jest.mock('../../lambda/utils/bedrockClient', () => ({
  initBedrockAgentRuntimeClient: async () => ({
    send: (...args: unknown[]) => mockSend(...args),
  }),
}));

process.env.MODEL_REGION = 'ap-northeast-1';
process.env.KNOWLEDGE_BASE_ID = 'KB1';

import {
  MAX_PASSAGE_CHARS,
  handler,
} from '../../lambda/searchDocumentsForAgent';

const sent = () => mockSend.mock.calls[0][0].input;
const department = { equals: { key: 'department', value: 'sales' } };

beforeEach(() => {
  mockSend.mockReset();
  mockCallerFilters.mockReset();
  mockCallerFilters.mockResolvedValue([department]);
  mockSend.mockResolvedValue({
    retrievalResults: [
      {
        content: { text: 'x'.repeat(MAX_PASSAGE_CHARS + 100) },
        location: { s3Location: { uri: 's3://bucket/docs/expense rules.pdf' } },
        metadata: {
          title: 'Expense rules',
          'x-amz-bedrock-kb-document-page-number': 3,
        },
        score: 0.8,
      },
    ],
  });
});

describe('search of Agent Builder agents (#1870)', () => {
  test("searches with the caller's filters, from the token", async () => {
    const res = await handler({ idToken: 'token', query: ' expenses ' });
    expect(mockCallerFilters).toHaveBeenCalledWith('token');
    expect(sent().retrievalQuery).toEqual({ text: 'expenses' });
    expect(sent().retrievalConfiguration.vectorSearchConfiguration).toEqual(
      expect.objectContaining({ numberOfResults: 5, filter: department })
    );
    expect(res).toEqual({
      results: [
        {
          title: 'Expense rules',
          url: `https://s3.ap-northeast-1.amazonaws.com/bucket/docs/${encodeURIComponent('expense rules.pdf')}#page=3`,
          text: 'x'.repeat(MAX_PASSAGE_CHARS),
          score: 0.8,
        },
      ],
    });
  });

  test('searches nothing without a verified token', async () => {
    mockCallerFilters.mockResolvedValue(null);
    expect(await handler({ idToken: 'forged', query: 'q' })).toEqual({
      error: 'Unauthorized',
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('needs a query', async () => {
    expect(await handler({ idToken: 'token', query: '  ' })).toEqual({
      error: 'query is required',
    });
    expect(mockCallerFilters).not.toHaveBeenCalled();
  });

  test.each([
    [0, 1],
    [50, 10],
    [3.7, 3],
  ])('asks for %p results as %p', async (asked, expected) => {
    await handler({ idToken: 'token', query: 'q', numberOfResults: asked });
    expect(
      sent().retrievalConfiguration.vectorSearchConfiguration.numberOfResults
    ).toBe(expected);
  });
});
