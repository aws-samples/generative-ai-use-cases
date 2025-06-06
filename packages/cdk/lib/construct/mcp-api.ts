import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  DockerImageFunction,
  DockerImageCode,
  Architecture,
  FunctionUrlAuthType,
  InvokeMode,
  HttpMethod,
} from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { IdentityPool } from 'aws-cdk-lib/aws-cognito-identitypool';

export interface McpApiProps {
  readonly idPool: IdentityPool;
}

export class McpApi extends Construct {
  public readonly endpoint: string;

  constructor(scope: Construct, id: string, props: McpApiProps) {
    super(scope, id);

    const mcpFunction = new DockerImageFunction(this, 'McpFunction', {
      code: DockerImageCode.fromImageAsset('./mcp-api'),
      memorySize: 1024,
      timeout: Duration.minutes(15),
      architecture: Architecture.ARM_64,
      environment: {
        AWS_LWA_INVOKE_MODE: 'RESPONSE_STREAM',
      },
    });

    mcpFunction.role?.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:*'],
        resources: ['*'],
      })
    );

    const mcpEndpoint = mcpFunction.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
      cors: {
        allowedOrigins: ['*'],
        allowedMethods: [HttpMethod.ALL],
        allowedHeaders: ['*'],
      },
      invokeMode: InvokeMode.RESPONSE_STREAM,
    });

    mcpEndpoint.grantInvokeUrl(props.idPool.authenticatedRole);

    this.endpoint = `${mcpEndpoint.url}streaming`;
  }
}
