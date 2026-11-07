import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { GenericAgentCore } from '../../lib/construct/generic-agent-core';

const maxTokensOf = (modelIds: string[]) => {
  const stack = new Stack(new App(), 'TestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  new GenericAgentCore(stack, 'AgentCore', {
    env: '',
    createGenericRuntime: true,
    createAgentBuilderRuntime: true,
    modelIds,
  });
  const runtimes = Template.fromStack(stack).findResources(
    'AWS::BedrockAgentCore::Runtime'
  );
  return Object.values(runtimes).map((r) => {
    const value = r.Properties.EnvironmentVariables?.MODEL_MAX_TOKENS;
    return value === undefined ? undefined : JSON.parse(value);
  });
};

describe('AgentCore runtime output token limits', () => {
  // Without a limit Bedrock applies its default of 4,096 output tokens, which a
  // tool call carrying a large argument runs into.
  it('gives each runtime the limit the Converse path uses for each model', () => {
    for (const limits of maxTokensOf([
      'global.anthropic.claude-sonnet-5-5',
      'global.anthropic.claude-haiku-5-5',
    ])) {
      expect(limits['global.anthropic.claude-sonnet-5-5']).toBeGreaterThan(
        4096
      );
      expect(limits['global.anthropic.claude-haiku-5-5']).toBeGreaterThan(4096);
    }
  });

  it('leaves out models it has no limit for', () => {
    const [limits] = maxTokensOf([
      'global.anthropic.claude-sonnet-5-5',
      'not-a-model',
    ]);
    expect(Object.keys(limits)).toEqual(['global.anthropic.claude-sonnet-5-5']);
  });

  it('sets nothing when no model has a limit', () => {
    expect(maxTokensOf([])).toEqual([undefined, undefined]);
  });
});
