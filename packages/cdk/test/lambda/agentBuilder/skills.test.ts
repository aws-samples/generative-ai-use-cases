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
let mockNextId = 0;
jest.mock('uuid', () => ({
  v7: () => `00000000-0000-7000-8000-${String(++mockNextId).padStart(12, '0')}`,
}));

jest.mock('../../../lambda/agentBuilder/utils/auth-utils', () => ({
  getUserEmail: async () => undefined,
}));

process.env.USECASE_TABLE_NAME = 'usecase-table';

import { CreateAgentRequest } from 'generative-ai-use-cases';
import * as skillService from '../../../lambda/agentBuilder/services/skill-service';
import * as agentService from '../../../lambda/agentBuilder/services/agent-service';
import {
  handleCreateSkill,
  handleListSkillsOfAgent,
} from '../../../lambda/agentBuilder/handlers/skill-handlers';

const TABLE = 'usecase-table';
type Key = { id: string; dataType: string };
type Item = Record<string, unknown> & Key;
let table: Item[];

const same = (a: Key) => (b: Key) => a.id === b.id && a.dataType === b.dataType;
const find = (key: Key) => table.find(same(key));
const remove = (key: Key) => {
  table = table.filter((i) => !same(key)(i));
};
const put = (item: Item) => {
  remove(item);
  table.push({ ...item });
};

// Keeps only the projected attributes, like DynamoDB does
const project = (
  item: Item,
  expression: string | undefined,
  names: Record<string, string> = {}
) => {
  if (!expression) return item;
  const attributes = expression
    .split(',')
    .map((a) => names[a.trim()] ?? a.trim());
  return Object.fromEntries(
    Object.entries(item).filter(([k]) => attributes.includes(k))
  );
};

const update = (input: {
  Key: Key;
  ConditionExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
  UpdateExpression: string;
}) => {
  const item = find(input.Key);
  if (!item) {
    if (input.ConditionExpression) {
      throw new Error('ConditionalCheckFailedException');
    }
    return undefined;
  }
  for (const assignment of input.UpdateExpression.replace(/^set /, '').split(
    ','
  )) {
    const [left, right] = assignment.split('=').map((s) => s.trim());
    const attribute = input.ExpressionAttributeNames?.[left] ?? left;
    item[attribute] = input.ExpressionAttributeValues[right];
  }
  return item;
};

// An in-memory table answering the calls the repositories make
mockSend.mockImplementation(async (command) => {
  const name = command.constructor.name;
  const input = command.input;
  if (name === 'PutCommand') {
    if (input.ConditionExpression && find(input.Item)) {
      throw new Error('ConditionalCheckFailedException');
    }
    put(input.Item);
    return {};
  }
  if (name === 'GetCommand') {
    return { Item: find(input.Key) };
  }
  if (name === 'QueryCommand') {
    const values = input.ExpressionAttributeValues;
    const items = table.filter(
      (i) =>
        i.id === values[':id'] &&
        i.dataType.startsWith(values[':dataTypePrefix'])
    );
    return {
      Items: items.map((i) =>
        project(i, input.ProjectionExpression, input.ExpressionAttributeNames)
      ),
    };
  }
  if (name === 'BatchGetCommand') {
    const keys: Key[] = input.RequestItems[TABLE].Keys;
    return {
      Responses: {
        [TABLE]: keys.map(find).filter((i): i is Item => i !== undefined),
      },
    };
  }
  if (name === 'UpdateCommand') {
    return { Attributes: update(input) };
  }
  if (name === 'DeleteCommand') {
    remove(input.Key);
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

const skill = (name: string, description = `Use for ${name}.`) => ({
  name,
  description,
  instructions: `Steps for ${name}.`,
});

const agentRequest = (
  skillIds: string[],
  isPublic = false
): CreateAgentRequest => ({
  name: 'Agent',
  description: '',
  systemPrompt: 'Help the user.',
  modelId: 'model',
  mcpServers: [],
  skillIds,
  isPublic,
});

beforeEach(() => {
  table = [];
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('skills', () => {
  it('rejects a second skill with the same name', async () => {
    await skillService.createSkill('alice', skill('weekly-report'));

    await expect(
      skillService.createSkill('alice', skill('weekly-report'))
    ).rejects.toThrow('already exists');
    // Another user may use the name
    await expect(
      skillService.createSkill('bob', skill('weekly-report'))
    ).resolves.toMatchObject({ name: 'weekly-report' });
  });

  it.each([
    [
      'a name that is not lowercase letters, digits and hyphens',
      skill('Weekly Report'),
    ],
    ['a name ending with a hyphen', skill('report-')],
    ['a name with two hyphens in a row', skill('weekly--report')],
    ['a name over 64 characters', skill('a'.repeat(65))],
    ['a description over 1,024 characters', skill('report', 'a'.repeat(1025))],
    [
      'instructions over 50,000 characters',
      { ...skill('report'), instructions: 'a'.repeat(50001) },
    ],
    ['an empty description', skill('report', '   ')],
  ])('rejects %s', async (_, request) => {
    const result = await handleCreateSkill('alice', request);

    expect(result.statusCode).toBe(400);
    expect(table).toEqual([]);
  });

  it('lists skills without their instructions', async () => {
    await skillService.createSkill('alice', skill('weekly-report'));

    const { skills } = await skillService.listSkills('alice');

    expect(skills).toHaveLength(1);
    expect(skills[0]).toMatchObject({ name: 'weekly-report' });
    expect(skills[0]).not.toHaveProperty('instructions');
  });

  it("shows which of the user's agents use a skill", async () => {
    const report = await skillService.createSkill('alice', skill('report'));
    const agent = await agentService.createAgent(
      'alice',
      agentRequest([report.skillId])
    );
    await agentService.createAgent('alice', agentRequest([]));

    const result = await skillService.getSkill('alice', report.skillId);

    expect(result.agents).toEqual([{ agentId: agent.agentId, name: 'Agent' }]);
  });
});

describe('skills of an agent', () => {
  it("does not let an agent use another user's skill", async () => {
    const bobs = await skillService.createSkill('bob', skill('report'));

    await expect(
      agentService.createAgent('alice', agentRequest([bobs.skillId]))
    ).rejects.toThrow('Skill not found');
  });

  it("limits the total length of the descriptions of an agent's skills", async () => {
    const a = await skillService.createSkill(
      'alice',
      skill('a', 'x'.repeat(1000))
    );
    const ids = [a.skillId];
    for (let i = 0; i < 9; i++) {
      const s = await skillService.createSkill(
        'alice',
        skill(`s${i}`, 'x'.repeat(1000))
      );
      ids.push(s.skillId);
    }
    // 10 x 1,000 characters is at the limit
    const agent = await agentService.createAgent('alice', agentRequest(ids));
    expect(agent.skillIds).toEqual(ids);

    const one = await skillService.createSkill('alice', skill('one-more', 'x'));
    await expect(
      agentService.createAgent('alice', agentRequest([...ids, one.skillId]))
    ).rejects.toThrow('10,000 characters or less in total');
  });

  it('refuses a longer description that would put an agent using the skill over the limit', async () => {
    const big = await skillService.createSkill(
      'alice',
      skill('big', 'x'.repeat(1024))
    );
    const ids = [big.skillId];
    for (let i = 0; i < 8; i++) {
      const s = await skillService.createSkill(
        'alice',
        skill(`s${i}`, 'x'.repeat(1024))
      );
      ids.push(s.skillId);
    }
    const small = await skillService.createSkill(
      'alice',
      skill('small', 'x'.repeat(700))
    );
    ids.push(small.skillId);
    await agentService.createAgent('alice', agentRequest(ids));

    // 9 x 1,024 + 1,000 = 10,216 is over; 9 x 1,024 + 784 = 10,000 is at the limit
    await expect(
      skillService.updateSkill(
        'alice',
        small.skillId,
        skill('small', 'x'.repeat(1000))
      )
    ).rejects.toThrow('Agent "Agent" uses this skill');
    await expect(
      skillService.updateSkill(
        'alice',
        small.skillId,
        skill('small', 'x'.repeat(784))
      )
    ).resolves.toMatchObject({ description: 'x'.repeat(784) });
  });

  it('gives the skills of a public agent to another user, from the creator', async () => {
    const first = await skillService.createSkill('alice', skill('first'));
    const second = await skillService.createSkill('alice', skill('second'));
    const agent = await agentService.createAgent(
      'alice',
      agentRequest([second.skillId, first.skillId], true)
    );

    const result = await skillService.listSkillsOfAgent('bob', agent.agentId);

    expect(result.skills.map((s) => s.name)).toEqual(['second', 'first']);
    expect(result.skills[0]).toEqual(skill('second'));
  });

  it('gives no skills of a private agent to another user', async () => {
    const report = await skillService.createSkill('alice', skill('report'));
    const agent = await agentService.createAgent(
      'alice',
      agentRequest([report.skillId])
    );

    const result = await handleListSkillsOfAgent('bob', agent.agentId);

    expect(result.statusCode).toBe(404);
  });

  it('leaves out a skill deleted after it was given to an agent', async () => {
    const kept = await skillService.createSkill('alice', skill('kept'));
    const deleted = await skillService.createSkill('alice', skill('deleted'));
    const agent = await agentService.createAgent(
      'alice',
      agentRequest([kept.skillId, deleted.skillId])
    );

    await skillService.deleteSkill('alice', deleted.skillId);

    const result = await skillService.listSkillsOfAgent('alice', agent.agentId);
    expect(result.skills.map((s) => s.name)).toEqual(['kept']);
  });

  it("gives an unsaved agent only the user's own skills", async () => {
    const mine = await skillService.createSkill('alice', skill('mine'));
    const bobs = await skillService.createSkill('bob', skill('bobs'));

    const result = await skillService.listSkillContents('alice', [
      bobs.skillId,
      mine.skillId,
      mine.skillId,
    ]);

    expect(result.skills).toEqual([skill('mine')]);
  });

  it("keeps the skills in a copy of one's own agent only", async () => {
    const report = await skillService.createSkill('alice', skill('report'));
    const agent = await agentService.createAgent(
      'alice',
      agentRequest([report.skillId], true)
    );

    const own = await agentService.cloneAgent('alice', {
      sourceAgentId: agent.agentId,
    });
    const others = await agentService.cloneAgent('bob', {
      sourceAgentId: agent.agentId,
    });

    expect(own.skillIds).toEqual([report.skillId]);
    expect(others.skillIds).toEqual([]);
  });
});
