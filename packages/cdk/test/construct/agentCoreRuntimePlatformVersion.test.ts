import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { GenericAgentCore } from '../../lib/construct/generic-agent-core';
import { ResearchAgentCore } from '../../lib/construct/research-agent-core';
import { AgentCoreRuntimePlatformVersion } from '../../lib/utils/agent-core-runtime';
import { stackInputSchema } from '../../lib/stack-input';

const newStack = () =>
  new Stack(new App(), 'TestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
  });

const platformVersions = (stack: Stack) =>
  Object.values(
    Template.fromStack(stack).findResources('AWS::BedrockAgentCore::Runtime')
  ).map((r) => r.Properties.PlatformVersion);

const genericRuntimes = (
  runtimePlatformVersion?: AgentCoreRuntimePlatformVersion
) => {
  const stack = newStack();
  new GenericAgentCore(stack, 'AgentCore', {
    env: '',
    createGenericRuntime: true,
    createAgentBuilderRuntime: true,
    runtimePlatformVersion,
  });
  return platformVersions(stack);
};

describe('AgentCore runtime platform version', () => {
  it('defaults to V1', () => {
    expect(stackInputSchema.parse({}).agentCoreRuntimePlatformVersion).toBe(
      'V1'
    );
  });

  it('leaves PlatformVersion out for V1, so existing runtimes do not change', () => {
    expect(genericRuntimes()).toEqual([undefined, undefined]);
    expect(genericRuntimes('V1')).toEqual([undefined, undefined]);
  });

  it('sets V2 on the generic and Agent Builder runtimes', () => {
    expect(genericRuntimes('V2')).toEqual(['V2', 'V2']);
  });

  it('sets V2 on the research runtime', () => {
    const stack = newStack();
    new ResearchAgentCore(stack, 'ResearchAgentCore', {
      env: '',
      runtimePlatformVersion: 'V2',
    });
    expect(platformVersions(stack)).toEqual(['V2']);
  });

  it('rejects an unknown platform version', () => {
    expect(() =>
      stackInputSchema.parse({ agentCoreRuntimePlatformVersion: 'V3' })
    ).toThrow();
  });
});
