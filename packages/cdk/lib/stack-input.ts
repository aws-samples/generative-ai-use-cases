import { z } from 'zod';

// Base schema without refine
const baseStackInputSchema = z.object({
  account: z.string().default(process.env.CDK_DEFAULT_ACCOUNT ?? ''),
  region: z.string().default(process.env.CDK_DEFAULT_REGION ?? 'us-east-1'),
  env: z.string().default(''),
  anonymousUsageTracking: z.boolean().default(true),

  // Auth
  selfSignUpEnabled: z.boolean().default(true),
  allowedSignUpEmailDomains: z.array(z.string()).nullish(),
  samlAuthEnabled: z.boolean().default(false),
  samlCognitoDomainName: z.string().nullish(),
  samlCognitoFederatedIdentityProviderName: z.string().nullish(),
  // Frontend
  hiddenUseCases: z
    .object({
      generate: z.boolean().optional(),
      summarize: z.boolean().optional(),
      writer: z.boolean().optional(),
      translate: z.boolean().optional(),
      webContent: z.boolean().optional(),
      image: z.boolean().optional(),
      video: z.boolean().optional(),
      videoAnalyzer: z.boolean().optional(),
      diagram: z.boolean().optional(),
      meetingMinutes: z.boolean().optional(),
      voiceChat: z.boolean().optional(),
      transcribe: z.boolean().optional(),
    })
    .default({}),
  // API
  modelRegion: z.string().default('us-east-1'),
  modelIds: z
    .array(
      z.union([
        z.string(),
        z.object({
          modelId: z.string(),
          region: z.string(),
        }),
      ])
    )
    .default([
      'global.anthropic.claude-opus-5',
      'global.anthropic.claude-sonnet-5',
      'global.anthropic.claude-sonnet-4-6',
      'global.anthropic.claude-opus-4-8',
      'global.anthropic.claude-opus-4-7',
      'global.anthropic.claude-opus-4-6-v1',
      'global.anthropic.claude-haiku-4-5-20251001-v1:0',
      'global.amazon.nova-2-lite-v1:0',
      'us.deepseek.r1-v1:0',
    ]),
  imageGenerationModelIds: z
    .array(
      z.union([
        z.string(),
        z.object({
          modelId: z.string(),
          region: z.string(),
        }),
      ])
    )
    .default(['amazon.nova-canvas-v1:0']),
  videoGenerationModelIds: z
    .array(
      z.union([
        z.string(),
        z.object({
          modelId: z.string(),
          region: z.string(),
        }),
      ])
    )
    .default(['amazon.nova-reel-v1:0']),
  speechToSpeechModelIds: z
    .array(
      z.union([
        z.string(),
        z.object({
          modelId: z.string(),
          region: z.string(),
        }),
      ])
    )
    .default(['amazon.nova-2-sonic-v1:0']),
  endpointNames: z
    .array(
      z.union([
        z.string(),
        z.object({
          modelId: z.string(),
          region: z.string(),
        }),
      ])
    )
    .default([]),
  crossAccountBedrockRoleArn: z.string().nullish(),
  // RAG
  ragEnabled: z.boolean().default(false),
  kendraIndexLanguage: z.string().default('ja'),
  kendraIndexArn: z.string().nullish(),
  kendraDataSourceBucketName: z.string().nullish(),
  kendraIndexScheduleEnabled: z.boolean().default(false),
  kendraIndexScheduleCreateCron: z
    .object({
      minute: z.string(),
      hour: z.string(),
      month: z.string(),
      weekDay: z.string(),
    })
    .nullish(),
  kendraIndexScheduleDeleteCron: z
    .object({
      minute: z.string(),
      hour: z.string(),
      month: z.string(),
      weekDay: z.string(),
    })
    .nullish(),
  // RAG KB
  ragKnowledgeBaseEnabled: z.boolean().default(false),
  ragKnowledgeBaseId: z.string().nullish(),
  ragKnowledgeBaseStorageType: z
    .enum(['opensearch', 's3vectors'])
    .default('opensearch'),
  embeddingModelId: z.string().default('amazon.titan-embed-text-v2:0'),
  ragKnowledgeBaseStandbyReplicas: z.boolean().default(false),
  ragKnowledgeBaseAdvancedParsing: z.boolean().default(false),
  ragKnowledgeBaseAdvancedParsingModelId: z
    .string()
    .default('anthropic.claude-3-sonnet-20240229-v1:0'),
  ragKnowledgeBaseBinaryVector: z.boolean().default(false),
  queryDecompositionEnabled: z.boolean().default(false),
  rerankingModelId: z.string().nullish(),
  // Agent
  agentEnabled: z.boolean().default(false),
  agentFoundationModel: z
    .string()
    .default('global.anthropic.claude-sonnet-4-6'),
  searchAgentEnabled: z.boolean().default(false),
  searchApiKey: z.string().nullish(),
  searchEngine: z.enum(['Brave', 'Tavily']).default('Brave'),
  agents: z
    .array(
      z.object({
        displayName: z.string(),
        agentId: z.string(),
        aliasId: z.string(),
        description: z.string().default(''),
      })
    )
    .default([]),
  inlineAgents: z.boolean().default(false),
  // Agent Core Runtime
  agentBuilderEnabled: z.boolean().default(false),
  createGenericAgentCoreRuntime: z.boolean().default(false),
  agentCoreRegion: z.string().nullish(),
  agentCoreGatewayArns: z.array(z.string()).nullish(),
  agentCoreExternalRuntimes: z
    .array(
      z.object({
        name: z.string(),
        arn: z.string(),
        description: z.string().default(''),
        display_name: z.string().optional(),
      })
    )
    .default([]),
  // Agent Core Network Configuration
  agentCoreVpcId: z.string().nullish(),
  agentCoreSubnetIds: z.array(z.string()).nullish(),
  // Research Agent Core Runtime
  researchAgentEnabled: z.boolean().default(false),
  createResearchAgentFargate: z.boolean().default(false),
  researchAgentBraveApiKey: z.string().default(''),
  researchAgentTavilyApiKey: z.string().default(''),
  // MCP
  mcpEnabled: z.boolean().default(false),
  // Guardrail
  guardrailEnabled: z.boolean().default(false),
  // Usecase builder
  useCaseBuilderEnabled: z.boolean().default(true),
  // Flows
  flows: z
    .array(
      z.object({
        flowId: z.string(),
        aliasId: z.string(),
        flowName: z.string(),
        description: z.string(),
      })
    )
    .default([]),
  // WAF
  allowedIpV4AddressRanges: z.array(z.string()).nullish(),
  allowedIpV6AddressRanges: z.array(z.string()).nullish(),
  allowedCountryCodes: z.array(z.string()).nullish(),
  // Custom Domain
  hostName: z.string().nullish(),
  domainName: z.string().nullish(),
  hostedZoneId: z.string().nullish(),
  // Dashboard
  dashboard: z.boolean().default(false),
  // Tag
  tagKey: z.string().nullish(),
  tagValue: z.string().nullish(),
  // Closed network
  closedNetworkMode: z.boolean().default(false),
  closedNetworkVpcIpv4Cidr: z.string().default('10.0.0.0/16'),
  closedNetworkVpcId: z.string().nullish(),
  closedNetworkSubnetIds: z.array(z.string()).nullish(),
  closedNetworkCertificateArn: z.string().nullish(),
  closedNetworkDomainName: z.string().nullish(),
  closedNetworkCreateTestEnvironment: z.boolean().default(true),
  closedNetworkCreateResolverEndpoint: z.boolean().default(true),
});

// Common Validator with refine
export const stackInputSchema = baseStackInputSchema
  .refine(
    (data) => {
      // If searchApiKey is provided, searchEngine must also be provided
      if (data.searchApiKey && !data.searchEngine) {
        return false;
      }
      return true;
    },
    {
      message: 'searchEngine is required when searchApiKey is provided',
      path: ['searchEngine'],
    }
  )
  .refine(
    (data) => {
      // Validate AgentCore VPC configuration consistency
      const hasVpcId = !!data.agentCoreVpcId;
      const hasSubnetIds = !!(
        data.agentCoreSubnetIds && data.agentCoreSubnetIds.length > 0
      );

      // Both must be provided or both must be empty
      return hasVpcId === hasSubnetIds;
    },
    {
      message:
        'Both VPC ID and Subnet IDs must be provided together for AgentCore network configuration',
      path: ['agentCoreVpcId'],
    }
  )
  .refine(
    (data) => {
      // In closed network mode, AgentCore must run in the same region as the closed VPC
      const agentCoreEnabled =
        data.agentBuilderEnabled ||
        data.createGenericAgentCoreRuntime ||
        data.researchAgentEnabled;
      if (
        data.closedNetworkMode &&
        agentCoreEnabled &&
        data.agentCoreRegion &&
        data.agentCoreRegion !== data.region
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        'agentCoreRegion must equal region when closedNetworkMode=true (the AgentCore Runtime shares the closed VPC, which exists in a single region)',
      path: ['agentCoreRegion'],
    }
  );

// schema after conversion
export const processedStackInputSchema = baseStackInputSchema.extend({
  modelIds: z.array(
    z.object({
      modelId: z.string(),
      region: z.string(),
    })
  ),
  imageGenerationModelIds: z.array(
    z.object({
      modelId: z.string(),
      region: z.string(),
    })
  ),
  videoGenerationModelIds: z.array(
    z.object({
      modelId: z.string(),
      region: z.string(),
    })
  ),
  speechToSpeechModelIds: z.array(
    z.object({
      modelId: z.string(),
      region: z.string(),
    })
  ),
  endpointNames: z.array(
    z.object({
      modelId: z.string(),
      region: z.string(),
    })
  ),
  // Processed agentCoreRegion (null -> modelRegion)
  agentCoreRegion: z.string(),
  // Computed from VPC configuration (computed in parameter.ts)
  isAgentCoreNetworkPrivate: z.boolean().optional(),
  // Branding configuration
  brandingConfig: z
    .object({
      logoPath: z.string().optional(),
      title: z.string().optional(),
    })
    .optional(),
});

export type StackInput = z.infer<typeof stackInputSchema>;
// Input type: fields with .default() are optional — use this for partial
// parameter objects in parameter.ts so defaults don't need to be repeated.
export type StackInputIn = z.input<typeof stackInputSchema>;
export type ProcessedStackInput = z.infer<typeof processedStackInputSchema>;
