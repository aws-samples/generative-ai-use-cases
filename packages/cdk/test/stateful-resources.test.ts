import * as cdk from 'aws-cdk-lib';
import {
  BUNDLING_STACKS,
  DISABLE_ASSET_STAGING_CONTEXT,
} from 'aws-cdk-lib/cx-api';
import { processedStackInputSchema } from '../lib/stack-input';
import { createStacks } from '../lib/create-stacks';
import { stackInput } from './stack-input.fixture';

// Resources that hold user data, each with the properties whose change makes
// CloudFormation replace the resource (create a new one, delete the old one
// and its data). Sources: "Update requires: Replacement" in the CloudFormation
// resource reference, plus DynamoDB KeySchema, which cannot change in place.
const REPLACEMENT_PROPERTIES: Record<string, string[]> = {
  'AWS::DynamoDB::Table': [
    'TableName',
    'KeySchema',
    'ImportSourceSpecification',
  ],
  'AWS::DynamoDB::GlobalTable': ['TableName', 'KeySchema'],
  'AWS::S3::Bucket': ['BucketName'],
  'AWS::Cognito::UserPool': [],
  'AWS::Cognito::IdentityPool': [],
  'AWS::KMS::Key': [],
  'AWS::OpenSearchServerless::Collection': [
    'Name',
    'Type',
    'StandbyReplicas',
    'EncryptionConfig',
    'CollectionGroupName',
    'Tags',
  ],
  'AWS::Bedrock::KnowledgeBase': ['StorageConfiguration'],
  'AWS::S3Vectors::VectorBucket': [
    'VectorBucketName',
    'EncryptionConfiguration',
  ],
  'AWS::S3Vectors::Index': [
    'VectorBucketName',
    'VectorBucketArn',
    'IndexName',
    'DataType',
    'Dimension',
    'DistanceMetric',
    'EncryptionConfiguration',
    'MetadataConfiguration',
  ],
  'AWS::BedrockAgentCore::Memory': [],
};

type Resource = {
  Type: string;
  DeletionPolicy?: string;
  UpdateReplacePolicy?: string;
  Properties?: Record<string, unknown>;
};

const statefulResources = (input: Partial<typeof stackInput>) => {
  const app = new cdk.App({
    context: {
      [BUNDLING_STACKS]: [],
      [DISABLE_ASSET_STAGING_CONTEXT]: true,
    },
  });
  createStacks(app, processedStackInputSchema.parse(input));
  const result: Record<string, unknown> = {};
  for (const stack of app.synth().stacks) {
    const resources: Record<string, Resource> = stack.template.Resources ?? {};
    for (const [id, r] of Object.entries(resources)) {
      const replacementProps = REPLACEMENT_PROPERTIES[r.Type];
      if (!replacementProps) continue;
      result[`${stack.stackName}/${id}`] = {
        Type: r.Type,
        DeletionPolicy: r.DeletionPolicy ?? null,
        UpdateReplacePolicy: r.UpdateReplacePolicy ?? null,
        // null for an unset property, so that setting it later changes a
        // line instead of only adding one.
        ...Object.fromEntries(
          replacementProps.map((p) => [p, r.Properties?.[p] ?? null])
        ),
      };
    }
  }
  return result;
};

// The snapshot lists every data-holding resource with its logical ID,
// deletion policy and replacement-triggering properties. The "Stateful
// resource check" workflow fails a pull request that removes or changes a
// line of it, because updating an existing deployment would then delete or
// replace that resource. Adding resources is fine.
describe('stateful resources', () => {
  test('default', () => {
    expect(statefulResources(stackInput)).toMatchSnapshot();
  });

  test('closed network mode', () => {
    expect(
      statefulResources({
        ...stackInput,
        closedNetworkMode: true,
        closedNetworkApiGatewayVpcEndpointIds: ['vpce-0123456789abcdef0'],
      })
    ).toMatchSnapshot();
  });

  test('S3 Vectors knowledge base', () => {
    expect(
      statefulResources({
        ...stackInput,
        ragKnowledgeBaseStorageType: 's3vectors',
      })
    ).toMatchSnapshot();
  });
});
