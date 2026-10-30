const mockSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: {
      ...actual.DynamoDBDocumentClient,
      from: () => ({ send: mockSend }),
    },
  };
});

process.env.TABLE_NAME = 'test-table';
process.env.STATS_TABLE_NAME = 'test-stats-table';

import { findChatById, findSystemContextById } from '../../lambda/repository';

beforeEach(() => {
  mockSend.mockReset();
});

describe('findChatById', () => {
  // DynamoDB applies FilterExpression after reading a 1 MB page, so a matching item
  // can sit on a later page. The query must follow LastEvaluatedKey.
  it('finds an item that is only on a later page', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { id: 'page-2' } })
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { id: 'page-3' } })
      .mockResolvedValueOnce({
        Items: [{ chatId: 'chat#abc', title: 'found' }],
      });

    const result = await findChatById('user-1', 'abc');

    expect(result).toEqual({ chatId: 'chat#abc', title: 'found' });
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('passes LastEvaluatedKey as ExclusiveStartKey on the next page', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { id: 'page-2' } })
      .mockResolvedValueOnce({ Items: [{ chatId: 'chat#abc' }] });

    await findChatById('user-1', 'abc');

    expect(mockSend.mock.calls[0][0].input.ExclusiveStartKey).toBeUndefined();
    expect(mockSend.mock.calls[1][0].input.ExclusiveStartKey).toEqual({
      id: 'page-2',
    });
  });

  it('returns null when every page is exhausted without a match', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { id: 'page-2' } })
      .mockResolvedValueOnce({ Items: [] });

    const result = await findChatById('user-1', 'missing');

    expect(result).toBeNull();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('does not issue a second query when the first page already matches', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ chatId: 'chat#abc' }] });

    const result = await findChatById('user-1', 'abc');

    expect(result).toEqual({ chatId: 'chat#abc' });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

describe('findSystemContextById', () => {
  it('finds an item that is only on a later page', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { id: 'page-2' } })
      .mockResolvedValueOnce({
        Items: [{ systemContextId: 'systemContext#sc-1' }],
      });

    const result = await findSystemContextById('user-1', 'sc-1');

    expect(result).toEqual({ systemContextId: 'systemContext#sc-1' });
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('returns null when every page is exhausted without a match', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    const result = await findSystemContextById('user-1', 'missing');

    expect(result).toBeNull();
  });
});
