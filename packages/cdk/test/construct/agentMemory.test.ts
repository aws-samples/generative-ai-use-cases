import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import {
  AGENT_MEMORY_NAMESPACES,
  GenericAgentCore,
} from '../../lib/construct/generic-agent-core';
import { stackInputSchema } from '../../lib/stack-input';

const templateOf = (agentMemoryEnabled: boolean) => {
  const stack = new Stack(new App(), 'TestStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  new GenericAgentCore(stack, 'AgentCore', {
    env: 'dev',
    createAgentBuilderRuntime: true,
    mainRegion: 'ap-northeast-1',
    agentMemoryEnabled,
    agentMemoryExpirationDays: 30,
  });
  return Template.fromStack(stack);
};

describe('Agent Builder memory', () => {
  it('creates no memory unless asked', () => {
    templateOf(false).resourceCountIs('AWS::BedrockAgentCore::Memory', 0);
  });

  it('creates one memory with the three kinds the runtime reads', () => {
    const template = templateOf(true);
    template.resourceCountIs('AWS::BedrockAgentCore::Memory', 1);
    const [memory] = Object.values(
      template.findResources('AWS::BedrockAgentCore::Memory')
    );
    expect(memory.Properties.EventExpiryDuration).toBe(30);
    const namespaces = JSON.stringify(memory.Properties.MemoryStrategies);
    for (const ns of Object.values(AGENT_MEMORY_NAMESPACES)) {
      expect(namespaces).toContain(ns);
    }
  });

  it('tells the Agent Builder runtime which memory to use', () => {
    templateOf(true).hasResourceProperties('AWS::BedrockAgentCore::Runtime', {
      EnvironmentVariables: Match.objectLike({
        AGENT_MEMORY_ID: Match.anyValue(),
      }),
    });
  });

  it('lets the runtime write, read and delete memory', () => {
    const actions = JSON.stringify(
      templateOf(true).findResources('AWS::IAM::Policy')
    );
    for (const action of [
      'bedrock-agentcore:CreateEvent',
      'bedrock-agentcore:RetrieveMemoryRecords',
      'bedrock-agentcore:DeleteMemoryRecord',
      'bedrock-agentcore:BatchDeleteMemoryRecords',
      'bedrock-agentcore:DeleteEvent',
      'bedrock-agentcore:ListSessions',
    ]) {
      expect(actions).toContain(action);
    }
  });
});

describe('Agent Builder memory parameters', () => {
  it('refuses memory without the Agent Builder', () => {
    const result = stackInputSchema.safeParse({
      agentBuilderEnabled: false,
      agentCoreMemoryEnabled: true,
    });
    expect(result.success).toBe(false);
  });

  it('accepts memory with the Agent Builder', () => {
    const result = stackInputSchema.safeParse({
      agentBuilderEnabled: true,
      agentCoreMemoryEnabled: true,
    });
    expect(result.success).toBe(true);
  });
});
