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

import {
  createShareId,
  deleteShareId,
  findChatById,
  findSystemContextById,
  listMessages,
  listTokenUsageForDate,
} from '../../lambda/repository';

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

  it('reads the partition newest first', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ chatId: 'chat#abc' }] });

    await findChatById('user-1', 'abc');

    expect(mockSend.mock.calls[0][0].input.ScanIndexForward).toBe(false);
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

  it('reads the partition newest first', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [{ systemContextId: 'systemContext#sc-1' }],
    });

    await findSystemContextById('user-1', 'sc-1');

    expect(mockSend.mock.calls[0][0].input.ScanIndexForward).toBe(false);
  });
});

describe('chat share links', () => {
  // An in-memory table answering the Query and TransactWrite calls the share
  // functions make.
  type Item = Record<string, string>;
  let table: Item[];

  const useTable = () => {
    mockSend.mockImplementation(async (command) => {
      const name = command.constructor.name;
      const input = command.input;
      if (name === 'QueryCommand') {
        const id = input.ExpressionAttributeValues[':id'];
        return { Items: table.filter((item) => item.id === id) };
      }
      if (name === 'TransactWriteCommand') {
        for (const op of input.TransactItems) {
          if (op.Put) table.push(op.Put.Item);
          if (op.Delete) {
            const { id, createdDate } = op.Delete.Key;
            table = table.filter(
              (item) => !(item.id === id && item.createdDate === createdDate)
            );
          }
        }
        return {};
      }
      if (name === 'UpdateCommand') {
        const { id, createdDate } = input.Key;
        const item = table.find(
          (row) => row.id === id && row.createdDate === createdDate
        );
        if (item) item.ownerSub = input.ExpressionAttributeValues[':ownerSub'];
        return {};
      }
      throw new Error(`unexpected command ${name}`);
    });
  };

  beforeEach(() => {
    table = [];
    useTable();
  });

  it('returns the existing link when a chat is shared again', async () => {
    const first = await createShareId('alice', 'c1', 'alice-sub');
    const second = await createShareId('alice', 'c1', 'alice-sub');

    expect(second.shareId.shareId).toBe(first.shareId.shareId);
    expect(table.filter((item) => item.id.startsWith('share#'))).toHaveLength(
      1
    );
    expect(first.userIdAndChatId.ownerSub).toBe('alice-sub');
  });

  it('records the owner sub on a link created before it was kept', async () => {
    table = [
      { id: 'user#alice_chat#c1', createdDate: '1', shareId: 'share#old' },
      {
        id: 'share#old',
        createdDate: '1',
        userId: 'user#alice',
        chatId: 'chat#c1',
      },
    ];

    const share = await createShareId('alice', 'c1', 'alice-sub');

    expect(share.shareId.shareId).toBe('share#old');
    expect(share.userIdAndChatId.ownerSub).toBe('alice-sub');
    expect(table.find((item) => item.id === 'share#old')?.ownerSub).toBe(
      'alice-sub'
    );
  });

  it('revokes every link of the chat, including ones made before', async () => {
    // Two links left by an older version that created one per share
    table = [
      { id: 'user#alice_chat#c1', createdDate: '1', shareId: 'share#old' },
      {
        id: 'share#old',
        createdDate: '1',
        userId: 'user#alice',
        chatId: 'chat#c1',
      },
      { id: 'user#alice_chat#c1', createdDate: '2', shareId: 'share#new' },
      {
        id: 'share#new',
        createdDate: '2',
        userId: 'user#alice',
        chatId: 'chat#c1',
      },
      // Another chat's link stays
      { id: 'user#alice_chat#c2', createdDate: '3', shareId: 'share#other' },
      {
        id: 'share#other',
        createdDate: '3',
        userId: 'user#alice',
        chatId: 'chat#c2',
      },
    ];

    await deleteShareId('new');

    expect(table.map((item) => item.id).sort()).toEqual([
      'share#other',
      'user#alice_chat#c2',
    ]);
  });

  it('removes a pointer that has no share id', async () => {
    table = [
      { id: 'user#alice_chat#c1', createdDate: '1' },
      { id: 'user#alice_chat#c1', createdDate: '2', shareId: 'share#new' },
      {
        id: 'share#new',
        createdDate: '2',
        userId: 'user#alice',
        chatId: 'chat#c1',
      },
    ];

    await deleteShareId('new');

    expect(table).toEqual([]);
  });

  it('does nothing for a link that does not exist', async () => {
    await expect(deleteShareId('missing')).resolves.toBeUndefined();
  });
});

describe('listMessages', () => {
  // A query page stops at 1 MB, so a long chat spans several pages.
  it('returns the messages of every page', async () => {
    mockSend
      .mockResolvedValueOnce({
        Items: [{ messageId: 'm1' }],
        LastEvaluatedKey: { id: 'page-2' },
      })
      .mockResolvedValueOnce({ Items: [{ messageId: 'm2' }] });

    const result = await listMessages('abc');

    expect(result).toEqual([{ messageId: 'm1' }, { messageId: 'm2' }]);
    expect(mockSend.mock.calls[1][0].input.ExclusiveStartKey).toEqual({
      id: 'page-2',
    });
  });
});

describe('listTokenUsageForDate', () => {
  it('reads every page of the day', async () => {
    const page = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({ userId: `u${from + i}` }));
    mockSend
      .mockResolvedValueOnce({
        Items: page(0, 200),
        LastEvaluatedKey: { k: 1 },
      })
      .mockResolvedValueOnce({
        Items: page(200, 200),
        LastEvaluatedKey: { k: 2 },
      })
      .mockResolvedValueOnce({ Items: page(400, 100) });

    const items = await listTokenUsageForDate('2026-11-01');

    expect(items).toHaveLength(500);
    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(mockSend.mock.calls[0][0].input).toMatchObject({
      TableName: 'test-stats-table',
      ExpressionAttributeValues: { ':id': 'stats#2026-11-01' },
    });
    expect(mockSend.mock.calls[1][0].input.ExclusiveStartKey).toEqual({ k: 1 });
    expect(mockSend.mock.calls[2][0].input.ExclusiveStartKey).toEqual({ k: 2 });
  });
});
