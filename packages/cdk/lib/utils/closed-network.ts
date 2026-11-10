import { StackInput } from '../stack-input';

type ClosedNetworkParams = Pick<
  StackInput,
  | 'region'
  | 'hiddenUseCases'
  | 'imageGenerationModelIds'
  | 'videoGenerationModelIds'
  | 'speechToSpeechModelIds'
  | 'ragEnabled'
  | 'agentEnabled'
  | 'searchAgentEnabled'
  | 'searchApiKey'
  | 'agents'
  | 'inlineAgents'
  | 'agentBuilderEnabled'
  | 'createGenericAgentCoreRuntime'
  | 'researchAgentEnabled'
  | 'agentCoreExternalRuntimes'
  | 'mcpEnabled'
  | 'samlAuthEnabled'
  | 'allowedIpV4AddressRanges'
  | 'allowedIpV6AddressRanges'
  | 'allowedCountryCodes'
  | 'hostName'
  | 'domainName'
  | 'closedNetworkCreateTestEnvironment'
  | 'closedNetworkCreateResolverEndpoint'
>;

type ModelIdOrConfig = string | { modelId: string; region: string };

// Interface VPC Endpoints that every closed network deployment needs:
// the browser path (API Gateway, Lambda streaming, Cognito, S3 presigned URLs),
// model calls (Bedrock Runtime / Agent Runtime, which also serves Optimize Prompt)
// and the platform (ECR / CloudWatch Logs for Lambda and Fargate, STS).
export const ALWAYS_REQUIRED_VPC_ENDPOINTS = [
  'ApiGateway',
  'Lambda',
  'CognitoIdp',
  'CognitoIdentity',
  'S3',
  'Bedrock',
  'BedrockAgent',
  'Ecr',
  'EcrDocker',
  'CloudWatchLogs',
  'Sts',
] as const;

export const OPTIONAL_VPC_ENDPOINTS = [
  'Transcribe',
  'TranscribeStreaming',
  'Polly',
  'AgentCore',
  'AgentCoreGateway',
  'SecretsManager',
  'BedrockAgentApi',
  'Kendra',
] as const;

export type ClosedNetworkVpcEndpointName =
  | (typeof ALWAYS_REQUIRED_VPC_ENDPOINTS)[number]
  | (typeof OPTIONAL_VPC_ENDPOINTS)[number];

const isVisible = (
  params: ClosedNetworkParams,
  useCase: keyof NonNullable<StackInput['hiddenUseCases']>
): boolean => !params.hiddenUseCases?.[useCase];

export const isAgentCoreUsed = (params: ClosedNetworkParams): boolean =>
  params.agentBuilderEnabled ||
  params.createGenericAgentCoreRuntime ||
  params.researchAgentEnabled ||
  (params.agentCoreExternalRuntimes?.length ?? 0) > 0;

/**
 * Interface VPC Endpoints the closed VPC needs for the features that are enabled.
 * Endpoints for disabled features are not created, since each one is billed per AZ.
 */
export const requiredClosedNetworkVpcEndpoints = (
  params: ClosedNetworkParams
): ClosedNetworkVpcEndpointName[] => {
  const optional: Record<(typeof OPTIONAL_VPC_ENDPOINTS)[number], boolean> = {
    // Batch transcription (Transcribe page, Meeting Minutes from a file)
    Transcribe:
      isVisible(params, 'transcribe') || isVisible(params, 'meetingMinutes'),
    // Microphone input (Transcribe, Meeting Minutes, Translate)
    TranscribeStreaming:
      isVisible(params, 'transcribe') ||
      isVisible(params, 'meetingMinutes') ||
      isVisible(params, 'translate'),
    // Read aloud (Translate)
    Polly: isVisible(params, 'translate'),
    AgentCore: isAgentCoreUsed(params),
    AgentCoreGateway: isAgentCoreUsed(params),
    // AgentCore Gateway reads API key secrets
    SecretsManager: isAgentCoreUsed(params),
    // GetAgentAlias / ListAgentActionGroups for Bedrock Agents
    BedrockAgentApi:
      params.agentEnabled ||
      params.searchAgentEnabled ||
      (params.agents?.length ?? 0) > 0,
    Kendra: params.ragEnabled,
  };
  return [
    ...ALWAYS_REQUIRED_VPC_ENDPOINTS,
    ...OPTIONAL_VPC_ENDPOINTS.filter((name) => optional[name]),
  ];
};

const regionOf = (model: ModelIdOrConfig, defaultRegion: string) =>
  typeof model === 'string' ? defaultRegion : model.region;

const modelIdOf = (model: ModelIdOrConfig) =>
  typeof model === 'string' ? model : model.modelId;

export type ClosedNetworkWarning = { id: string; message: string };

/**
 * Settings that are enabled but do not work, or are ignored, in closed network mode.
 * They are reported as CDK warnings at synth time so they show up before deployment.
 */
export const closedNetworkWarnings = (
  params: ClosedNetworkParams,
  modelRegion: string
): ClosedNetworkWarning[] => {
  const warnings: ClosedNetworkWarning[] = [];
  const add = (id: string, message: string) =>
    warnings.push({ id: `genu:closedNetwork:${id}`, message });

  const crossRegion = (models: ModelIdOrConfig[] | undefined) =>
    (models ?? [])
      .filter((m) => regionOf(m, modelRegion) !== params.region)
      .map(modelIdOf);

  const image = crossRegion(params.imageGenerationModelIds);
  if (isVisible(params, 'image') && image.length > 0) {
    add(
      'imageModelRegion',
      `Image generation models outside ${params.region} cannot be reached from the closed VPC and are not shown in the UI: ${image.join(', ')}`
    );
  }
  const video = crossRegion(params.videoGenerationModelIds);
  if (isVisible(params, 'video') && video.length > 0) {
    add(
      'videoModelRegion',
      `Video generation models outside ${params.region} cannot be reached from the closed VPC and are not shown in the UI: ${video.join(', ')}`
    );
  }
  if (
    isVisible(params, 'voiceChat') &&
    (params.speechToSpeechModelIds?.length ?? 0) > 0
  ) {
    add(
      'voiceChat',
      'Voice Chat is not available in closed network mode and is hidden in the UI. Set hiddenUseCases.voiceChat to true to silence this warning.'
    );
  }
  if (isVisible(params, 'webContent')) {
    add(
      'webContent',
      'Web Content Extraction needs internet access and is hidden in the UI. Set hiddenUseCases.webContent to true to silence this warning.'
    );
  }
  if (params.samlAuthEnabled) {
    add('saml', 'SAML authentication is not available in closed network mode.');
  }
  if (params.searchAgentEnabled || params.searchApiKey) {
    add(
      'searchAgent',
      'The search agent calls an external search API and needs internet access, which the closed VPC does not have.'
    );
  }
  if (params.agentBuilderEnabled || params.createGenericAgentCoreRuntime) {
    add(
      'agentCoreInternetTools',
      'AgentCore Runtime runs inside the closed VPC. Tools that need the internet (web search, URL fetch, MCP servers that call external APIs or install packages from npm/PyPI at run time) do not work. MCP servers on your own network and AWS services with VPC endpoints do.'
    );
  }
  if (params.researchAgentEnabled) {
    add(
      'researchAgent',
      'The research agent runtime uses the PUBLIC network mode and searches the internet, so it does not keep traffic inside the closed network.'
    );
  }
  if (params.mcpEnabled) {
    add(
      'mcp',
      'MCP chat servers that call external APIs or download packages at run time do not work without internet access.'
    );
  }
  if (
    params.allowedIpV4AddressRanges ||
    params.allowedIpV6AddressRanges ||
    params.allowedCountryCodes
  ) {
    add(
      'waf',
      'allowedIpV4AddressRanges / allowedIpV6AddressRanges / allowedCountryCodes are ignored in closed network mode (no CloudFront WAF is created). Restrict access with the security groups or your network instead.'
    );
  }
  if (params.hostName || params.domainName) {
    add(
      'customDomain',
      'hostName / domainName are ignored in closed network mode. Use closedNetworkDomainName and closedNetworkCertificateArn instead.'
    );
  }
  if (params.closedNetworkCreateTestEnvironment) {
    add(
      'testEnvironment',
      'A Windows EC2 instance and 3 VPC endpoints are created for testing (closedNetworkCreateTestEnvironment). They are billed while they exist; set it to false when clients reach GenU from your own network.'
    );
  }
  return warnings;
};

type WebModelConfig = { modelId: string; region: string };

/**
 * What the web app is told about use cases and media models. In closed network mode,
 * use cases that cannot work are hidden, and image/video models outside the app region
 * (unreachable from the closed VPC) are dropped; the use case is hidden when none remain.
 */
export const closedNetworkWebConfig = ({
  closedNetworkMode,
  region,
  hiddenUseCases,
  imageGenerationModelIds,
  videoGenerationModelIds,
}: {
  closedNetworkMode: boolean;
  region: string;
  hiddenUseCases: NonNullable<StackInput['hiddenUseCases']>;
  imageGenerationModelIds: WebModelConfig[];
  videoGenerationModelIds: WebModelConfig[];
}) => {
  if (!closedNetworkMode) {
    return { hiddenUseCases, imageGenerationModelIds, videoGenerationModelIds };
  }
  const image = imageGenerationModelIds.filter((m) => m.region === region);
  const video = videoGenerationModelIds.filter((m) => m.region === region);
  return {
    hiddenUseCases: {
      ...hiddenUseCases,
      voiceChat: true,
      webContent: true,
      ...(image.length === 0 ? { image: true } : {}),
      ...(video.length === 0 ? { video: true } : {}),
    },
    imageGenerationModelIds: image,
    videoGenerationModelIds: video,
  };
};
