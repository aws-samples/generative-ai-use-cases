import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { processedStackInputSchema } from '../lib/stack-input';
import { createStacks } from '../lib/create-stacks';

describe('GenerativeAiUseCases', () => {
  test('matches the snapshot', () => {
    const app = new cdk.App();

    const params = processedStackInputSchema.parse({
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
      searchApiKey: 'XXXXXX',
      agents: [],
      flows: [],
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
    });

    const {
      cloudFrontWafStack,
      ragKnowledgeBaseStack,
      agentStack,
      guardrail,
      generativeAiUseCasesStack,
      dashboardStack,
    } = createStacks(app, params);

    // Create Templates
    if (
      !cloudFrontWafStack ||
      !ragKnowledgeBaseStack ||
      !agentStack ||
      !guardrail ||
      !generativeAiUseCasesStack ||
      !dashboardStack
    ) {
      throw new Error('Not all stacks are created');
    }
    const cloudFrontWafTemplate = Template.fromStack(cloudFrontWafStack);
    const ragKnowledgeBaseTemplate = Template.fromStack(ragKnowledgeBaseStack);
    const agentTemplate = Template.fromStack(agentStack);
    const guardrailTemplate = Template.fromStack(guardrail);
    const generativeAiUseCasesTemplate = Template.fromStack(
      generativeAiUseCasesStack
    );
    const dashboardTemplate = Template.fromStack(dashboardStack);

    // Assert
    expect(cloudFrontWafTemplate.toJSON()).toMatchSnapshot();
    expect(ragKnowledgeBaseTemplate.toJSON()).toMatchSnapshot();
    expect(agentTemplate.toJSON()).toMatchSnapshot();
    expect(guardrailTemplate.toJSON()).toMatchSnapshot();
    expect(generativeAiUseCasesTemplate.toJSON()).toMatchSnapshot();
    expect(dashboardTemplate.toJSON()).toMatchSnapshot();
  });
});
