import { afterEach, describe, expect, it, vi } from 'vitest';

const GENERIC =
  'arn:aws:bedrock-agentcore:us-east-1:111122223333:runtime/generic';
const BUILDER =
  'arn:aws:bedrock-agentcore:us-east-1:111122223333:runtime/builder';
const RESEARCH =
  'arn:aws:bedrock-agentcore:us-east-1:111122223333:runtime/research';

// The settings are read when the module loads, so each case loads it afresh
const load = async (jwtAuth: string) => {
  vi.resetModules();
  vi.stubEnv('VITE_APP_AGENT_CORE_JWT_AUTH', jwtAuth);
  vi.stubEnv(
    'VITE_APP_AGENT_CORE_GENERIC_RUNTIME',
    JSON.stringify({ name: 'generic', arn: GENERIC })
  );
  vi.stubEnv(
    'VITE_APP_AGENT_CORE_AGENT_BUILDER_RUNTIME',
    JSON.stringify({ name: 'builder', arn: BUILDER })
  );
  return (await import('../../src/utils/agentCoreAuth')).invokesWithToken;
};

describe('invokesWithToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('calls the runtimes this deployment builds with the token under JWT', async () => {
    const invokesWithToken = await load('true');
    expect(invokesWithToken(GENERIC)).toBe(true);
    expect(invokesWithToken(BUILDER)).toBe(true);
  });

  // The research agent and external runtimes have no JWT authorizer
  it('keeps signing the runtimes that have no JWT authorizer', async () => {
    const invokesWithToken = await load('true');
    expect(invokesWithToken(RESEARCH)).toBe(false);
    expect(invokesWithToken(undefined)).toBe(false);
  });

  it('signs every runtime when JWT authorization is off', async () => {
    const invokesWithToken = await load('false');
    expect(invokesWithToken(GENERIC)).toBe(false);
    expect(invokesWithToken(BUILDER)).toBe(false);
  });
});
