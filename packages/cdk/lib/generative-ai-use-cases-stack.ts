import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Auth,
  Api,
  Web,
  Database,
  Rag,
  Transcribe,
  CommonWebAcl,
  SpeechToSpeech,
  McpApi,
  AgentCore,
  UseCaseBuilder,
} from './construct';
import { loadMCPConfig, extractSafeMCPConfig } from './utils/mcp-config-loader';
import { CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { ProcessedStackInput } from './stack-input';
import {
  InterfaceVpcEndpoint,
  IVpc,
  ISecurityGroup,
  SecurityGroup,
} from 'aws-cdk-lib/aws-ec2';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { AgentCoreStack } from './agent-core-stack';
import { ResearchAgentCoreStack } from './research-agent-core-stack';
import { ClosedNetworkStack } from './closed-network-stack';
import * as path from 'path';
import { RemoteOutputs } from 'cdk-remote-stack';
import { REMOTE_OUTPUT_KEYS } from './remote-output-keys';

export interface GenerativeAiUseCasesStackProps extends StackProps {
  readonly params: ProcessedStackInput;
  // RAG Knowledge Base
  readonly knowledgeBaseId?: string;
  readonly knowledgeBaseDataSourceBucketName?: string;
  // Agent
  readonly agentStack?: Stack;
  // Agent Core
  readonly createGenericAgentCoreRuntime?: boolean;
  readonly agentBuilderEnabled?: boolean;
  readonly agentCoreStack?: AgentCoreStack;
  // Research Agent Core
  readonly researchAgentEnabled?: boolean;
  readonly researchAgentCoreStack?: ResearchAgentCoreStack;
  // Video Generation
  readonly videoBucketRegionMap: Record<string, string>;
  // Guardrail
  readonly guardrailIdentifier?: string;
  readonly guardrailVersion?: string;
  // WAF
  readonly webAclId?: string;
  // Custom Domain
  readonly cert?: ICertificate;
  // Image build environment
  readonly isSageMakerStudio: boolean;
  // Closed network
  readonly vpc?: IVpc;
  readonly apiGatewayVpcEndpoint?: InterfaceVpcEndpoint;
  readonly webBucket?: Bucket;
  // ALB origin / web URL are read from this stack via cdk-remote-stack
  // RemoteOutputs (no Fn::ImportValue, so no export-in-use deadlock when the
  // custom domain is toggled).
  readonly closedNetworkStack?: ClosedNetworkStack;
}

export class GenerativeAiUseCasesStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(
    scope: Construct,
    id: string,
    props: GenerativeAiUseCasesStackProps
  ) {
    super(scope, id, props);
    process.env.overrideWarningsEnabled = 'false';

    const params = props.params;

    // Get values from other stacks using RemoteOutputs
    let agentsJson: string | undefined;

    // Agent RemoteOutputs
    if (params.agentEnabled && props.agentStack) {
      const agentRemoteOutputs = new RemoteOutputs(this, 'AgentRemoteOutputs', {
        stack: props.agentStack,
        alwaysUpdate: true,
        timeout: Duration.seconds(600),
      });
      agentsJson = agentRemoteOutputs.get(REMOTE_OUTPUT_KEYS.AGENTS);
    }

    let genericRuntimeArn: string | undefined;
    let genericRuntimeName: string | undefined;
    let agentBuilderRuntimeArn: string | undefined;
    let agentBuilderRuntimeName: string | undefined;
    let researchRuntimeArn: string | undefined;
    let researchRuntimeName: string | undefined;

    // Get runtime info from remote AgentCore stack using cdk-remote-stack
    if (params.createGenericAgentCoreRuntime || params.agentBuilderEnabled) {
      const remoteOutputs = new RemoteOutputs(this, 'AgentCoreRemoteOutputs', {
        stack: props.agentCoreStack!,
        timeout: Duration.seconds(600),
      });

      if (params.createGenericAgentCoreRuntime) {
        genericRuntimeArn = remoteOutputs.get('GenericAgentCoreRuntimeArn');
        genericRuntimeName = remoteOutputs.get('GenericAgentCoreRuntimeName');
      }

      if (params.agentBuilderEnabled) {
        agentBuilderRuntimeArn = remoteOutputs.get(
          'AgentBuilderAgentCoreRuntimeArn'
        );
        agentBuilderRuntimeName = remoteOutputs.get(
          'AgentBuilderAgentCoreRuntimeName'
        );
      }
    }

    // Get runtime info from remote Research AgentCore stack
    if (params.researchAgentEnabled) {
      const researchRemoteOutputs = new RemoteOutputs(
        this,
        'ResearchAgentCoreRemoteOutputs',
        {
          stack: props.researchAgentCoreStack!,
          timeout: Duration.seconds(600),
        }
      );

      researchRuntimeArn = researchRemoteOutputs.get(
        REMOTE_OUTPUT_KEYS.RESEARCH_AGENT_CORE_RUNTIME_ARN
      );
      researchRuntimeName = researchRemoteOutputs.get(
        REMOTE_OUTPUT_KEYS.RESEARCH_AGENT_CORE_RUNTIME_NAME
      );
    }

    // Common security group for saving ENI in Closed network mode
    let securityGroups: ISecurityGroup[] | undefined = undefined;
    if (props.vpc) {
      securityGroups = [
        new SecurityGroup(this, 'LambdaSeurityGroup', {
          vpc: props.vpc,
          description: 'GenU Lambda Security Group',
          allowAllOutbound: true,
        }),
      ];
    }

    // Auth
    const auth = new Auth(this, 'Auth', {
      selfSignUpEnabled: params.selfSignUpEnabled,
      allowedIpV4AddressRanges: params.allowedIpV4AddressRanges,
      allowedIpV6AddressRanges: params.allowedIpV6AddressRanges,
      allowedSignUpEmailDomains: params.allowedSignUpEmailDomains,
      samlAuthEnabled: params.samlAuthEnabled,
    });

    // Database
    const database = new Database(this, 'Database');

    let useCaseBuilder: UseCaseBuilder | undefined;
    if (params.useCaseBuilderEnabled || params.agentBuilderEnabled) {
      useCaseBuilder = new UseCaseBuilder(this, 'UseCaseBuilder');
    }

    // RAG (if enabled)
    let rag: Rag | undefined;
    if (params.ragEnabled) {
      rag = new Rag(this, 'Rag', {
        envSuffix: params.env,
        kendraIndexLanguage: params.kendraIndexLanguage,
        kendraIndexArnInCdkContext: params.kendraIndexArn,
        kendraDataSourceBucketName: params.kendraDataSourceBucketName,
        kendraIndexScheduleEnabled: params.kendraIndexScheduleEnabled,
        kendraIndexScheduleCreateCron: params.kendraIndexScheduleCreateCron,
        kendraIndexScheduleDeleteCron: params.kendraIndexScheduleDeleteCron,
        userPoolProviderUrl: auth.userPool.userPoolProviderUrl,
        vpc: props.vpc,
        securityGroups,
      });
    }

    // Transcribe
    const transcribe = new Transcribe(this, 'Transcribe', {
      userPool: auth.userPool,
      idPool: auth.idPool,
      allowedIpV4AddressRanges: params.allowedIpV4AddressRanges,
      allowedIpV6AddressRanges: params.allowedIpV6AddressRanges,
      vpc: props.vpc,
      securityGroups,
    });

    // SpeechToSpeech (for bidirectional communication)
    const speechToSpeech = new SpeechToSpeech(this, 'SpeechToSpeech', {
      envSuffix: params.env,
      userPool: auth.userPool,
      speechToSpeechModelIds: params.speechToSpeechModelIds,
      crossAccountBedrockRoleArn: params.crossAccountBedrockRoleArn,
      vpc: props.vpc,
      securityGroups,
    });

    // API
    const api = new Api(this, 'API', {
      modelRegion: params.modelRegion,
      modelIds: params.modelIds,
      imageGenerationModelIds: params.imageGenerationModelIds,
      videoGenerationModelIds: params.videoGenerationModelIds,
      videoBucketRegionMap: props.videoBucketRegionMap,
      endpointNames: params.endpointNames,
      customAgents: params.agents,
      queryDecompositionEnabled: params.queryDecompositionEnabled,
      rerankingModelId: params.rerankingModelId,
      crossAccountBedrockRoleArn: params.crossAccountBedrockRoleArn,
      userPool: auth.userPool,
      idPool: auth.idPool,
      userPoolClient: auth.client,
      table: database.table,
      statsTable: database.statsTable,
      knowledgeBaseId: params.ragKnowledgeBaseId || props.knowledgeBaseId,
      agents: agentsJson,
      guardrailIdentify: props.guardrailIdentifier,
      guardrailVersion: props.guardrailVersion,
      vpc: props.vpc,
      securityGroups,
      apiGatewayVpcEndpoint: props.apiGatewayVpcEndpoint,
      // RAG Kendra
      kendraIndexId: rag?.kendraIndexId,
      kendraIndexLanguage: rag?.kendraIndexLanguage,
      // Use Case Builder / Agent Builder
      useCaseBuilderTable: useCaseBuilder?.useCaseBuilderTable,
      useCaseIdIndexName: useCaseBuilder?.useCaseIdIndexName,
      agentBuilderRuntimeArn,
      // Transcribe
      audioBucket: transcribe.audioBucket,
      transcriptBucket: transcribe.transcriptBucket,
      // Speech to Speech
      speechToSpeechTaskFunctionArn:
        speechToSpeech.speechToSpeechTaskFunctionArn,
      speechToSpeechModelIds: params.speechToSpeechModelIds,
      // IP restrictions
      allowedIpV4AddressRanges: params.allowedIpV4AddressRanges ?? undefined,
      allowedIpV6AddressRanges: params.allowedIpV6AddressRanges ?? undefined,
      // Additional S3 buckets (AgentCore FileBucket)
      additionalS3Buckets: [
        ...(props.agentCoreStack?.fileBucket
          ? [props.agentCoreStack.fileBucket]
          : []),
        ...(props.researchAgentCoreStack?.fileBucket
          ? [props.researchAgentCoreStack.fileBucket]
          : []),
      ].filter(Boolean),
      // Knowledge Base data source bucket
      knowledgeBaseDataSourceBucketName:
        props.knowledgeBaseDataSourceBucketName,
      dataSourceBucketName: rag?.dataSourceBucketName,
    });

    // WAF
    if (
      params.allowedIpV4AddressRanges ||
      params.allowedIpV6AddressRanges ||
      params.allowedCountryCodes
    ) {
      const regionalWaf = new CommonWebAcl(this, 'RegionalWaf', {
        scope: 'REGIONAL',
        allowedIpV4AddressRanges: params.allowedIpV4AddressRanges,
        allowedIpV6AddressRanges: params.allowedIpV6AddressRanges,
        allowedCountryCodes: params.allowedCountryCodes,
      });
      new CfnWebACLAssociation(this, 'ApiWafAssociation', {
        resourceArn: api.api.deploymentStage.stageArn,
        webAclArn: regionalWaf.webAclArn,
      });
      new CfnWebACLAssociation(this, 'UserPoolWafAssociation', {
        resourceArn: auth.userPool.userPoolArn,
        webAclArn: regionalWaf.webAclArn,
      });
    }

    // Load MCP configuration for Web frontend
    const mcpServers = loadMCPConfig(
      path.join(
        __dirname,
        '../lambda-python/generic-agent-core-runtime/mcp-configs/agent-builder/mcp.json'
      )
    );
    const safeMCPConfig = extractSafeMCPConfig(mcpServers);

    // MCP
    let mcpEndpoint: string | null = null;
    if (params.mcpEnabled) {
      const mcpApi = new McpApi(this, 'McpApi', {
        idPool: auth.idPool,
        isSageMakerStudio: props.isSageMakerStudio,
        fileBucket: api.fileBucket,
        vpc: props.vpc,
        securityGroups,
      });
      mcpEndpoint = mcpApi.endpoint;
    }

    // Create AgentCore construct for external runtimes and permissions
    if (
      params.agentCoreExternalRuntimes.length > 0 ||
      genericRuntimeArn ||
      agentBuilderRuntimeArn ||
      researchRuntimeArn
    ) {
      new AgentCore(this, 'AgentCore', {
        agentCoreExternalRuntimes: params.agentCoreExternalRuntimes,
        idPool: auth.idPool,
        genericRuntimeArn,
        agentBuilderRuntimeArn,
        researchRuntimeArn,
      });
    }

    // Web Frontend
    const web = new Web(this, 'Api', {
      // Auth
      userPoolId: auth.userPool.userPoolId,
      userPoolClientId: auth.client.userPoolClientId,
      idPoolId: auth.idPool.identityPoolId,
      selfSignUpEnabled: params.selfSignUpEnabled,
      samlAuthEnabled: params.samlAuthEnabled,
      samlCognitoDomainName: params.samlCognitoDomainName,
      samlCognitoFederatedIdentityProviderName:
        params.samlCognitoFederatedIdentityProviderName,
      // Backend
      apiEndpointUrl: api.api.url,
      predictStreamFunctionArn: api.predictStreamFunction.functionArn,
      ragEnabled: params.ragEnabled,
      ragKnowledgeBaseEnabled: params.ragKnowledgeBaseEnabled,
      ragKnowledgeBaseStorageType: params.ragKnowledgeBaseStorageType,
      agentEnabled: params.agentEnabled || params.agents.length > 0,
      flows: params.flows,
      flowStreamFunctionArn: api.invokeFlowFunction.functionArn,
      optimizePromptFunctionArn: api.optimizePromptFunction.functionArn,
      webAclId: props.webAclId,
      modelRegion: api.modelRegion,
      modelIds: api.modelIds,
      imageGenerationModelIds: api.imageGenerationModelIds,
      videoGenerationModelIds: api.videoGenerationModelIds,
      endpointNames: api.endpointNames,
      builtinAgentsJson: agentsJson || '[]',
      customAgentsJson: JSON.stringify(params.agents),
      inlineAgents: params.inlineAgents,
      useCaseBuilderEnabled: params.useCaseBuilderEnabled,
      speechToSpeechNamespace: speechToSpeech.namespace,
      speechToSpeechEventApiEndpoint: speechToSpeech.eventApiEndpoint,
      speechToSpeechModelIds: params.speechToSpeechModelIds,
      mcpEnabled: params.mcpEnabled,
      mcpEndpoint,
      mcpServersConfig: safeMCPConfig,
      agentCoreEnabled:
        params.createGenericAgentCoreRuntime ||
        params.agentCoreExternalRuntimes.length > 0,
      agentCoreGenericRuntime: genericRuntimeArn
        ? {
            name: genericRuntimeName || 'GenericAgentCoreRuntime',
            arn: genericRuntimeArn,
            description: 'Generic Agent Core Runtime for custom agents',
          }
        : undefined,
      agentBuilderEnabled: params.agentBuilderEnabled,
      agentBuilderWebSearchEnabled: params.agentBuilderWebSearchEnabled,
      agentCoreAgentBuilderRuntime: agentBuilderRuntimeArn
        ? {
            name: agentBuilderRuntimeName || 'AgentBuilderAgentCoreRuntime',
            arn: agentBuilderRuntimeArn,
            description: 'Agent Core Runtime for AgentBuilder',
          }
        : undefined,
      agentCoreExternalRuntimes: params.agentCoreExternalRuntimes,
      agentCoreRegion: params.agentCoreRegion,
      researchAgentEnabled: params.researchAgentEnabled,
      researchAgentRuntime: researchRuntimeArn
        ? {
            name: researchRuntimeName || 'ResearchAgentCoreRuntime',
            arn: researchRuntimeArn,
            description: 'Research Agent Core Runtime with Claude Agent SDK',
          }
        : undefined,
      // Frontend
      hiddenUseCases: params.hiddenUseCases,
      // Custom Domain
      cert: props.cert,
      hostName: params.hostName,
      domainName: params.domainName,
      hostedZoneId: params.hostedZoneId,
      // Closed network
      webBucket: props.webBucket,
      // Branding
      brandingConfig: params.brandingConfig,
    });

    // Update API handler with web URL for CORS.
    // In closed network mode, web.webUrl is a placeholder ('CLOSED_NETWORK_MODE')
    // because the real URL is owned by ClosedNetworkStack. Read it via
    // RemoteOutputs (soft cross-stack ref, no Fn::ImportValue) and allow both
    // the ALB DNS origin and the custom domain so an ALB-DNS test env can move
    // to a domain with a single deploy and no CORS gap during the transition.
    let allowedOrigins: string[] = [web.webUrl];
    let displayWebUrl = web.webUrl;
    if (props.closedNetworkStack) {
      const closedNetworkOutputs = new RemoteOutputs(
        this,
        'ClosedNetworkRemoteOutputs',
        {
          stack: props.closedNetworkStack,
          alwaysUpdate: true,
          timeout: Duration.seconds(600),
        }
      );
      const albOrigin = closedNetworkOutputs.get(
        REMOTE_OUTPUT_KEYS.CLOSED_NETWORK_ALB_ORIGIN
      );
      const closedWebUrl = closedNetworkOutputs.get(
        REMOTE_OUTPUT_KEYS.CLOSED_NETWORK_WEB_URL
      );
      allowedOrigins = [albOrigin, closedWebUrl];
      displayWebUrl = closedWebUrl;
    }
    api.apiHandler.addEnvironment('ALLOWED_ORIGINS', allowedOrigins.join(','));

    // Cfn Outputs
    new CfnOutput(this, 'Region', {
      value: this.region,
    });

    new CfnOutput(this, 'WebUrl', {
      value: displayWebUrl,
    });

    new CfnOutput(this, 'ApiEndpoint', {
      value: api.api.url,
    });

    new CfnOutput(this, 'UserPoolId', { value: auth.userPool.userPoolId });

    new CfnOutput(this, 'UserPoolClientId', {
      value: auth.client.userPoolClientId,
    });

    new CfnOutput(this, 'IdPoolId', { value: auth.idPool.identityPoolId });

    new CfnOutput(this, 'PredictStreamFunctionArn', {
      value: api.predictStreamFunction.functionArn,
    });

    new CfnOutput(this, 'OptimizePromptFunctionArn', {
      value: api.optimizePromptFunction.functionArn,
    });

    new CfnOutput(this, 'InvokeFlowFunctionArn', {
      value: api.invokeFlowFunction.functionArn,
    });

    new CfnOutput(this, 'Flows', {
      value: Buffer.from(JSON.stringify(params.flows)).toString('base64'),
    });

    new CfnOutput(this, 'RagEnabled', {
      value: params.ragEnabled.toString(),
    });

    new CfnOutput(this, 'RagKnowledgeBaseEnabled', {
      value: params.ragKnowledgeBaseEnabled.toString(),
    });

    new CfnOutput(this, 'RagKnowledgeBaseStorageType', {
      value: params.ragKnowledgeBaseStorageType,
    });

    new CfnOutput(this, 'AgentEnabled', {
      value: (params.agentEnabled || params.agents.length > 0).toString(),
    });

    new CfnOutput(this, 'SelfSignUpEnabled', {
      value: params.selfSignUpEnabled.toString(),
    });

    new CfnOutput(this, 'ModelRegion', {
      value: api.modelRegion,
    });

    new CfnOutput(this, 'ModelIds', {
      value: JSON.stringify(api.modelIds),
    });

    new CfnOutput(this, 'ImageGenerateModelIds', {
      value: JSON.stringify(api.imageGenerationModelIds),
    });

    new CfnOutput(this, 'VideoGenerateModelIds', {
      value: JSON.stringify(api.videoGenerationModelIds),
    });

    new CfnOutput(this, 'EndpointNames', {
      value: JSON.stringify(api.endpointNames),
    });

    new CfnOutput(this, 'SamlAuthEnabled', {
      value: params.samlAuthEnabled.toString(),
    });

    new CfnOutput(this, 'SamlCognitoDomainName', {
      value: params.samlCognitoDomainName ?? '',
    });

    new CfnOutput(this, 'SamlCognitoFederatedIdentityProviderName', {
      value: params.samlCognitoFederatedIdentityProviderName ?? '',
    });

    new CfnOutput(this, 'Agents', {
      value: Buffer.from(JSON.stringify(api.agents)).toString('base64'),
    });

    new CfnOutput(this, 'InlineAgents', {
      value: params.inlineAgents.toString(),
    });

    new CfnOutput(this, 'UseCaseBuilderEnabled', {
      value: params.useCaseBuilderEnabled.toString(),
    });

    new CfnOutput(this, 'HiddenUseCases', {
      value: JSON.stringify(params.hiddenUseCases),
    });

    new CfnOutput(this, 'SpeechToSpeechNamespace', {
      value: speechToSpeech.namespace,
    });

    new CfnOutput(this, 'SpeechToSpeechEventApiEndpoint', {
      value: speechToSpeech.eventApiEndpoint,
    });

    new CfnOutput(this, 'SpeechToSpeechModelIds', {
      value: JSON.stringify(params.speechToSpeechModelIds),
    });

    new CfnOutput(this, 'McpEnabled', {
      value: params.mcpEnabled.toString(),
    });

    new CfnOutput(this, 'McpEndpoint', {
      value: mcpEndpoint ?? '',
    });

    new CfnOutput(this, 'AgentCoreEnabled', {
      value: (
        params.createGenericAgentCoreRuntime ||
        params.agentCoreExternalRuntimes.length > 0
      ).toString(),
    });

    new CfnOutput(this, 'AgentCoreGenericRuntime', {
      value: genericRuntimeArn
        ? JSON.stringify({
            name: genericRuntimeName || 'GenericAgentCoreRuntime',
            arn: genericRuntimeArn,
          })
        : 'null',
    });

    new CfnOutput(this, 'AgentCoreAgentBuilderEnabled', {
      value: params.agentBuilderEnabled.toString(),
    });

    new CfnOutput(this, 'AgentCoreAgentBuilderRuntime', {
      value: agentBuilderRuntimeArn
        ? JSON.stringify({
            name: agentBuilderRuntimeName || 'AgentBuilderAgentCoreRuntime',
            arn: agentBuilderRuntimeArn,
          })
        : 'null',
    });

    new CfnOutput(this, 'AgentCoreExternalRuntimes', {
      value: JSON.stringify(params.agentCoreExternalRuntimes),
    });

    new CfnOutput(this, 'McpServersConfig', {
      value: safeMCPConfig,
    });

    // Additional outputs for backend development
    new CfnOutput(this, 'TableName', {
      value: database.table.tableName,
    });

    new CfnOutput(this, 'StatsTableName', {
      value: database.statsTable.tableName,
    });

    new CfnOutput(this, 'BucketName', {
      value: api.fileBucket.bucketName,
    });

    new CfnOutput(this, 'QueryDecompositionEnabled', {
      value: params.queryDecompositionEnabled.toString(),
    });

    new CfnOutput(this, 'RerankingModelId', {
      value: params.rerankingModelId ?? '',
    });

    if (useCaseBuilder?.useCaseBuilderTable) {
      new CfnOutput(this, 'UseCaseTableName', {
        value: useCaseBuilder.useCaseBuilderTable.tableName,
      });

      new CfnOutput(this, 'UseCaseIdIndexName', {
        value: useCaseBuilder.useCaseIdIndexName,
      });
    }

    if (transcribe?.audioBucket) {
      new CfnOutput(this, 'AudioBucketName', {
        value: transcribe.audioBucket.bucketName,
      });
    }

    if (transcribe?.transcriptBucket) {
      new CfnOutput(this, 'TranscriptBucketName', {
        value: transcribe.transcriptBucket.bucketName,
      });
    }

    if (params.ragEnabled && rag?.kendraIndexId) {
      new CfnOutput(this, 'IndexId', {
        value: rag.kendraIndexId,
      });
    }

    this.userPool = auth.userPool;
    this.userPoolClient = auth.client;

    this.exportValue(this.userPool.userPoolId);
    this.exportValue(this.userPoolClient.userPoolClientId);
  }
}
