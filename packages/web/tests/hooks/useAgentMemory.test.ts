import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useAgentMemory from '../../src/hooks/agentBuilder/useAgentMemory';

const send = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-bedrock-agentcore', () => ({
  BedrockAgentCoreClient: class {
    send = send;
  },
  InvokeAgentRuntimeCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock('@aws-sdk/credential-provider-cognito-identity', () => ({
  fromCognitoIdentityPool: vi.fn(() => ({})),
}));
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(async () => ({
    tokens: { idToken: { toString: () => 'my-id-token' } },
  })),
}));

const reply = (body: unknown) => ({
  response: { transformToString: async () => JSON.stringify(body) },
});
const payloads = () =>
  send.mock.calls.map((c) => JSON.parse(c[0].input.payload));

const ARN =
  'arn:aws:bedrock-agentcore:ap-northeast-1:123456789012:runtime/agent-x';
const record = (id: string) => ({ id, text: id, createdAt: '2026-11-27' });

beforeEach(() => send.mockReset());

describe('useAgentMemory', () => {
  it('asks the runtime with the id token, which decides whose memory', async () => {
    send.mockResolvedValueOnce(
      reply({
        memories: { facts: [record('f1')], preferences: [], summaries: [] },
      })
    );
    const { result } = renderHook(() => useAgentMemory(ARN, 'agent-1'));
    await act(() => result.current.load());
    expect(payloads()[0]).toEqual({
      memory_action: 'list',
      agent_id: 'agent-1',
      id_token: 'my-id-token',
    });
    expect(result.current.memories?.facts.map((m) => m.id)).toEqual(['f1']);
  });

  it('drops a deleted memory at once rather than listing it again', async () => {
    send
      .mockResolvedValueOnce(
        reply({
          memories: {
            facts: [record('f1'), record('f2')],
            preferences: [record('p1')],
            summaries: [],
          },
        })
      )
      .mockResolvedValueOnce(reply({ deleted: true }));
    const { result } = renderHook(() => useAgentMemory(ARN, 'agent-1'));
    await act(() => result.current.load());
    await act(() => result.current.remove('f1'));
    expect(payloads().map((p) => p.memory_action)).toEqual(['list', 'delete']);
    expect(payloads()[1].memory_record_id).toBe('f1');
    expect(result.current.memories?.facts.map((m) => m.id)).toEqual(['f2']);
    expect(result.current.memories?.preferences).toHaveLength(1);
  });

  it('shows the error when the runtime refuses the caller', async () => {
    send.mockResolvedValueOnce(
      reply({
        message: {
          role: 'assistant',
          content: [
            {
              text: 'An error occurred while processing your request: Unauthorized',
            },
          ],
        },
      })
    );
    const { result } = renderHook(() => useAgentMemory(ARN, 'agent-1'));
    await act(() => result.current.load());
    expect(result.current.error).toContain('Unauthorized');
    expect(result.current.memories).toBeNull();
  });
});
