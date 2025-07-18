import { Duration, Size } from 'aws-cdk-lib';
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
import { NetworkMode } from 'aws-cdk-lib/aws-ecr-assets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ISecurityGroup, IVpc } from 'aws-cdk-lib/aws-ec2';

export interface McpApiProps {
  readonly idPool: IdentityPool;
  readonly isSageMakerStudio: boolean;
  readonly fileBucket: Bucket;
  readonly vpc?: IVpc;
  readonly securityGroups?: ISecurityGroup[];
}

export class McpApi extends Construct {
  public readonly endpoint: string;

  constructor(scope: Construct, id: string, props: McpApiProps) {
    super(scope, id);
    const mcpFunction = new DockerImageFunction(this, 'McpFunction', {
      code: DockerImageCode.fromImageAsset('./mcp-api', {
        networkMode: props.isSageMakerStudio
          ? NetworkMode.custom('sagemaker')
          : NetworkMode.DEFAULT,
      }),
      memorySize: 1024,
      ephemeralStorageSize: Size.mebibytes(1024),
      timeout: Duration.minutes(15),
      architecture: Architecture.X86_64,
      environment: {
        AWS_LWA_INVOKE_MODE: 'RESPONSE_STREAM',
        FILE_BUCKET: props.fileBucket.bucketName,
      },
      vpc: props.vpc,
      securityGroups: props.securityGroups,
    });

    mcpFunction.role?.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:*'],
        resources: ['*'],
      })
    );

    props.fileBucket.grantWrite(mcpFunction);

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
