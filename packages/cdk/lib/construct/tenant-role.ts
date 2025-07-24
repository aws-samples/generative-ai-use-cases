import { Construct } from 'constructs';
import { 
  Role, 
  PolicyStatement, 
  Effect, 
  ServicePrincipal, 
  ArnPrincipal,
  CompositePrincipal,
  IRole,
} from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';

export interface TenantRoleProps {
  readonly tenantId: string;
  readonly bedrockModelArns?: string[];
  readonly s3BucketArn?: string;
  readonly dynamoTableArn?: string;
  readonly lambdaExecutionRoleArn: string;
  readonly enableBedrockAccess?: boolean;
  readonly enableS3Access?: boolean;
  readonly enableDynamoDBAccess?: boolean;
}

export class TenantRole extends Construct {
  public readonly role: IRole;

  constructor(scope: Construct, id: string, props: TenantRoleProps) {
    super(scope, id);

    const stack = Stack.of(this);

    // Create tenant-specific role that can be assumed by Lambda functions
    this.role = new Role(this, 'Role', {
      roleName: `tenant-${props.tenantId}-execution-role`,
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('lambda.amazonaws.com'),
        new ArnPrincipal(props.lambdaExecutionRoleArn),
      ),
      description: `Tenant-specific role for ${props.tenantId} with isolated resource access`,
    });

    // Add tenant tag to the role
    this.role.node.addMetadata('TenantId', props.tenantId);

    // Bedrock access with tenant isolation
    if (props.enableBedrockAccess && props.bedrockModelArns && props.bedrockModelArns.length > 0) {
      this.role.addToPolicy(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: props.bedrockModelArns,
        conditions: {
          'StringEquals': {
            'aws:RequestTag/TenantId': props.tenantId,
          },
        },
      }));
    }

    // S3 access with prefix-based tenant isolation
    if (props.enableS3Access && props.s3BucketArn) {
      this.role.addToPolicy(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:DeleteObject',
        ],
        resources: [`${props.s3BucketArn}/tenants/${props.tenantId}/*`],
      }));

      // Allow listing objects within tenant prefix
      this.role.addToPolicy(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:ListBucket'],
        resources: [props.s3BucketArn],
        conditions: {
          'StringLike': {
            's3:prefix': [`tenants/${props.tenantId}/*`],
          },
        },
      }));
    }

    // DynamoDB access with tenant isolation using partition key
    if (props.enableDynamoDBAccess && props.dynamoTableArn) {
      this.role.addToPolicy(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'dynamodb:Query',
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
        ],
        resources: [
          props.dynamoTableArn,
          `${props.dynamoTableArn}/index/*`,
        ],
        conditions: {
          'ForAllValues:StringEquals': {
            'dynamodb:LeadingKeys': [`${props.tenantId}#*`],
          },
        },
      }));

      // Allow batch operations with tenant prefix
      this.role.addToPolicy(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'dynamodb:BatchGetItem',
          'dynamodb:BatchWriteItem',
        ],
        resources: [props.dynamoTableArn],
        conditions: {
          'ForAllValues:StringLike': {
            'dynamodb:LeadingKeys': [`${props.tenantId}#*`],
          },
        },
      }));
    }

    // Basic Lambda execution permissions
    this.role.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [`arn:aws:logs:${stack.region}:${stack.account}:log-group:/aws/lambda/*`],
    }));

    // X-Ray tracing permissions
    this.role.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
      ],
      resources: ['*'],
    }));
  }
}