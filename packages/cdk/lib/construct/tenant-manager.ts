import { Construct } from 'constructs';
import { 
  CustomResource,
  Duration,
  Stack,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { 
  Role, 
  PolicyStatement, 
  Effect, 
  ServicePrincipal,
  IRole,
} from 'aws-cdk-lib/aws-iam';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { LAMBDA_RUNTIME_NODEJS } from '../../consts';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from 'aws-cdk-lib/aws-s3';

export interface TenantManagerProps {
  readonly table: Table;
  readonly bucket: Bucket;
  readonly bedrockModelArns?: string[];
  readonly lambdaExecutionRoleArn: string;
}

export class TenantManager extends Construct {
  public readonly tenantRoleFunction: NodejsFunction;
  public readonly provider: Provider;

  constructor(scope: Construct, id: string, props: TenantManagerProps) {
    super(scope, id);

    const stack = Stack.of(this);

    // Create Lambda function for managing tenant roles
    this.tenantRoleFunction = new NodejsFunction(this, 'TenantRoleFunction', {
      runtime: LAMBDA_RUNTIME_NODEJS,
      entry: './lambda/manageTenantRole.ts',
      timeout: Duration.minutes(5),
      environment: {
        BEDROCK_MODEL_ARNS: JSON.stringify(props.bedrockModelArns || []),
        S3_BUCKET_ARN: props.bucket.bucketArn,
        DYNAMODB_TABLE_ARN: props.table.tableArn,
        LAMBDA_EXECUTION_ROLE_ARN: props.lambdaExecutionRoleArn,
      },
    });

    // Grant permissions to manage IAM roles
    this.tenantRoleFunction.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'iam:CreateRole',
        'iam:DeleteRole',
        'iam:AttachRolePolicy',
        'iam:DetachRolePolicy',
        'iam:PutRolePolicy',
        'iam:DeleteRolePolicy',
        'iam:GetRole',
        'iam:ListAttachedRolePolicies',
        'iam:ListRolePolicies',
        'iam:TagRole',
        'iam:UntagRole',
      ],
      resources: [`arn:aws:iam::${stack.account}:role/tenant-*`],
    }));

    // Create custom resource provider
    this.provider = new Provider(this, 'Provider', {
      onEventHandler: this.tenantRoleFunction,
    });
  }

  /**
   * Create a custom resource for a specific tenant
   */
  public createTenantRole(tenantId: string): CustomResource {
    return new CustomResource(this, `TenantRole-${tenantId}`, {
      serviceToken: this.provider.serviceToken,
      properties: {
        TenantId: tenantId,
        Action: 'CREATE',
      },
    });
  }
}