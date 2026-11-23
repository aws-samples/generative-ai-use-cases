import { Construct } from 'constructs';
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Duration, Stack, RemovalPolicy, Tags } from 'aws-cdk-lib';
import {
  Bucket,
  BlockPublicAccess,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import { Subnet, Vpc, SecurityGroup, IVpc, ISubnet } from 'aws-cdk-lib/aws-ec2';
import { Memory, MemoryStrategy } from 'aws-cdk-lib/aws-bedrockagentcore';
import {
  Runtime,
  RuntimeNetworkConfiguration,
  ProtocolType,
  AgentRuntimeArtifact,
} from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { BucketInfo } from 'generative-ai-use-cases';
import * as path from 'path';
import {
  SUPPORTED_CACHE_FIELDS,
  modelMetadata,
} from '@generative-ai-use-cases/common';
import { agentCoreRuntimeConfigParameterName } from '../../consts';

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
  /** Region of the main GenU stack, where the runtime config parameter lives. */
  mainRegion: string;
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
  // Memory for the Agent Builder runtime. Created only with that runtime.
  agentMemoryEnabled?: boolean;
  agentMemoryExpirationDays?: number;
}

interface RuntimeResources {
  genericRuntime?: Runtime;
  agentBuilderRuntime?: Runtime;
  role: Role;
}

/**
 * Where each kind of memory is filed. The runtime builds the same paths to
 * read and delete them, so they are fixed here rather than left to the
 * strategy ids AgentCore would otherwise put in them. {actorId} is one user
 * of one agent (see the runtime's memory.py).
 */
export const AGENT_MEMORY_NAMESPACES = {
  facts: '/genu/facts/{actorId}',
  preferences: '/genu/preferences/{actorId}',
  summaries: '/genu/summaries/{actorId}/{sessionId}',
} as const;

export class GenericAgentCore extends Construct {
  private readonly _fileBucket: Bucket;
  private readonly genericRuntimeConfig: AgentCoreRuntimeConfig;
  private readonly agentBuilderRuntimeConfig: AgentCoreRuntimeConfig;
  private readonly resources: RuntimeResources;
  private readonly gatewayArns?: string[];
  private readonly envName: string;
  private readonly mainRegion: string;
  private readonly webSearchEnabled: boolean;
  private readonly agentMemory?: Memory;

  // Security Group ID that requires manual cleanup after AgentCore Runtime deletion
  // Used for CloudFormation Output to remind users of manual cleanup tasks
  public readonly retainedSecurityGroupId?: string;

  constructor(scope: Construct, id: string, props: GenericAgentCoreProps) {
    super(scope, id);

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
    this.envName = env;
    this.mainRegion = props.mainRegion;
    this.webSearchEnabled = webSearchEnabled;

    if (createAgentBuilderRuntime && props.agentMemoryEnabled) {
      this.agentMemory = this.createAgentMemory(
        env,
        props.agentMemoryExpirationDays ?? 90
      );
    }

    // Create bucket first
    this._fileBucket = this.createFileBucket();

    // Load configurations
    const configs = this.loadConfigurations(
      env,
      props.mainRegion,
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

    // Record conversations, read memories back, and delete them when a user
    // asks. The runtime acts only on the caller's own actor (memory.py).
    if (this.agentMemory) {
      this.agentMemory.grantWrite(this.resources.role);
      this.agentMemory.grantRead(this.resources.role);
      this.agentMemory.grantDelete(this.resources.role);
      // "Delete all" removes records in batches, which grantDelete leaves out
      this.agentMemory.grant(
        this.resources.role,
        'bedrock-agentcore:BatchDeleteMemoryRecords'
      );
    }
  }

  /**
   * Memory for Agent Builder agents. Three long-term strategies, each filed
   * under a namespace of its own (AGENT_MEMORY_NAMESPACES): facts the user
   * stated, the user's preferences, and a summary of each conversation.
   */
  private createAgentMemory(env: string, expirationDays: number): Memory {
    // Letters, digits and underscores only, up to 48 characters
    const suffix = env.replace(/[^a-zA-Z0-9]/g, '');
    return new Memory(this, 'AgentBuilderMemory', {
      memoryName: `GenUAgentBuilderMemory${suffix}`.slice(0, 48),
      description: 'Memory of Agent Builder agents, per user and per agent',
      expirationDuration: Duration.days(expirationDays),
      memoryStrategies: [
        MemoryStrategy.usingSemantic({
          strategyName: 'genu_facts',
          description: 'Facts the user stated to the agent',
          namespaces: [AGENT_MEMORY_NAMESPACES.facts],
        }),
        MemoryStrategy.usingUserPreference({
          strategyName: 'genu_preferences',
          description: 'How the user likes to work with the agent',
          namespaces: [AGENT_MEMORY_NAMESPACES.preferences],
        }),
        MemoryStrategy.usingSummarization({
          strategyName: 'genu_summaries',
          description: 'A summary of each conversation',
          namespaces: [AGENT_MEMORY_NAMESPACES.summaries],
        }),
      ],
    });
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
    mainRegion: string,
    modelIds: string[],
    closedNetworkMode: boolean,
    webSearchEnabled: boolean,
    webSearchExcludeDomains?: string[]
  ) {
    const modelMaxTokens = this.modelMaxTokensEnvironment(modelIds);
    // The user pool and file bucket the runtime stores output files with,
    // published by the main stack (see agentCoreRuntimeConfigParameterName).
    const runtimeConfigEnv = {
      RUNTIME_CONFIG_PARAMETER: agentCoreRuntimeConfigParameterName(env),
      RUNTIME_CONFIG_REGION: mainRegion,
    };
    return {
      generic: {
        name: `GenUGenericRuntime${env}`,
        instructions: 'You are a helpful assistant powered by AWS Bedrock.',
        memorySize: 2048,
        dockerPath: 'lambda-python/generic-agent-core-runtime',
        networkMode: 'PUBLIC',
        serverProtocol: 'HTTP',
        environmentVariables: {
          ...runtimeConfigEnv,
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
          ...runtimeConfigEnv,
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
          ...(this.agentMemory && {
            AGENT_MEMORY_ID: this.agentMemory.memoryId,
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

    return new Runtime(this, `${type}AgentCoreRuntime`, {
      runtimeName: config.name,
      agentRuntimeArtifact: AgentRuntimeArtifact.fromAsset(
        path.join(__dirname, `../../${config.dockerPath}`)
      ),
      executionRole: role,
      networkConfiguration: networkConfig,
      protocolConfiguration: ProtocolType.HTTP,
      environmentVariables: config.environmentVariables,
    });
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

    // Runtime config published by the main stack. Output files are written to
    // the main file bucket, whose bucket policy allows this role.
    role.addToPolicy(
      new PolicyStatement({
        sid: 'ReadRuntimeConfig',
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:${this.mainRegion}:${Stack.of(this).account}:parameter${agentCoreRuntimeConfigParameterName(this.envName)}`,
        ],
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

  /** Execution role of the runtimes. The main stack lets it write output files. */
  public get runtimeRole(): Role {
    return this.resources.role;
  }

  public get fileBucketInfo(): BucketInfo {
    return {
      bucketName: this._fileBucket.bucketName,
      region: Stack.of(this).region,
    };
  }
}
