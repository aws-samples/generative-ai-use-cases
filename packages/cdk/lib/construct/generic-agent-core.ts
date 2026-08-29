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
import {
  Runtime,
  RuntimeNetworkConfiguration,
  ProtocolType,
  AgentRuntimeArtifact,
} from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { BucketInfo } from 'generative-ai-use-cases';
import * as path from 'path';
import { SUPPORTED_CACHE_FIELDS } from '@generative-ai-use-cases/common';

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
}

interface RuntimeResources {
  genericRuntime?: Runtime;
  agentBuilderRuntime?: Runtime;
  role: Role;
}

export class GenericAgentCore extends Construct {
  private readonly _fileBucket: Bucket;
  private readonly genericRuntimeConfig: AgentCoreRuntimeConfig;
  private readonly agentBuilderRuntimeConfig: AgentCoreRuntimeConfig;
  private readonly resources: RuntimeResources;
  private readonly gatewayArns?: string[];

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
    } = props;

    this.gatewayArns = gatewayArns;

    // Create bucket first
    this._fileBucket = this.createFileBucket();

    // Load configurations
    const configs = this.loadConfigurations(env, this._fileBucket.bucketName);
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

  private loadConfigurations(env: string, bucketName: string) {
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
          MCP_CONFIG_PATH: '/var/task/mcp-configs/generic/mcp.json',
          SUPPORTED_CACHE_FIELDS: JSON.stringify(SUPPORTED_CACHE_FIELDS),
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
