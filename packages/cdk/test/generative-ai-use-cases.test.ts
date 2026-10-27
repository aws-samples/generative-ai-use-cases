import { Match, Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import {
  processedStackInputSchema,
  stackInputSchema,
  StackInput,
} from '../lib/stack-input';
import { createStacks } from '../lib/create-stacks';
import {
  BUNDLING_STACKS,
  DISABLE_ASSET_STAGING_CONTEXT,
} from 'aws-cdk-lib/cx-api';

const appContext = {
  [BUNDLING_STACKS]: [],
  [DISABLE_ASSET_STAGING_CONTEXT]: true,
};

describe('GenerativeAiUseCases', () => {
  const stackInput: Partial<StackInput> = {
    account: '123456890123',
    region: 'us-east-1',
    env: '',
    ragEnabled: true,
    kendraIndexArn: null,
    kendraDataSourceBucketName: null,
    kendraIndexScheduleEnabled: false,
    kendraIndexScheduleCreateCron: null,
    kendraIndexScheduleDeleteCron: null,
    ragKnowledgeBaseEnabled: true,
    ragKnowledgeBaseStandbyReplicas: false,
    ragKnowledgeBaseAdvancedParsing: false,
    ragKnowledgeBaseAdvancedParsingModelId:
      'anthropic.claude-3-sonnet-20240229-v1:0',
    embeddingModelId: 'amazon.titan-embed-text-v2:0',
    selfSignUpEnabled: true,
    allowedSignUpEmailDomains: null,
    samlAuthEnabled: false,
    samlCognitoDomainName: '',
    samlCognitoFederatedIdentityProviderName: '',
    modelRegion: 'us-east-1',
    modelIds: [
      {
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        region: 'us-east-1',
      },
    ],
    imageGenerationModelIds: [
      { modelId: 'stability.stable-diffusion-xl-v1', region: 'us-east-1' },
    ],
    videoGenerationModelIds: [
      { modelId: 'amazon.nova-reel-v1:0', region: 'us-east-1' },
    ],
    speechToSpeechModelIds: [
      { modelId: 'amazon.nova-sonic-v1:0', region: 'us-east-1' },
    ],
    endpointNames: [],
    agentEnabled: true,
    searchAgentEnabled: true,
    searchEngine: 'Brave',
    searchApiKey: 'XXXXXX',
    agents: [],
    flows: [],
    createGenericAgentCoreRuntime: true,
    agentBuilderEnabled: true,
    agentCoreRegion: 'us-east-1',
    agentCoreExternalRuntimes: [],
    allowedIpV4AddressRanges: null,
    allowedIpV6AddressRanges: null,
    allowedCountryCodes: ['JP'],
    hostName: null,
    domainName: null,
    hostedZoneId: null,
    dashboard: true,
    anonymousUsageTracking: true,
    guardrailEnabled: true,
    crossAccountBedrockRoleArn: '',
    useCaseBuilderEnabled: true,
    tagKey: null,
    tagValue: null,
  };

  test('matches the snapshot', () => {
    const app = new cdk.App({
      context: appContext,
    });

    const params = processedStackInputSchema.parse(stackInput);

    const {
      cloudFrontWafStack,
      ragKnowledgeBaseStack,
      agentStack,
      agentCoreStack,
      guardrailStack,
      generativeAiUseCasesStack,
      dashboardStack,
    } = createStacks(app, params);

    // Create Templates
    if (
      !cloudFrontWafStack ||
      !ragKnowledgeBaseStack ||
      !agentStack ||
      !agentCoreStack ||
      !guardrailStack ||
      !generativeAiUseCasesStack ||
      !dashboardStack
    ) {
      throw new Error('Not all stacks are created');
    }
    const cloudFrontWafTemplate = Template.fromStack(cloudFrontWafStack);
    const ragKnowledgeBaseTemplate = Template.fromStack(ragKnowledgeBaseStack);
    const agentTemplate = Template.fromStack(agentStack);
    const agentCoreTemplate = Template.fromStack(agentCoreStack);
    const guardrailTemplate = Template.fromStack(guardrailStack);
    const generativeAiUseCasesTemplate = Template.fromStack(
      generativeAiUseCasesStack
    );
    const dashboardTemplate = Template.fromStack(dashboardStack);

    // Assert
    expect(cloudFrontWafTemplate.toJSON()).toMatchSnapshot();
    expect(ragKnowledgeBaseTemplate.toJSON()).toMatchSnapshot();
    expect(agentTemplate.toJSON()).toMatchSnapshot();
    expect(agentCoreTemplate.toJSON()).toMatchSnapshot();
    expect(guardrailTemplate.toJSON()).toMatchSnapshot();
    expect(generativeAiUseCasesTemplate.toJSON()).toMatchSnapshot();
    expect(dashboardTemplate.toJSON()).toMatchSnapshot();
  });

  test('matches the snapshot (closed network mode)', () => {
    const app = new cdk.App({
      context: appContext,
    });

    const params = processedStackInputSchema.parse({
      ...stackInput,
      closedNetworkMode: true,
    });

    const {
      closedNetworkStack,
      ragKnowledgeBaseStack,
      agentStack,
      agentCoreStack,
      guardrailStack,
      generativeAiUseCasesStack,
      dashboardStack,
    } = createStacks(app, params);

    // Create Templates
    if (
      !closedNetworkStack ||
      !ragKnowledgeBaseStack ||
      !agentStack ||
      !agentCoreStack ||
      !guardrailStack ||
      !generativeAiUseCasesStack ||
      !dashboardStack
    ) {
      throw new Error('Not all stacks are created');
    }
    const closedNetworkTemplate = Template.fromStack(closedNetworkStack);
    const ragKnowledgeBaseTemplate = Template.fromStack(ragKnowledgeBaseStack);
    const agentTemplate = Template.fromStack(agentStack);
    const agentCoreTemplate = Template.fromStack(agentCoreStack);
    const guardrailTemplate = Template.fromStack(guardrailStack);
    const generativeAiUseCasesTemplate = Template.fromStack(
      generativeAiUseCasesStack
    );
    const dashboardTemplate = Template.fromStack(dashboardStack);

    // Assert
    expect(closedNetworkTemplate.toJSON()).toMatchSnapshot();
    expect(ragKnowledgeBaseTemplate.toJSON()).toMatchSnapshot();
    expect(agentTemplate.toJSON()).toMatchSnapshot();
    expect(agentCoreTemplate.toJSON()).toMatchSnapshot();
    expect(guardrailTemplate.toJSON()).toMatchSnapshot();
    expect(generativeAiUseCasesTemplate.toJSON()).toMatchSnapshot();
    expect(dashboardTemplate.toJSON()).toMatchSnapshot();
  });

  test('tagKey functionality', () => {
    // Test with custom tagKey
    const appWithCustomTag = new cdk.App({
      context: appContext,
    });
    const paramsWithCustomTag = processedStackInputSchema.parse({
      ...stackInput,
      tagKey: 'CustomTag',
      tagValue: 'custom-value',
    });

    const stacksWithCustomTag = createStacks(
      appWithCustomTag,
      paramsWithCustomTag
    );

    // Test without tagKey (should use default)
    const appWithoutTagKey = new cdk.App({
      context: appContext,
    });
    const paramsWithoutTagKey = processedStackInputSchema.parse({
      ...stackInput,
      tagKey: null,
      tagValue: 'default-value',
    });

    const stacksWithoutTagKey = createStacks(
      appWithoutTagKey,
      paramsWithoutTagKey
    );

    // Assert that both scenarios create stacks successfully
    expect(stacksWithCustomTag.generativeAiUseCasesStack).toBeDefined();
    expect(stacksWithoutTagKey.generativeAiUseCasesStack).toBeDefined();

    // Test that RagKnowledgeBaseStack is created properly with custom tagKey
    if (stacksWithCustomTag.ragKnowledgeBaseStack) {
      const customTagTemplate = Template.fromStack(
        stacksWithCustomTag.ragKnowledgeBaseStack
      );
      // Check that custom resource uses the custom tag key
      customTagTemplate.hasResourceProperties('Custom::ApplyTags', {
        tag: {
          key: 'CustomTag',
          value: 'custom-value',
        },
      });
    }
  });

  test('matches the snapshot (AgentCore with VPC)', () => {
    const app = new cdk.App();

    // Simulate parameter.ts computed: isAgentCoreNetworkPrivate is derived
    // from VPC/Subnet being both provided. Do not set it manually here.
    const vpcInput = {
      ...stackInput,
      agentCoreVpcId: 'vpc-12345678',
      agentCoreSubnetIds: ['subnet-12345678', 'subnet-87654321'],
    };
    const params = processedStackInputSchema.parse({
      ...vpcInput,
      isAgentCoreNetworkPrivate: !!(
        vpcInput.agentCoreVpcId &&
        vpcInput.agentCoreSubnetIds &&
        vpcInput.agentCoreSubnetIds.length > 0
      ),
    });

    const {
      cloudFrontWafStack,
      ragKnowledgeBaseStack,
      agentStack,
      agentCoreStack,
      guardrailStack,
      generativeAiUseCasesStack,
      dashboardStack,
    } = createStacks(app, params);

    // Create Templates
    if (
      !cloudFrontWafStack ||
      !ragKnowledgeBaseStack ||
      !agentStack ||
      !agentCoreStack ||
      !guardrailStack ||
      !generativeAiUseCasesStack ||
      !dashboardStack
    ) {
      throw new Error('Not all stacks are created');
    }
    const agentCoreTemplate = Template.fromStack(agentCoreStack);

    // Assert
    expect(agentCoreTemplate.toJSON()).toMatchSnapshot();
  });

  test('matches the snapshot (AgentBuilder with web search)', () => {
    const app = new cdk.App();

    const params = processedStackInputSchema.parse({
      ...stackInput,
      agentBuilderEnabled: true,
      agentBuilderWebSearchEnabled: true,
      agentBuilderWebSearchExcludeDomains: ['excluded.example.com'],
    });

    const { agentCoreStack } = createStacks(app, params);

    if (!agentCoreStack) {
      throw new Error('AgentCore stack is not created');
    }
    const agentCoreTemplate = Template.fromStack(agentCoreStack);

    // Assert: the gateway and the web search connector target are created
    agentCoreTemplate.resourceCountIs('AWS::BedrockAgentCore::Gateway', 1);
    agentCoreTemplate.resourceCountIs(
      'AWS::BedrockAgentCore::GatewayTarget',
      1
    );
    agentCoreTemplate.hasResourceProperties(
      'AWS::BedrockAgentCore::Gateway',
      Match.objectLike({
        AuthorizerType: 'AWS_IAM',
        ProtocolType: 'MCP',
      })
    );
    agentCoreTemplate.hasResourceProperties(
      'AWS::BedrockAgentCore::GatewayTarget',
      Match.objectLike({
        TargetConfiguration: {
          Mcp: {
            Connector: {
              Source: { ConnectorId: 'web-search' },
            },
          },
        },
      })
    );
    expect(agentCoreTemplate.toJSON()).toMatchSnapshot();
  });

  test('no web search gateway is created when disabled', () => {
    const app = new cdk.App();

    const params = processedStackInputSchema.parse({
      ...stackInput,
      agentBuilderEnabled: true,
      agentBuilderWebSearchEnabled: false,
    });

    const { agentCoreStack } = createStacks(app, params);

    if (!agentCoreStack) {
      throw new Error('AgentCore stack is not created');
    }
    const agentCoreTemplate = Template.fromStack(agentCoreStack);

    agentCoreTemplate.resourceCountIs('AWS::BedrockAgentCore::Gateway', 0);
    agentCoreTemplate.resourceCountIs(
      'AWS::BedrockAgentCore::GatewayTarget',
      0
    );
  });

  test('AgentCore VPC config requires both vpcId and subnetIds', () => {
    // Only vpcId is provided -> must fail
    expect(() =>
      stackInputSchema.parse({
        ...stackInput,
        agentCoreVpcId: 'vpc-12345678',
        agentCoreSubnetIds: null,
      })
    ).toThrow();

    // Only subnetIds is provided -> must fail
    expect(() =>
      stackInputSchema.parse({
        ...stackInput,
        agentCoreVpcId: null,
        agentCoreSubnetIds: ['subnet-12345678'],
      })
    ).toThrow();

    // Both provided -> must pass
    expect(() =>
      stackInputSchema.parse({
        ...stackInput,
        agentCoreVpcId: 'vpc-12345678',
        agentCoreSubnetIds: ['subnet-12345678'],
      })
    ).not.toThrow();

    // Neither provided -> must pass (PUBLIC mode)
    expect(() =>
      stackInputSchema.parse({
        ...stackInput,
        agentCoreVpcId: null,
        agentCoreSubnetIds: null,
      })
    ).not.toThrow();
  });
});
