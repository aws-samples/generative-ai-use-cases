import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Duration } from 'aws-cdk-lib';
import { LAMBDA_RUNTIME_NODEJS } from '../consts';
import { TenantManager } from './construct/tenant-manager';
import { Auth } from './construct/auth';
import {
  RestApi,
  LambdaIntegration,
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
} from 'aws-cdk-lib/aws-apigateway';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

export interface MultiTenantStackProps extends StackProps {
  readonly selfSignUpEnabled: boolean;
  readonly allowedIpV4AddressRanges?: string[] | null;
  readonly allowedIpV6AddressRanges?: string[] | null;
  readonly allowedSignUpEmailDomains?: string[] | null;
  readonly samlAuthEnabled: boolean;
  readonly bedrockModelArns?: string[];
}

export class MultiTenantStack extends Stack {
  constructor(scope: Construct, id: string, props: MultiTenantStackProps) {
    super(scope, id, props);

    // Add stack-level tags
    Tags.of(this).add('MultiTenant', 'true');
    Tags.of(this).add('IsolationStrategy', 'IAM-Role-Per-Tenant');

    // Create authentication with tenant support
    const auth = new Auth(this, 'Auth', {
      selfSignUpEnabled: props.selfSignUpEnabled,
      allowedIpV4AddressRanges: props.allowedIpV4AddressRanges,
      allowedIpV6AddressRanges: props.allowedIpV6AddressRanges,
      allowedSignUpEmailDomains: props.allowedSignUpEmailDomains,
      samlAuthEnabled: props.samlAuthEnabled,
    });

    // Create DynamoDB table with tenant-aware partition key
    const table = new Table(this, 'MultiTenantTable', {
      tableName: `${this.stackName}-tenant-data`,
      partitionKey: {
        name: 'tenantId#id',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'createdDate',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
    });

    // Add GSI for tenant queries
    table.addGlobalSecondaryIndex({
      indexName: 'TenantIndex',
      partitionKey: {
        name: 'tenantId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'updatedDate',
        type: AttributeType.STRING,
      },
    });

    // Create S3 bucket with tenant isolation
    const bucket = new Bucket(this, 'MultiTenantBucket', {
      bucketName: `${this.stackName}-tenant-files`,
      encryption: BucketEncryption.S3_MANAGED,
      versioned: true,
      lifecycleRules: [
        {
          id: 'delete-old-versions',
          noncurrentVersionExpiration: Duration.days(30),
        },
      ],
    });

    // Create a Lambda execution role that can assume tenant roles
    const lambdaExecutionRole = new NodejsFunction(
      this,
      'LambdaExecutionFunction',
      {
        runtime: LAMBDA_RUNTIME_NODEJS,
        entry: './lambda/utils/lambdaExecution.ts',
        timeout: Duration.seconds(30),
      }
    ).role!;

    // Grant permission to assume tenant roles
    lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/tenant-*`],
        conditions: {
          StringEquals: {
            'sts:ExternalId': '${aws:username}',
          },
        },
      })
    );

    // Create tenant manager
    const tenantManager = new TenantManager(this, 'TenantManager', {
      table,
      bucket,
      bedrockModelArns: props.bedrockModelArns,
      lambdaExecutionRoleArn: lambdaExecutionRole.roleArn,
    });

    // Create example Lambda function with tenant awareness
    const predictFunction = new NodejsFunction(this, 'PredictWithTenantFunction', {
      runtime: LAMBDA_RUNTIME_NODEJS,
      entry: './lambda/predictWithTenant.ts',
      timeout: Duration.minutes(5),
      environment: {
        TABLE_NAME: table.tableName,
        BUCKET_NAME: bucket.bucketName,
        AWS_ACCOUNT_ID: this.account,
      },
      role: lambdaExecutionRole,
    });

    // Grant basic permissions to Lambda execution role
    table.grantReadWriteData(lambdaExecutionRole);
    bucket.grantReadWrite(lambdaExecutionRole);

    // Create API Gateway
    const api = new RestApi(this, 'MultiTenantApi', {
      restApiName: `${this.stackName}-api`,
      description: 'Multi-tenant API with per-tenant IAM isolation',
    });

    // Create Cognito authorizer
    const authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [auth.userPool],
    });

    // Add predict endpoint
    const predictResource = api.root.addResource('predict');
    predictResource.addMethod('POST', new LambdaIntegration(predictFunction), {
      authorizationType: AuthorizationType.COGNITO,
      authorizer,
    });

    // Example: Create tenant roles for specific tenants (in production, this would be dynamic)
    const exampleTenants = ['tenant-001', 'tenant-002'];
    exampleTenants.forEach((tenantId) => {
      tenantManager.createTenantRole(tenantId);
    });

    // Output important values
    this.exportValue(auth.userPool.userPoolId, {
      name: `${this.stackName}-UserPoolId`,
    });

    this.exportValue(auth.client.userPoolClientId, {
      name: `${this.stackName}-UserPoolClientId`,
    });

    this.exportValue(auth.idPool.identityPoolId, {
      name: `${this.stackName}-IdentityPoolId`,
    });

    this.exportValue(api.url, {
      name: `${this.stackName}-ApiUrl`,
    });

    this.exportValue(table.tableName, {
      name: `${this.stackName}-TableName`,
    });

    this.exportValue(bucket.bucketName, {
      name: `${this.stackName}-BucketName`,
    });
  }
}