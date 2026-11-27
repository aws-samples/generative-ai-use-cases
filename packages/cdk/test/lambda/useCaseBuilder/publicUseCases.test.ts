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
// The repository also sends some queries through the plain client
jest.mock('@aws-sdk/client-dynamodb', () => ({
  ...jest.requireActual('@aws-sdk/client-dynamodb'),
  DynamoDBClient: jest.fn(() => ({ send: mockSend })),
}));

process.env.USECASE_TABLE_NAME = 'usecase-table';
process.env.USECASE_ID_INDEX_NAME = 'usecase-id-index';

import { UseCaseContent } from 'generative-ai-use-cases';
import {
  createUseCase,
  deleteUseCase,
  listPublicUseCases,
  toggleFavorite,
  toggleShared,
  updateUseCase,
} from '../../../lambda/useCaseBuilder/useCaseBuilderRepository';

const TABLE = 'usecase-table';
type Item = Record<string, unknown> & { id: string; dataType: string };
let table: Item[];

const sameKey = (a: Item, key: { id: string; dataType: string }) =>
  a.id === key.id && a.dataType === key.dataType;
const remove = (key: { id: string; dataType: string }) => {
  table = table.filter((i) => !sameKey(i, key));
};
const put = (item: Item) => {
  remove(item);
  table.push({ ...item });
};
// Sets every `:name` value of the expression on the attribute `name`
const update = (op: {
  Key: { id: string; dataType: string };
  ExpressionAttributeValues: Record<string, unknown>;
}) => {
  const item = table.find((i) => sameKey(i, op.Key))!;
  for (const [name, value] of Object.entries(op.ExpressionAttributeValues)) {
    item[name.slice(1)] = value;
  }
};
// Answers the partition queries of the table and of the useCaseId index
const query = (input: {
  IndexName?: string;
  ExpressionAttributeValues: Record<string, string>;
  ScanIndexForward?: boolean;
  Limit?: number;
}) => {
  const values = input.ExpressionAttributeValues;
  const prefix = values[':dataTypePrefix'] ?? '';
  let items = table.filter(
    (i) =>
      (input.IndexName
        ? i.useCaseId === values[':useCaseId']
        : i.id === values[':id']) && i.dataType.startsWith(prefix)
  );
  items.sort((a, b) => a.dataType.localeCompare(b.dataType));
  if (input.ScanIndexForward === false) items.reverse();
  if (input.Limit) items = items.slice(0, input.Limit);
  return { Items: items.map((i) => ({ ...i })) };
};

mockSend.mockImplementation(async (command) => {
  const name = command.constructor.name;
  const input = command.input;
  if (name === 'QueryCommand') return query(input);
  if (name === 'PutCommand') return (put(input.Item), {});
  if (name === 'UpdateCommand') return (update(input), {});
  if (name === 'DeleteCommand') return (remove(input.Key), {});
  if (name === 'BatchWriteCommand') {
    for (const r of input.RequestItems[TABLE]) remove(r.DeleteRequest.Key);
    return {};
  }
  if (name === 'TransactWriteCommand') {
    for (const op of input.TransactItems) {
      if (op.Put) put(op.Put.Item);
      if (op.Delete) remove(op.Delete.Key);
      if (op.Update) update(op.Update);
    }
    return {};
  }
  throw new Error(`unexpected command ${name}`);
});

const content = (title: string): UseCaseContent => ({
  title,
  promptTemplate: 'Summarize {{text}}',
});
const publicRecords = () => table.filter((i) => i.id === 'public-use-cases');
const titles = async (userId: string) =>
  (await listPublicUseCases(userId)).data.map((u) => u.title);

describe('public use cases (#907)', () => {
  beforeEach(() => {
    table = [];
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => (now += 1));
  });
  afterEach(() => jest.restoreAllMocks());

  it('lists a use case once it is shared, and drops it when unshared', async () => {
    const { useCaseId } = await createUseCase(
      'alice',
      content('Weekly report')
    );
    expect(await titles('bob')).toEqual([]);

    expect(await toggleShared('alice', useCaseId)).toEqual({ isShared: true });
    expect(publicRecords()).toHaveLength(1);
    const [listed] = (await listPublicUseCases('bob')).data;
    expect(listed).toMatchObject({
      useCaseId,
      title: 'Weekly report',
      isShared: true,
      isMyUseCase: false,
      isFavorite: false,
    });

    expect(await toggleShared('alice', useCaseId)).toEqual({
      isShared: false,
    });
    expect(publicRecords()).toHaveLength(0);
    expect(await titles('bob')).toEqual([]);
  });

  it('lists the most recently shared first, with the viewer favorites and own use cases marked', async () => {
    const a = await createUseCase('alice', content('First'));
    const b = await createUseCase('bob', content('Second'));
    await toggleShared('alice', a.useCaseId);
    await toggleShared('bob', b.useCaseId);
    await toggleFavorite('bob', a.useCaseId);

    const { data } = await listPublicUseCases('bob');
    expect(data.map((u) => [u.title, u.isMyUseCase, u.isFavorite])).toEqual([
      ['Second', true, false],
      ['First', false, true],
    ]);
  });

  it('shows the current content after the owner edits it', async () => {
    const { useCaseId } = await createUseCase('alice', content('Old title'));
    await toggleShared('alice', useCaseId);

    await updateUseCase('alice', useCaseId, content('New title'));

    expect(await titles('bob')).toEqual(['New title']);
    expect(publicRecords()).toHaveLength(1);
  });

  it('adds a use case shared before the list existed when the owner saves it', async () => {
    const { useCaseId } = await createUseCase('alice', content('Older share'));
    // Shared by an earlier version: the flag is set, but there is no record
    table.find((i) => i.useCaseId === useCaseId)!.isShared = true;
    expect(await titles('bob')).toEqual([]);

    await updateUseCase('alice', useCaseId, content('Older share'));

    expect(await titles('bob')).toEqual(['Older share']);
  });

  it('removes the record when the use case is deleted', async () => {
    const { useCaseId } = await createUseCase('alice', content('Gone'));
    await toggleShared('alice', useCaseId);

    await deleteUseCase('alice', useCaseId);

    expect(publicRecords()).toHaveLength(0);
    expect(await titles('bob')).toEqual([]);
  });

  it('does not let another user share or unshare a use case', async () => {
    const { useCaseId } = await createUseCase('alice', content('Mine'));

    expect(await toggleShared('bob', useCaseId)).toEqual({ isShared: false });
    expect(publicRecords()).toHaveLength(0);
  });

  it('skips a record left behind for a use case that is no longer shared', async () => {
    const { useCaseId } = await createUseCase('alice', content('Private'));
    put({
      id: 'public-use-cases',
      dataType: `public#1#${useCaseId}`,
      useCaseId,
    });

    expect(await titles('bob')).toEqual([]);
  });
});
