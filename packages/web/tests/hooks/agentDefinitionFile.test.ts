import { describe, it, expect } from 'vitest';

// The names here stand in for what a user would call an agent, and a
// Japanese one is the case worth covering: it has to survive being written
// to a file and read back.
/* eslint-disable i18nhelper/no-jp-string */
import {
  toPortableAgent,
  fromPortableAgent,
  agentFileName,
  applyImportedAgent,
} from '../../src/utils/agentDefinitionFile';

const complete = {
  name: '書類作成エージェント',
  description: 'Officeツールを使って文書を作成する',
  systemPrompt: 'あなたは書類作成エージェントです。',
  modelId: 'global.anthropic.claude-sonnet-4-6',
  mcpServers: ['powerpoint', 'excel'],
  codeExecutionEnabled: true,
};

describe('writing an agent out', () => {
  it('keeps what describes the agent', () => {
    expect(toPortableAgent(complete)).toEqual(complete);
  });

  // The id, the owner and the star count belong to the copy it was read
  // from; carrying them would claim something about whoever imports it.
  it('leaves behind what belongs to the original', () => {
    const written = toPortableAgent({
      ...complete,
      agentId: 'abc',
      createdByEmail: 'someone@example.com',
      isPublic: true,
    } as never);
    expect(written).not.toHaveProperty('agentId');
    expect(written).not.toHaveProperty('createdByEmail');
    expect(written).not.toHaveProperty('isPublic');
  });

  it('fills in what an incomplete agent leaves out', () => {
    expect(toPortableAgent({ name: 'x', systemPrompt: 'y' })).toEqual({
      name: 'x',
      description: '',
      systemPrompt: 'y',
      modelId: '',
      mcpServers: [],
      codeExecutionEnabled: false,
    });
  });
});

describe('reading an agent in', () => {
  it('reads back what it wrote', () => {
    expect(fromPortableAgent(JSON.parse(JSON.stringify(complete)))).toEqual(
      complete
    );
  });

  // The file comes from outside, so a field of the wrong type must not reach
  // the form and fail somewhere further from the cause.
  it('ignores fields that are not the shape they should be', () => {
    const read = fromPortableAgent({
      name: 'x',
      systemPrompt: 'y',
      description: 42,
      mcpServers: 'powerpoint',
      codeExecutionEnabled: 'true',
    });
    expect(read.description).toBe('');
    expect(read.mcpServers).toEqual([]);
    expect(read.codeExecutionEnabled).toBe(false);
  });

  it('drops entries in the server list that are not names', () => {
    const read = fromPortableAgent({
      name: 'x',
      systemPrompt: 'y',
      mcpServers: ['excel', 3, null, 'word'],
    });
    expect(read.mcpServers).toEqual(['excel', 'word']);
  });

  it('refuses something that is not an agent at all', () => {
    for (const junk of [null, 'a string', 42, [], {}, { unrelated: 1 }]) {
      expect(() => fromPortableAgent(junk)).toThrow();
    }
  });

  // codeExecutionEnabled decides whether the agent may run code, so anything
  // short of a literal true is false.
  it('only enables code execution on a real true', () => {
    const on = (value: unknown) =>
      fromPortableAgent({
        name: 'x',
        systemPrompt: 'y',
        codeExecutionEnabled: value,
      }).codeExecutionEnabled;
    expect(on(true)).toBe(true);
    expect(on('true')).toBe(false);
    expect(on(1)).toBe(false);
  });
});

describe('naming the file', () => {
  it('names it after the agent', () => {
    expect(agentFileName('書類作成エージェント')).toBe(
      '書類作成エージェント.json'
    );
  });

  it('drops characters a filesystem would refuse', () => {
    expect(agentFileName('a/b:c*?"<>|d')).toBe('abcd.json');
  });

  it('falls back when the name says nothing', () => {
    expect(agentFileName('')).toBe('agent.json');
    expect(agentFileName('///')).toBe('agent.json');
  });
});

describe('filling the form from an import', () => {
  const available = ['global.anthropic.claude-sonnet-4-6', 'amazon.nova-pro'];

  // Importing over a shared agent and saving must not quietly stop sharing it.
  it('keeps the sharing settings of the agent being edited', () => {
    const { form } = applyImportedAgent({
      portable: complete,
      current: { isPublic: true, tags: ['sales', 'docs'] },
      availableModels: available,
    });
    expect(form.isPublic).toBe(true);
    expect(form.tags).toEqual(['sales', 'docs']);
    expect(form.systemPrompt).toBe(complete.systemPrompt);
  });

  it('starts private and untagged when there is nothing to keep', () => {
    const { form } = applyImportedAgent({
      portable: complete,
      current: null,
      availableModels: available,
    });
    expect(form.isPublic).toBe(false);
    expect(form.tags).toEqual([]);
  });

  it('keeps a model this deployment offers', () => {
    const result = applyImportedAgent({
      portable: complete,
      availableModels: available,
    });
    expect(result.form.modelId).toBe(complete.modelId);
    expect(result.unavailableModelId).toBeNull();
  });

  // A file from another deployment may name a model this one cannot run.
  it('replaces a model this deployment does not offer, and says so', () => {
    const result = applyImportedAgent({
      portable: { ...complete, modelId: 'some.other-model' },
      availableModels: available,
    });
    expect(result.form.modelId).toBe(available[0]);
    expect(result.unavailableModelId).toBe('some.other-model');
  });

  it('falls back without a notice when the file names no model', () => {
    const result = applyImportedAgent({
      portable: { ...complete, modelId: '' },
      availableModels: available,
    });
    expect(result.form.modelId).toBe(available[0]);
    expect(result.unavailableModelId).toBeNull();
  });
});
