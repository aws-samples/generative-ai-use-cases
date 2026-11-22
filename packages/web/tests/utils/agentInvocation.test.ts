import { describe, expect, it } from 'vitest';
import {
  agentModelId,
  agentSystemPrompt,
} from '../../src/utils/agentInvocation';

describe('agentSystemPrompt', () => {
  it('puts the name and description after the agent prompt', () => {
    expect(
      agentSystemPrompt({
        name: 'Expense Assistant',
        description: 'Answers questions about the expense rules',
        systemPrompt: 'You answer questions about expenses.',
      })
    ).toBe(`You answer questions about expenses.

Agent Name: Expense Assistant
Agent Description: Answers questions about the expense rules

Please respond as this agent with the specified behavior and personality.`);
  });

  it('fills in a prompt and a description the agent does not have', () => {
    const prompt = agentSystemPrompt({
      name: 'Helper',
      description: '',
      systemPrompt: '',
    });
    expect(prompt.startsWith('You are a helpful assistant.')).toBe(true);
    expect(prompt).toContain('Agent Description: No description provided');
  });
});

describe('agentModelId', () => {
  it('uses the model saved with the agent', () => {
    expect(agentModelId({ modelId: 'b' }, ['a', 'b'])).toBe('b');
  });

  it('falls back to the first model of the deployment', () => {
    expect(agentModelId({ modelId: '' }, ['a', 'b'])).toBe('a');
  });
});
