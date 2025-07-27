import { Construct } from 'constructs';
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
  ManagedPolicy,
} from 'aws-cdk-lib/aws-iam';
import { CustomResource, Duration, Stack } from 'aws-cdk-lib';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as path from 'path';

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
  // Add any specific configuration props if needed
}

// UUID for Agent Core Runtime
const AGENT_CORE_RUNTIME_UUID = 'B8F5E892-3A1C-4D2F-9B7E-6C8A5F9D2E1B';

export class GenericAgentCore extends Construct {
  private _deployedGenericRuntimeArn?: string;
  private _ecrRepository?: Repository;
  private _imageUri?: string;
  private readonly genericRuntimeConfig: AgentCoreRuntimeConfig;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Default configuration for Generic AgentCore Runtime
    this.genericRuntimeConfig = {
      name: 'GenericAgentCoreRuntime',
      instructions: 'You are a helpful assistant powered by AWS Bedrock.',
      memorySize: 2048,
      dockerPath: 'lambda-python/generic-agent-core-runtime',
      networkMode: 'PUBLIC',
      serverProtocol: 'HTTP',
    };

    // Deploy generic AgentCore Runtime
    const result = this.deployGenericRuntime();
    this._ecrRepository = result.repository;
    this._imageUri = result.imageUri;
  }

  /**
   * Deploy the generic AgentCore Runtime
   */
  private deployGenericRuntime(): { repository: Repository; imageUri: string } {
    const dockerImageAsset = this.createDockerImageAsset();
    const { customResourceRole, agentCoreRuntimeRole } = this.createIamRoles();
    const customResourceProvider =
      this.createCustomResourceProvider(customResourceRole);

    const customResource = this.createAgentCoreRuntime(
      'GenericAgentCoreRuntime',
      this.genericRuntimeConfig,
      agentCoreRuntimeRole,
      customResourceProvider,
      dockerImageAsset.imageUri
    );

    // Get the actual runtime ARN and ID from CustomResource response
    this._deployedGenericRuntimeArn = customResource.getAttString(
      'AgentCoreRuntimeArn'
    );

    return dockerImageAsset;
  }

  /**
   * Create Docker image asset for the MCP API
   */
  private createDockerImageAsset(): {
    repository: Repository;
    imageUri: string;
  } {
    const dockerPath =
      this.genericRuntimeConfig.dockerPath ||
      'lambda-python/generic-agent-core-runtime';
    const pathName = dockerPath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    const repository = new Repository(this, 'AgentCoreRuntimeRepository', {
      repositoryName: `${pathName}-${Stack.of(this).stackName.toLowerCase()}`,
      imageScanOnPush: true,
    });

    const dockerAsset = new DockerImageAsset(
      this,
      'AgentCoreRuntimeDockerAsset',
      {
        directory: path.join(__dirname, `../../${dockerPath}`),
        platform: Platform.LINUX_ARM64, // AgentCore for ARM platform
      }
    );

    return {
      repository,
      imageUri: dockerAsset.imageUri,
    };
  }

  /**
   * Create IAM roles for AgentCore operations
   */
  private createIamRoles(): {
    customResourceRole: Role;
    agentCoreRuntimeRole: Role;
  } {
    const customResourceRole = this.createCustomResourceRole();
    const agentCoreRuntimeRole = this.createAgentCoreRuntimeRole();

    return { customResourceRole, agentCoreRuntimeRole };
  }

  /**
   * Create IAM role for Custom Resource operations
   */
  private createCustomResourceRole(): Role {
    const role = new Role(this, 'AgentCoreCustomResourceRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    role.addToPolicy(
      new PolicyStatement({
        sid: 'BedrockAgentCorePermissions',
        effect: Effect.ALLOW,
        actions: ['bedrock-agentcore:*'],
        resources: ['*'],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: 'IAMPassRolePermissions',
        effect: Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'iam:PassedToService': 'bedrock-agentcore.amazonaws.com',
          },
        },
      })
    );

    return role;
  }

  /**
   * Create IAM role for AgentCore Runtime execution with comprehensive permissions
   */
  private createAgentCoreRuntimeRole(): Role {
    const role = new Role(this, 'AgentCoreRuntimeRole', {
      assumedBy: new ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: {
            'aws:SourceAccount': Stack.of(this).account,
          },
          ArnLike: {
            'aws:SourceArn': `arn:aws:bedrock-agentcore:${Stack.of(this).region}:${Stack.of(this).account}:*`,
          },
        },
      }),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    // Bedrock

    role.addToPolicy(
      new PolicyStatement({
        sid: 'BedrockPermissions',
        effect: Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: ['*'],
      })
    );

    // ECR

    role.addToPolicy(
      new PolicyStatement({
        sid: 'ECRImageAccess',
        effect: Effect.ALLOW,
        actions: ['ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
        resources: [
          `arn:aws:ecr:${Stack.of(this).region}:${Stack.of(this).account}:repository/*`,
        ],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        sid: 'ECRTokenAccess',
        effect: Effect.ALLOW,
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    );

    // Logging

    const logGroupArn = `arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:log-group:/aws/bedrock-agentcore/runtimes/*`;

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['logs:DescribeLogStreams', 'logs:CreateLogGroup'],
        resources: [logGroupArn],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['logs:DescribeLogGroups'],
        resources: [
          `arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:log-group:*`,
        ],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [`${logGroupArn}:log-stream:*`],
      })
    );

    // Monitoring
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
          'xray:GetSamplingRules',
          'xray:GetSamplingTargets',
        ],
        resources: ['*'],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'bedrock-agentcore',
          },
        },
      })
    );

    // Workload

    role.addToPolicy(
      new PolicyStatement({
        sid: 'GetAgentAccessToken',
        effect: Effect.ALLOW,
        actions: [
          'bedrock-agentcore:GetWorkloadAccessToken',
          'bedrock-agentcore:GetWorkloadAccessTokenForJWT',
          'bedrock-agentcore:GetWorkloadAccessTokenForUserId',
        ],
        resources: [
          `arn:aws:bedrock-agentcore:${Stack.of(this).region}:${Stack.of(this).account}:workload-identity-directory/default`,
          `arn:aws:bedrock-agentcore:${Stack.of(this).region}:${Stack.of(this).account}:workload-identity-directory/default/workload-identity/*`,
        ],
      })
    );

    return role;
  }

  /**
   * Get or create a singleton NodejsFunction using unique ID pattern
   */
  private getOrCreateSingletonFunction(
    uniqueId: string,
    functionName: string,
    entry: string,
    role: Role
  ): NodejsFunction {
    const stack = Stack.of(this);
    const singletonId = `Singleton-${uniqueId}`;

    // Try to find existing function in the stack scope
    const existingConstruct = stack.node.tryFindChild(singletonId);

    if (existingConstruct && existingConstruct instanceof NodejsFunction) {
      // Reuse existing function
      return existingConstruct;
    }

    // Create new NodejsFunction
    return new NodejsFunction(stack, singletonId, {
      functionName: `${functionName}-${Stack.of(this).stackName}-${uniqueId.slice(0, 8)}`,
      description: `${functionName} CustomResource Lambda Function (Singleton)`,
      runtime: Runtime.NODEJS_18_X,
      entry,
      handler: 'handler',
      timeout: Duration.minutes(10),
      role,
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      bundling: {
        minify: false,
        target: 'es2020',
        nodeModules: ['@aws-sdk/client-bedrock-agentcore-control'],
      },
    });
  }

  /**
   * Create Custom Resource provider with custom singleton logic
   */
  private createCustomResourceProvider(customResourceRole: Role): Provider {
    const lambdaFunction = this.getOrCreateSingletonFunction(
      AGENT_CORE_RUNTIME_UUID,
      'AgentCoreRuntime',
      path.join(
        __dirname,
        '../../custom-resources/agent-core-runtime/index.ts'
      ),
      customResourceRole
    );

    return new Provider(this, 'AgentCoreRuntimeProvider', {
      onEventHandler: lambdaFunction,
    });
  }

  /**
   * Create individual AgentCore Runtime using Custom Resource
   */
  private createAgentCoreRuntime(
    id: string,
    config: AgentCoreRuntimeConfig,
    agentCoreRuntimeRole: Role,
    customResourceProvider: Provider,
    imageUri: string
  ): CustomResource {
    if (!imageUri) {
      throw new Error(
        `AgentCore Runtime '${config.name}' requires imageUri to be provided`
      );
    }

    const customConfig = { ...config.customRuntimeConfig };
    customConfig.containerImageUri = imageUri;

    if (config.environmentVariables) {
      customConfig.environmentVariables = config.environmentVariables;
    }

    return new CustomResource(this, id, {
      serviceToken: customResourceProvider.serviceToken,
      properties: {
        AgentCoreRuntimeName: config.name,
        RoleArn: agentCoreRuntimeRole.roleArn,
        NetworkMode: config.networkMode || 'PUBLIC',
        ServerProtocol: config.serverProtocol || 'HTTP',
        CustomConfig: customConfig,
      },
    });
  }

  /**
   * Get ECR repository
   */
  public get ecrRepository(): Repository | undefined {
    return this._ecrRepository;
  }

  /**
   * Get MCP API image URI
   */
  public get imageUri(): string | undefined {
    return this._imageUri;
  }

  /**
   * Get deployed generic runtime ARN
   */
  public get deployedGenericRuntimeArn(): string | undefined {
    return this._deployedGenericRuntimeArn;
  }

  /**
   * Get the generic runtime configuration
   */
  public getGenericRuntimeConfig(): AgentCoreRuntimeConfig {
    return { ...this.genericRuntimeConfig };
  }
}
