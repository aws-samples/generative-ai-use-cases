import {
  IAMClient,
  CreateRoleCommand,
  DeleteRoleCommand,
  PutRolePolicyCommand,
  DeleteRolePolicyCommand,
  GetRoleCommand,
  TagRoleCommand,
  CreateRoleCommandInput,
} from '@aws-sdk/client-iam';
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from 'aws-lambda';

const iam = new IAMClient({});

export const handler = async (
  event: CloudFormationCustomResourceEvent
): Promise<CloudFormationCustomResourceResponse> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const tenantId = event.ResourceProperties.TenantId;
  const physicalResourceId = `tenant-${tenantId}-execution-role`;
  
  try {
    switch (event.RequestType) {
      case 'Create':
      case 'Update':
        await createOrUpdateTenantRole(tenantId);
        return {
          RequestId: event.RequestId,
          LogicalResourceId: event.LogicalResourceId,
          PhysicalResourceId: physicalResourceId,
          StackId: event.StackId,
          Status: 'SUCCESS',
          Data: {
            RoleArn: `arn:aws:iam::${process.env.AWS_ACCOUNT_ID}:role/${physicalResourceId}`,
          },
        };

      case 'Delete':
        await deleteTenantRole(tenantId);
        return {
          RequestId: event.RequestId,
          LogicalResourceId: event.LogicalResourceId,
          PhysicalResourceId: physicalResourceId,
          StackId: event.StackId,
          Status: 'SUCCESS',
        };

      default:
        throw new Error(`Unsupported request type: ${event.RequestType}`);
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      Status: 'FAILED',
      Reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

async function createOrUpdateTenantRole(tenantId: string): Promise<void> {
  const roleName = `tenant-${tenantId}-execution-role`;
  
  // Check if role exists
  try {
    await iam.send(new GetRoleCommand({ RoleName: roleName }));
    console.log(`Role ${roleName} already exists, updating policies...`);
  } catch (error: any) {
    if (error.name === 'NoSuchEntityException') {
      // Create the role
      const assumeRolePolicyDocument = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
          {
            Effect: 'Allow',
            Principal: {
              AWS: process.env.LAMBDA_EXECUTION_ROLE_ARN,
            },
            Action: 'sts:AssumeRole',
          },
        ],
      };

      const createRoleInput: CreateRoleCommandInput = {
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDocument),
        Description: `Tenant-specific role for ${tenantId} with isolated resource access`,
        Tags: [
          {
            Key: 'TenantId',
            Value: tenantId,
          },
        ],
      };

      await iam.send(new CreateRoleCommand(createRoleInput));
      console.log(`Created role ${roleName}`);
    } else {
      throw error;
    }
  }

  // Add policies for tenant-specific access
  await updateTenantPolicies(tenantId, roleName);
}

async function updateTenantPolicies(tenantId: string, roleName: string): Promise<void> {
  const bedrockModelArns = JSON.parse(process.env.BEDROCK_MODEL_ARNS || '[]');
  const s3BucketArn = process.env.S3_BUCKET_ARN;
  const dynamoTableArn = process.env.DYNAMODB_TABLE_ARN;

  // Bedrock access policy
  if (bedrockModelArns.length > 0) {
    const bedrockPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'bedrock:InvokeModel',
            'bedrock:InvokeModelWithResponseStream',
          ],
          Resource: bedrockModelArns,
          Condition: {
            StringEquals: {
              'aws:RequestTag/TenantId': tenantId,
            },
          },
        },
      ],
    };

    await iam.send(new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: 'BedrockAccess',
      PolicyDocument: JSON.stringify(bedrockPolicy),
    }));
  }

  // S3 access policy
  if (s3BucketArn) {
    const s3Policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
          ],
          Resource: `${s3BucketArn}/tenants/${tenantId}/*`,
        },
        {
          Effect: 'Allow',
          Action: 's3:ListBucket',
          Resource: s3BucketArn,
          Condition: {
            StringLike: {
              's3:prefix': `tenants/${tenantId}/*`,
            },
          },
        },
      ],
    };

    await iam.send(new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: 'S3Access',
      PolicyDocument: JSON.stringify(s3Policy),
    }));
  }

  // DynamoDB access policy
  if (dynamoTableArn) {
    const dynamoPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'dynamodb:Query',
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
          ],
          Resource: [
            dynamoTableArn,
            `${dynamoTableArn}/index/*`,
          ],
          Condition: {
            'ForAllValues:StringEquals': {
              'dynamodb:LeadingKeys': [`${tenantId}#*`],
            },
          },
        },
        {
          Effect: 'Allow',
          Action: [
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem',
          ],
          Resource: dynamoTableArn,
          Condition: {
            'ForAllValues:StringLike': {
              'dynamodb:LeadingKeys': [`${tenantId}#*`],
            },
          },
        },
      ],
    };

    await iam.send(new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: 'DynamoDBAccess',
      PolicyDocument: JSON.stringify(dynamoPolicy),
    }));
  }

  // Basic Lambda execution policy
  const lambdaExecutionPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        Resource: 'arn:aws:logs:*:*:*',
      },
      {
        Effect: 'Allow',
        Action: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
        ],
        Resource: '*',
      },
    ],
  };

  await iam.send(new PutRolePolicyCommand({
    RoleName: roleName,
    PolicyName: 'LambdaExecution',
    PolicyDocument: JSON.stringify(lambdaExecutionPolicy),
  }));
}

async function deleteTenantRole(tenantId: string): Promise<void> {
  const roleName = `tenant-${tenantId}-execution-role`;

  try {
    // Delete all inline policies first
    const policies = ['BedrockAccess', 'S3Access', 'DynamoDBAccess', 'LambdaExecution'];
    
    for (const policyName of policies) {
      try {
        await iam.send(new DeleteRolePolicyCommand({
          RoleName: roleName,
          PolicyName: policyName,
        }));
      } catch (error: any) {
        if (error.name !== 'NoSuchEntityException') {
          throw error;
        }
      }
    }

    // Delete the role
    await iam.send(new DeleteRoleCommand({ RoleName: roleName }));
    console.log(`Deleted role ${roleName}`);
  } catch (error: any) {
    if (error.name !== 'NoSuchEntityException') {
      throw error;
    }
    console.log(`Role ${roleName} does not exist, skipping deletion`);
  }
}