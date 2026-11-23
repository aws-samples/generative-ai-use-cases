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

// uuid ships ESM only, which jest does not transform here
jest.mock('uuid', () => ({ v7: () => 'generated-id' }));

process.env.USECASE_TABLE_NAME = 'usecase-table';

import { AgentContent } from 'generative-ai-use-cases';
import {
  createAgent,
  deleteAgent,
  getAgent,
  updateAgent,
} from '../../../lambda/agentBuilder/repositories/agent-repository';

const TABLE = 'usecase-table';
type Item = Record<string, unknown> & { id: string; dataType: string };
let table: Item[];

const find = (key: { id: string; dataType: string }) =>
  table.find((i) => i.id === key.id && i.dataType === key.dataType);
const remove = (key: { id: string; dataType: string }) => {
  table = table.filter(
    (i) => !(i.id === key.id && i.dataType === key.dataType)
  );
};
const put = (item: Item) => {
  remove(item);
  table.push(item);
};

// Applies the attributes the agent update writes
const update = (op: {
  Key: { id: string; dataType: string };
  ExpressionAttributeValues: Record<string, unknown>;
}) => {
  const item = find(op.Key)!;
  item.isPublic = op.ExpressionAttributeValues[':isPublic'];
  item.systemPrompt = op.ExpressionAttributeValues[':systemPrompt'];
};

// An in-memory table answering the calls the agent repository makes
mockSend.mockImplementation(async (command) => {
  const name = command.constructor.name;
  const input = command.input;
  if (name === 'BatchGetCommand') {
    const keys = input.RequestItems[TABLE].Keys;
    return {
      Responses: {
        [TABLE]: keys.map(find).filter((i: Item | undefined) => i),
      },
    };
  }
  if (name === 'TransactWriteCommand') {
    for (const op of input.TransactItems) {
      if (op.Put) put(op.Put.Item);
      if (op.Delete) remove(op.Delete.Key);
      if (op.Update) update(op.Update);
    }
    return {};
  }
  if (name === 'UpdateCommand') {
    update(input);
    return {};
  }
  if (name === 'PutCommand') {
    put(input.Item);
    return {};
  }
  if (name === 'DeleteCommand') {
    remove(input.Key);
    return {};
  }
  throw new Error(`unexpected command ${name}`);
});

const owner = 'alice';
const agentId = 'a1';
const ownerKey = { id: `agent#${owner}`, dataType: `agent#${agentId}` };
const publicKey = { id: 'public-agents', dataType: `public#${agentId}` };

const content = (isPublic: boolean): AgentContent =>
  ({
    name: 'Agent',
    description: '',
    systemPrompt: 'secret instructions',
    modelId: 'model',
    mcpServers: [],
    codeExecutionEnabled: false,
    tags: [],
    isPublic,
    createdByEmail: 'alice@example.com',
  }) as AgentContent;

const ownerRecord = (isPublic: boolean): Item => ({
  ...ownerKey,
  agentId,
  createdBy: owner,
  starCount: 0,
  ...content(isPublic),
});

describe('agent repository: public and private', () => {
  beforeEach(() => {
    table = [];
  });

  it('publishes and unpublishes the gallery copy with the owner record', async () => {
    put(ownerRecord(false));

    await updateAgent(owner, agentId, content(true));
    expect(find(publicKey)).toBeDefined();
    expect(await getAgent('bob', agentId)).not.toBeNull();

    await updateAgent(owner, agentId, content(false));
    expect(find(ownerKey)?.isPublic).toBe(false);
    expect(find(publicKey)).toBeUndefined();
    expect(await getAgent('bob', agentId)).toBeNull();
  });

  it('removes a gallery copy left behind for an agent that is already private', async () => {
    // The two records disagree, as an earlier pair of saves could leave them
    put(ownerRecord(false));
    put({ ...ownerRecord(true), ...publicKey });
    expect(await getAgent('bob', agentId)).not.toBeNull();

    await updateAgent(owner, agentId, content(false));

    expect(find(publicKey)).toBeUndefined();
    expect(await getAgent('bob', agentId)).toBeNull();
  });

  it('writes both records in one transaction', async () => {
    put(ownerRecord(true));
    mockSend.mockClear();

    await updateAgent(owner, agentId, content(false));

    const writes = mockSend.mock.calls
      .map(([command]) => command.constructor.name)
      .filter((name) => name !== 'BatchGetCommand');
    expect(writes).toEqual(['TransactWriteCommand']);
  });

  it('deletes the gallery copy with the agent even when the owner record says private', async () => {
    put(ownerRecord(false));
    put({ ...ownerRecord(true), ...publicKey });

    await deleteAgent(owner, agentId);

    expect(table).toEqual([]);
  });

  it('creates a public agent and its gallery copy in one transaction', async () => {
    mockSend.mockClear();
    const created = await createAgent(owner, content(true));

    const writes = mockSend.mock.calls.map(
      ([command]) => command.constructor.name
    );
    expect(writes).toEqual(['TransactWriteCommand']);
    expect(
      find({ id: 'public-agents', dataType: `public#${created.agentId}` })
    ).toMatchObject({ agentId: created.agentId, createdBy: owner });
  });

  it('creates a private agent without a gallery copy', async () => {
    const created = await createAgent(owner, content(false));

    expect(
      find({ id: 'public-agents', dataType: `public#${created.agentId}` })
    ).toBeUndefined();
    expect(table).toHaveLength(1);
  });
});
