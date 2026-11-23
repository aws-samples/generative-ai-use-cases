import { Construct } from 'constructs';
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Stack, RemovalPolicy, Tags } from 'aws-cdk-lib';
import {
  Bucket,
  BlockPublicAccess,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import { Subnet, Vpc, SecurityGroup, IVpc, ISubnet } from 'aws-cdk-lib/aws-ec2';
import { CfnRuntime } from 'aws-cdk-lib/aws-bedrockagentcore';
import {
  Runtime,
  RuntimeNetworkConfiguration,
  RuntimeAuthorizerConfiguration,
  ProtocolType,
  AgentRuntimeArtifact,
} from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { BucketInfo } from 'generative-ai-use-cases';
import * as path from 'path';
import {
  SUPPORTED_CACHE_FIELDS,
  modelMetadata,
} from '@generative-ai-use-cases/common';

export interface AgentCoreRuntimeConfig {
  name: string;
  instructions?: string;
  memorySize?: number;
  customRuntimeConfig?: Record<string, unknown>;
  dockerPath?: string; // Docker file path of AgentCore Runtime
  networkMode?: string; // PUBLIC
  serverProtocol?: string; // HTTP, MCP
  environmentVariables?: Record<string, string>;
}

export interface GenericAgentCoreProps {
  env: string;
  createGenericRuntime?: boolean;
  createAgentBuilderRuntime?: boolean;
  isAgentCoreNetworkPrivate?: boolean;
  agentCoreVpcId?: string | null;
  agentCoreSubnetIds?: string[] | null;
  // Pre-resolved VPC / subnets (e.g. injected from ClosedNetworkStack via cross-stack reference).
  // When provided, these are used directly instead of Vpc.fromLookup(agentCoreVpcId).
  vpc?: IVpc;
  subnets?: ISubnet[];
  gatewayArns?: string[];
  // Closed network mode: the generic runtime starts no default MCP servers,
  // since they are downloaded from npm/PyPI or call internet endpoints
  closedNetworkMode?: boolean;
  // The text generation models of this deployment, for their output token limits
  modelIds?: string[];
  // Let the agent builder runtime use AgentCore Web Search (InvokeWebSearch)
  webSearchEnabled?: boolean;
  // Domains excluded from every web search, enforced by the runtime's tool
  webSearchExcludeDomains?: string[];
  // Given both, a runtime authenticates its callers against this pool rather
  // than trusting the identity they claim in the payload. Named rather than
  // passed as a construct: the pool lives in the stack that depends on this
  // one, so there is no object to hand over.
  userPoolId?: string;
  userPoolClientId?: string;
}

interface RuntimeResources {
  genericRuntime?: Runtime;
  agentBuilderRuntime?: Runtime;
  role: Role;
}

export class GenericAgentCore extends Construct {
  private readonly props: GenericAgentCoreProps;
  private readonly _fileBucket: Bucket;
  private readonly genericRuntimeConfig: AgentCoreRuntimeConfig;
  private readonly agentBuilderRuntimeConfig: AgentCoreRuntimeConfig;
  private readonly resources: RuntimeResources;
  private readonly gatewayArns?: string[];
  private readonly webSearchEnabled: boolean;

  // Security Group ID that requires manual cleanup after AgentCore Runtime deletion
  // Used for CloudFormation Output to remind users of manual cleanup tasks
  public readonly retainedSecurityGroupId?: string;

  constructor(scope: Construct, id: string, props: GenericAgentCoreProps) {
    super(scope, id);
    this.props = props;

    const {
      env,
      createGenericRuntime = false,
      createAgentBuilderRuntime = false,
      isAgentCoreNetworkPrivate = false,
      agentCoreVpcId = null,
      agentCoreSubnetIds = null,
      vpc: providedVpc,
      subnets: providedSubnets,
      gatewayArns,
      closedNetworkMode = false,
      webSearchEnabled = false,
      webSearchExcludeDomains,
    } = props;

    this.gatewayArns = gatewayArns;
    this.webSearchEnabled = webSearchEnabled;

    // Create bucket first
    this._fileBucket = this.createFileBucket();

    // Load configurations
    const configs = this.loadConfigurations(
      env,
      this._fileBucket.bucketName,
      props.modelIds ?? [],
      closedNetworkMode,
      webSearchEnabled,
      webSearchExcludeDomains
    );
    this.genericRuntimeConfig = configs.generic;
    this.agentBuilderRuntimeConfig = configs.agentBuilder;

    // Create security group if VPC mode
    let securityGroup: SecurityGroup | undefined;
    let vpc: IVpc | undefined;
    let subnets: ISubnet[] | undefined;

    // Resolve VPC + subnets: prefer pre-resolved refs (e.g. from ClosedNetworkStack), then fall back to lookup-by-id
    if (isAgentCoreNetworkPrivate) {
      if (providedVpc && providedSubnets && providedSubnets.length > 0) {
        vpc = providedVpc;
        subnets = providedSubnets;
      } else if (agentCoreVpcId && agentCoreSubnetIds) {
        vpc = Vpc.fromLookup(this, 'AgentCoreVpc', { vpcId: agentCoreVpcId });
        subnets = agentCoreSubnetIds.map((subnetId, index) =>
          Subnet.fromSubnetId(this, `AgentCoreSubnet${index}`, subnetId)
        );
      }
    }

    if (vpc && subnets) {
      securityGroup = new SecurityGroup(this, 'AgentCoreSecurityGroup', {
        vpc,
        description: 'Security group for AgentCore Runtime',
        allowAllOutbound: true,
      });

      // Add tags for manual cleanup identification
      Tags.of(securityGroup).add('ManualCleanupRequired', 'true');
      Tags.of(securityGroup).add(
        'CleanupReason',
        'AgentCore-Managed-ENI-Dependency'
      );
      Tags.of(securityGroup).add('CreatedBy', env ? `GenU-${env}` : 'GenU');

      // Retain security group to prevent deletion errors when changing PRIVATE->PUBLIC or removing AgentCore
      // AgentCore Runtime creates managed ENIs that reference this security group
      // CloudFormation cannot delete the SG while managed ENIs are using it (even though they're not manually deletable)
      // The managed ENIs are automatically cleaned up after AgentCore Runtime deletion, but with a time delay
      // Therefore, this SG must be retained and manually deleted after the managed ENIs are cleaned up
      //
      // Note: Custom Resource with ENI monitoring could solve this, but deletion can take up to 1 hour
      // Since security groups incur no cost, RETAIN is the practical solution for better user experience
      securityGroup.applyRemovalPolicy(RemovalPolicy.RETAIN);

      // Store SG ID for output
      this.retainedSecurityGroupId = securityGroup.securityGroupId;
    }

    // Create all resources atomically
    this.resources = this.createResources(
      createGenericRuntime,
      createAgentBuilderRuntime,
      isAgentCoreNetworkPrivate,
      vpc,
      subnets,
      securityGroup
    );
  }

  private createFileBucket(): Bucket {
    return new Bucket(this, 'AgentCoreFileBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }

  /**
   * The output token limit of each text generation model, as the Converse path
   * uses it. Without one the runtime leaves maxTokens unset and Bedrock applies
   * its default of 4,096, so a long answer, or a tool call carrying a large
   * argument, is cut off with MaxTokensReachedException. Only the models of this
   * deployment are passed: an environment variable holds at most 2,048 characters.
   */
  private modelMaxTokensEnvironment(
    modelIds: string[]
  ): Record<string, string> {
    const limits = Object.fromEntries(
      modelIds.flatMap((modelId) => {
        const maxTokens =
          modelMetadata[modelId]?.defaultParams?.inferenceConfig?.maxTokens;
        return maxTokens ? [[modelId, maxTokens]] : [];
      })
    );
    if (Object.keys(limits).length === 0) {
      return {};
    }
    const value = JSON.stringify(limits);
    if (value.length > 2048) {
      throw new Error(
        `MODEL_MAX_TOKENS is ${value.length} characters, over the 2,048 an AgentCore Runtime environment variable allows. Reduce modelIds.`
      );
    }
    return { MODEL_MAX_TOKENS: value };
  }

  private loadConfigurations(
    env: string,
    bucketName: string,
    modelIds: string[],
    closedNetworkMode: boolean,
    webSearchEnabled: boolean,
    webSearchExcludeDomains?: string[]
  ) {
    const modelMaxTokens = this.modelMaxTokensEnvironment(modelIds);
    return {
      generic: {
        name: `GenUGenericRuntime${env}`,
        instructions: 'You are a helpful assistant powered by AWS Bedrock.',
        memorySize: 2048,
        dockerPath: 'lambda-python/generic-agent-core-runtime',
        networkMode: 'PUBLIC',
        serverProtocol: 'HTTP',
        environmentVariables: {
          FILE_BUCKET: bucketName,
          MCP_CONFIG_PATH: closedNetworkMode
            ? '/var/task/mcp-configs/closed-network/mcp.json'
            : '/var/task/mcp-configs/generic/mcp.json',
          SUPPORTED_CACHE_FIELDS: JSON.stringify(SUPPORTED_CACHE_FIELDS),
          ...modelMaxTokens,
        },
      },
      agentBuilder: {
        name: `GenUAgentBuilderRuntime${env}`,
        instructions:
          'You are a helpful assistant for AgentBuilder powered by AWS Bedrock.',
        memorySize: 2048,
        dockerPath: 'lambda-python/generic-agent-core-runtime',
        networkMode: 'PUBLIC',
        serverProtocol: 'HTTP',
        environmentVariables: {
          FILE_BUCKET: bucketName,
          MCP_CONFIG_PATH: '/var/task/mcp-configs/agent-builder/mcp.json',
          SUPPORTED_CACHE_FIELDS: JSON.stringify(SUPPORTED_CACHE_FIELDS),
          ...modelMaxTokens,
          ...(webSearchEnabled && {
            WEB_SEARCH_ENABLED: 'true',
            ...(webSearchExcludeDomains &&
              webSearchExcludeDomains.length > 0 && {
                WEB_SEARCH_EXCLUDE_DOMAINS: JSON.stringify(
                  webSearchExcludeDomains
                ),
              }),
          }),
        },
      },
    };
  }

  private createResources(
    createGeneric: boolean,
    createAgentBuilder: boolean,
    isAgentCoreNetworkPrivate: boolean,
    vpc?: IVpc,
    subnets?: ISubnet[],
    securityGroup?: SecurityGroup
  ): RuntimeResources {
    if (!createGeneric && !createAgentBuilder) {
      return { role: this.createExecutionRole() };
    }

    const role = this.createExecutionRole();
    const resources: RuntimeResources = { role };

    if (createGeneric) {
      resources.genericRuntime = this.createRuntime(
        'Generic',
        this.genericRuntimeConfig,
        role,
        isAgentCoreNetworkPrivate,
        vpc,
        subnets,
        securityGroup
      );
    }

    if (createAgentBuilder) {
      resources.agentBuilderRuntime = this.createRuntime(
        'AgentBuilder',
        this.agentBuilderRuntimeConfig,
        role,
        isAgentCoreNetworkPrivate,
        vpc,
        subnets,
        securityGroup
      );
    }

    this.configureRolePermissions(role, this.gatewayArns);
    return resources;
  }

  private createRuntime(
    type: string,
    config: AgentCoreRuntimeConfig,
    role: Role,
    isAgentCoreNetworkPrivate: boolean,
    vpc?: IVpc,
    subnets?: ISubnet[],
    securityGroup?: SecurityGroup
  ): Runtime {
    const networkConfig = this.createNetworkConfiguration(
      isAgentCoreNetworkPrivate,
      vpc,
      subnets,
      securityGroup
    );

    const runtime = new Runtime(this, `${type}AgentCoreRuntime`, {
      runtimeName: config.name,
      agentRuntimeArtifact: AgentRuntimeArtifact.fromAsset(
        path.join(__dirname, `../../${config.dockerPath}`)
      ),
      executionRole: role,
      networkConfiguration: networkConfig,
      protocolConfiguration: ProtocolType.HTTP,
      environmentVariables: config.environmentVariables,
      authorizerConfiguration: this.authorizer(),
    });
    this.forwardTheCallersToken(runtime);
    return runtime;
  }

  /**
   * Ask AgentCore to pass the caller's token through to the agent.
   *
   * A runtime is given only what its allowlist names: by default the
   * Authorization header is consumed by the authorizer and never reaches the
   * agent, which is left unable to tell one caller from another. Naming it
   * here is what lets the agent read the subject of a token the service has
   * already validated.
   *
   * Only with a JWT authorizer — AgentCore refuses the header otherwise, and
   * under IAM it would hold a SigV4 signature rather than a token.
   *
   * Written through the L1: the alpha L2 has no property for this yet.
   */
  private forwardTheCallersToken(runtime: Runtime): void {
    const { userPoolId, userPoolClientId } = this.props;
    if (!userPoolId || !userPoolClientId) {
      return;
    }
    const cfnRuntime = runtime.node.defaultChild as CfnRuntime;
    cfnRuntime.addPropertyOverride(
      'RequestHeaderConfiguration.RequestHeaderAllowlist',
      ['Authorization']
    );
  }

  private createNetworkConfiguration(
    isAgentCoreNetworkPrivate: boolean,
    vpc?: IVpc,
    subnets?: ISubnet[],
    securityGroup?: SecurityGroup
  ): RuntimeNetworkConfiguration {
    if (isAgentCoreNetworkPrivate) {
      if (!vpc || !subnets) {
        throw new Error(
          'VPC and Subnets are required for private network configuration'
        );
      }

      return RuntimeNetworkConfiguration.usingVpc(this, {
        vpc,
        vpcSubnets: { subnets },
        securityGroups: securityGroup ? [securityGroup] : undefined,
      });
    } else {
      return RuntimeNetworkConfiguration.usingPublicNetwork();
    }
  }

  /**
   * How a runtime decides who is calling it.
   *
   * Without a pool it is SigV4, and the caller's identity is whatever the
   * payload claims — fine for a log line, not for deciding whose data a
   * request may reach. With one, AgentCore validates the token and the
   * runtime is handed a subject it did not have to take on trust.
   *
   * The pool is named rather than passed: it belongs to the stack that
   * depends on this one, so there is no construct here to point at.
   */
  private authorizer(): RuntimeAuthorizerConfiguration {
    const { userPoolId, userPoolClientId } = this.props;
    if (!userPoolId || !userPoolClientId) {
      return RuntimeAuthorizerConfiguration.usingIAM();
    }
    // The pool's own region, which its id begins with, not this stack's: the
    // runtimes may live in another region than the pool (the model region),
    // and a token is only valid against the issuer that signed it.
    const region = userPoolId.split('_')[0];
    return RuntimeAuthorizerConfiguration.usingJWT(
      `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/openid-configuration`,
      [userPoolClientId]
    );
  }

  private createExecutionRole(): Role {
    const region = Stack.of(this).region;
    const accountId = Stack.of(this).account;

    return new Role(this, 'AgentCoreRuntimeRole', {
      assumedBy: new ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': accountId },
          ArnLike: {
            'aws:SourceArn': `arn:aws:bedrock-agentcore:${region}:${accountId}:*`,
          },
        },
      }),
    });
  }

  private configureRolePermissions(role: Role, gatewayArns?: string[]): void {
    // Bedrock permissions
    role.addToPolicy(
      new PolicyStatement({
        sid: 'BedrockModelInvocation',
        effect: Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: ['*'],
      })
    );

    // Service-linked role creation
    role.addToPolicy(
      new PolicyStatement({
        sid: 'CreateServiceLinkedRole',
        effect: Effect.ALLOW,
        actions: ['iam:CreateServiceLinkedRole'],
        resources: [
          'arn:aws:iam::*:role/aws-service-role/runtime-identity.bedrock-agentcore.amazonaws.com/AWSServiceRoleForBedrockAgentCoreRuntimeIdentity',
        ],
        conditions: {
          StringEquals: {
            'iam:AWSServiceName':
              'runtime-identity.bedrock-agentcore.amazonaws.com',
          },
        },
      })
    );

    // CodeInterpreter tools
    role.addToPolicy(
      new PolicyStatement({
        sid: 'Tools',
        effect: Effect.ALLOW,
        actions: [
          'bedrock-agentcore:CreateCodeInterpreter',
          'bedrock-agentcore:StartCodeInterpreterSession',
          'bedrock-agentcore:InvokeCodeInterpreter',
          'bedrock-agentcore:StopCodeInterpreterSession',
          'bedrock-agentcore:DeleteCodeInterpreter',
          'bedrock-agentcore:ListCodeInterpreters',
          'bedrock-agentcore:GetCodeInterpreter',
          'bedrock-agentcore:GetCodeInterpreterSession',
          'bedrock-agentcore:ListCodeInterpreterSessions',
        ],
        resources: ['*'],
      })
    );

    // Gateway tools
    role.addToPolicy(
      new PolicyStatement({
        sid: 'AllowGatewayInvocation',
        effect: Effect.ALLOW,
        actions: ['bedrock-agentcore:InvokeGateway'],
        resources: gatewayArns && gatewayArns.length > 0 ? gatewayArns : ['*'],
      })
    );

    // AgentCore Web Search for the agent builder
    if (this.webSearchEnabled) {
      const stack = Stack.of(this);
      role.addToPolicy(
        new PolicyStatement({
          sid: 'AllowWebSearch',
          effect: Effect.ALLOW,
          actions: ['bedrock-agentcore:InvokeWebSearch'],
          resources: [
            `arn:${stack.partition}:bedrock-agentcore:${stack.region}:aws:tool/web-search.v1`,
          ],
        })
      );
    }

    this._fileBucket.grantWrite(role);
  }

  // Public getters - all non-optional
  public get deployedGenericRuntimeArn(): string | undefined {
    return this.resources.genericRuntime?.agentRuntimeArn;
  }

  public get deployedAgentBuilderRuntimeArn(): string | undefined {
    return this.resources.agentBuilderRuntime?.agentRuntimeArn;
  }

  public getGenericRuntimeConfig(): AgentCoreRuntimeConfig {
    return { ...this.genericRuntimeConfig };
  }

  public getAgentBuilderRuntimeConfig(): AgentCoreRuntimeConfig {
    return { ...this.agentBuilderRuntimeConfig };
  }

  public get fileBucket(): Bucket {
    return this._fileBucket;
  }

  public get fileBucketInfo(): BucketInfo {
    return {
      bucketName: this._fileBucket.bucketName,
      region: Stack.of(this).region,
    };
  }
}
