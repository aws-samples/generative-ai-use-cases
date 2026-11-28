import { Construct } from 'constructs';
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Stack, RemovalPolicy } from 'aws-cdk-lib';
import {
  Bucket,
  BlockPublicAccess,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import {
  Runtime,
  RuntimeNetworkConfiguration,
  ProtocolType,
  AgentRuntimeArtifact,
} from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { BucketInfo } from 'generative-ai-use-cases';
import {
  AgentCoreRuntimePlatformVersion,
  setRuntimePlatformVersion,
} from '../utils/agent-core-runtime';
import * as path from 'path';

export interface ResearchAgentCoreProps {
  env: string;
  braveApiKey?: string;
  tavilyApiKey?: string;
  gatewayArns?: string[];
  runtimePlatformVersion?: AgentCoreRuntimePlatformVersion;
}

export class ResearchAgentCore extends Construct {
  private readonly _fileBucket: Bucket;
  private readonly _runtime: Runtime;
  private readonly _role: Role;
  private readonly runtimePlatformVersion?: AgentCoreRuntimePlatformVersion;

  constructor(scope: Construct, id: string, props: ResearchAgentCoreProps) {
    super(scope, id);

    const { env, braveApiKey = '', tavilyApiKey = '', gatewayArns } = props;
    this.runtimePlatformVersion = props.runtimePlatformVersion;

    // Create bucket
    this._fileBucket = new Bucket(this, 'ResearchAgentFileBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create execution role
    this._role = this.createExecutionRole();

    // Configure role permissions
    this.configureRolePermissions(this._role, gatewayArns);

    // Create runtime
    this._runtime = this.createRuntime(env, braveApiKey, tavilyApiKey);
  }

  private createRuntime(
    env: string,
    propsBraveApiKey: string,
    propsTavilyApiKey: string
  ): Runtime {
    const region = Stack.of(this).region;

    const environmentVariables: Record<string, string> = {
      MCP_CONFIG_PATH: '/var/task/mcp-configs/mcp.json',
      MAX_ITERATIONS: '200',
      CLAUDE_CODE_USE_BEDROCK: '1',
      AWS_REGION: region,
    };

    // Add API key from props or context
    const braveApiKey =
      propsBraveApiKey ||
      (this.node.tryGetContext('researchAgentBraveApiKey') as string) ||
      '';
    if (braveApiKey) {
      environmentVariables.BRAVE_API_KEY = braveApiKey;
    }

    const tavilyApiKey =
      propsTavilyApiKey ||
      (this.node.tryGetContext('researchAgentTavilyApiKey') as string) ||
      '';
    if (tavilyApiKey) {
      environmentVariables.TAVILY_API_KEY = tavilyApiKey;
    }

    const runtime = new Runtime(this, 'ResearchAgentCoreRuntime', {
      runtimeName: `GenUResearchRuntime${env}`,
      agentRuntimeArtifact: AgentRuntimeArtifact.fromAsset(
        path.join(__dirname, '../../lambda-python/research-agent-core-runtime')
      ),
      executionRole: this._role,
      networkConfiguration: RuntimeNetworkConfiguration.usingPublicNetwork(),
      protocolConfiguration: ProtocolType.HTTP,
      environmentVariables,
    });
    setRuntimePlatformVersion(runtime, this.runtimePlatformVersion);
    return runtime;
  }

  private createExecutionRole(): Role {
    const region = Stack.of(this).region;
    const accountId = Stack.of(this).account;

    return new Role(this, 'ResearchAgentCoreRuntimeRole', {
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

  // Public getters
  public get deployedRuntimeArn(): string | undefined {
    return this._runtime.agentRuntimeArn;
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
