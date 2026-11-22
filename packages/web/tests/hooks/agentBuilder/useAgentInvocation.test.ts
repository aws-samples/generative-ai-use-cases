import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AgentConfiguration } from 'generative-ai-use-cases';

const { agentCore } = vi.hoisted(() => ({
  agentCore: {
    invokeAgentRuntime: vi.fn(),
    getAgentBuilderRuntime: vi.fn(),
  },
}));

vi.mock('../../../src/hooks/useAgentCore', () => ({
  useAgentCore: () => agentCore,
}));

import useAgentInvocation from '../../../src/hooks/agentBuilder/useAgentInvocation';

const agent = {
  agentId: 'agent-1',
  name: 'Expense Assistant',
  mcpServers: ['aws-knowledge'],
  codeExecutionEnabled: true,
  webSearchEnabled: false,
} as unknown as AgentConfiguration;

describe('useAgentInvocation', () => {
  beforeEach(() => {
    agentCore.invokeAgentRuntime.mockReset();
    agentCore.getAgentBuilderRuntime.mockReset();
  });

  it('sends the agent settings to the Agent Builder runtime', () => {
    agentCore.getAgentBuilderRuntime.mockReturnValue({
      name: 'AgentBuilder',
      arn: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/agent-builder',
    });
    const { result } = renderHook(() => useAgentInvocation('/agent-builder/x'));
    const file = new File(['a'], 'a.txt');

    result.current.invokeAgent({
      agent,
      sessionId: 'session-1',
      prompt: 'What is the limit for travel expenses?',
      files: [file],
      modelId: 'global.anthropic.claude-sonnet-5-5',
    });

    expect(agentCore.invokeAgentRuntime).toHaveBeenCalledWith(
      'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/agent-builder',
      'session-1',
      'What is the limit for travel expenses?',
      'DEFAULT',
      [file],
      'current-user',
      ['aws-knowledge'],
      'agent-1',
      'global.anthropic.claude-sonnet-5-5',
      true,
      false
    );
  });

  it('turns tools off that the agent does not set', () => {
    agentCore.getAgentBuilderRuntime.mockReturnValue({ arn: 'arn' });
    const { result } = renderHook(() => useAgentInvocation('/x'));

    result.current.invokeAgent({
      agent: { agentId: 'a', name: 'n' } as unknown as AgentConfiguration,
      sessionId: 's',
      prompt: 'p',
    });

    const args = agentCore.invokeAgentRuntime.mock.calls[0];
    expect(args.slice(9)).toEqual([false, false]);
  });

  it('fails when the deployment has no Agent Builder runtime', () => {
    agentCore.getAgentBuilderRuntime.mockReturnValue(undefined);
    const { result } = renderHook(() => useAgentInvocation('/x'));

    expect(() =>
      result.current.invokeAgent({ agent, sessionId: 's', prompt: 'p' })
    ).toThrow('No AgentBuilder runtime available');
    expect(agentCore.invokeAgentRuntime).not.toHaveBeenCalled();
  });
});
