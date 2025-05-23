import * as cdk from 'aws-cdk-lib';
import {
  StackInput,
  stackInputSchema,
  ProcessedStackInput,
} from './lib/stack-input';
import { ModelConfiguration } from 'generative-ai-use-cases';

// Get parameters from CDK Context
const getContext = (app: cdk.App): StackInput => {
  const params = stackInputSchema.parse(app.node.getAllContext());
  return params;
};

// If you want to define parameters directly
const envs: Record<string, Partial<StackInput>> = {
  // If you want to define an anonymous environment, uncomment the following and the content of cdk.json will be ignored.
  // If you want to define an anonymous environment in parameter.ts, uncomment the following and the content of cdk.json will be ignored.
  // '': {
  //   // Parameters for anonymous environment
  //   // If you want to override the default settings, add the following
  // },
  dev: {
    selfSignUpEnabled: false,
    modelRegion: 'us-west-2',
    modelIds: [
      'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
      'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      'us.anthropic.claude-3-sonnet-20240229-v1:0',
      'us.anthropic.claude-3-haiku-20240307-v1:0',
      'us.amazon.nova-pro-v1:0',
      'us.amazon.nova-lite-v1:0',
      'us.amazon.nova-micro-v1:0',
    ],
    ragKnowledgeBaseEnabled: false,
    ragKnowledgeBaseStandbyReplicas: false,
    ragKnowledgeBaseAdvancedParsing: false,
    ragKnowledgeBaseAdvancedParsingModelId:
      'anthropic.claude-3-sonnet-20240229-v1:0',
    embeddingModelId: 'amazon.titan-embed-text-v2:0',
    rerankingModelId: 'amazon.rerank-v1:0',
    queryDecompositionEnabled: true,
    imageGenerationModelIds: [
      'amazon.nova-canvas-v1:0',
      'amazon.titan-image-generator-v2:0',
      'amazon.titan-image-generator-v1',
      'stability.stable-diffusion-xl-v1',
    ],
    agentEnabled: true,
    searchAgentEnabled: true,
    searchApiKey: '',
    agents: [
      {
        displayName: 'ppt-agent',
        agentId: '51B6DKMLAO',
        aliasId: 'AWGN97G0SA',
      },
    ],
    flows: [
      {
        flowId: 'XCUQVALH1T',
        aliasId: 'R6SWPM7U11',
        flowName: 'image-classification',
        description: 'image->label',
      },
      {
        flowId: 'JWVYVGGHOS',
        aliasId: 'IWYEE3SJ5L',
        flowName: 'cooking',
        description: 'two materials',
      },
    ],
    // allowedIpV4AddressRanges: ["103.4.10.234/32", "90.149.156.252/32"],
    // samlAuthEnabled: true,
    // samlCognitoDomainName: "genu-murakami.auth.ap-northeast-1.amazoncognito.com",
    // samlCognitoFederatedIdentityProviderName: "ADFS",
  },
  staging: {
    // Parameters for staging environment
  },
  prod: {
    // Parameters for production environment
  },
  // If you need other environments, customize them as needed
};

// For backward compatibility, get parameters from CDK Context > parameter.ts
export const getParams = (app: cdk.App): ProcessedStackInput => {
  // By default, get parameters from CDK Context
  let params = getContext(app);

  // If the env matches the ones defined in envs, use the parameters in envs instead of the ones in context
  if (envs[params.env]) {
    params = stackInputSchema.parse({
      ...envs[params.env],
      env: params.env,
    });
  }
  // Make the format of modelIds, imageGenerationModelIds consistent
  const convertToModelConfiguration = (
    models: (string | ModelConfiguration)[],
    defaultRegion: string
  ): ModelConfiguration[] => {
    return models.map((model) =>
      typeof model === 'string'
        ? { modelId: model, region: defaultRegion }
        : model
    );
  };

  return {
    ...params,
    modelIds: convertToModelConfiguration(params.modelIds, params.modelRegion),
    imageGenerationModelIds: convertToModelConfiguration(
      params.imageGenerationModelIds,
      params.modelRegion
    ),
    videoGenerationModelIds: convertToModelConfiguration(
      params.videoGenerationModelIds,
      params.modelRegion
    ),
    speechToSpeechModelIds: convertToModelConfiguration(
      params.speechToSpeechModelIds,
      params.modelRegion
    ),
  };
};
