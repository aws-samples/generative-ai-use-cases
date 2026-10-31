// Compares the CloudFormation templates synthesized from the base and head of
// a pull request and reports changes that would replace, delete or orphan a
// stateful resource. Such a change loses data in existing deployments.
import { fullDiff, ResourceImpact } from '@aws-cdk/cloudformation-diff';

export const STATEFUL_RESOURCE_TYPES: ReadonlySet<string> = new Set([
  'AWS::DynamoDB::Table',
  'AWS::DynamoDB::GlobalTable',
  'AWS::S3::Bucket',
  'AWS::S3Vectors::VectorBucket',
  'AWS::S3Vectors::Index',
  'AWS::Cognito::UserPool',
  'AWS::Cognito::IdentityPool',
  'AWS::KMS::Key',
  'AWS::Kendra::Index',
  'AWS::Bedrock::KnowledgeBase',
  'AWS::Bedrock::DataSource',
  'AWS::OpenSearchServerless::Collection',
  'AWS::SecretsManager::Secret',
  'AWS::Logs::LogGroup',
  'AWS::EC2::VPC',
]);

const DESTRUCTIVE_IMPACTS: ReadonlySet<ResourceImpact> = new Set([
  ResourceImpact.WILL_REPLACE,
  ResourceImpact.MAY_REPLACE,
  ResourceImpact.WILL_DESTROY,
  ResourceImpact.WILL_ORPHAN,
]);

export type CfnTemplate = {
  Resources?: Record<string, { Type?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

export type Finding = {
  stack: string;
  logicalId: string;
  resourceType: string;
  impact: string;
};

const statefulResources = (stack: string, template: CfnTemplate): Finding[] =>
  Object.entries(template.Resources ?? {})
    .filter(([, r]) => r.Type && STATEFUL_RESOURCE_TYPES.has(r.Type))
    .map(([logicalId, r]) => ({
      stack,
      logicalId,
      resourceType: r.Type as string,
      impact: 'STACK_REMOVED',
    }));

/** Returns the destructive changes to stateful resources, keyed by stack name. */
export const findDestructiveChanges = (props: {
  base: ReadonlyMap<string, CfnTemplate>;
  head: ReadonlyMap<string, CfnTemplate>;
}): Finding[] => {
  const findings: Finding[] = [];
  for (const [stack, baseTemplate] of props.base) {
    const headTemplate = props.head.get(stack);
    if (!headTemplate) {
      findings.push(...statefulResources(stack, baseTemplate));
      continue;
    }
    fullDiff(baseTemplate, headTemplate).resources.forEachDifference(
      (logicalId, change) => {
        const resourceType = change.oldResourceType ?? change.newResourceType;
        if (
          resourceType &&
          STATEFUL_RESOURCE_TYPES.has(resourceType) &&
          DESTRUCTIVE_IMPACTS.has(change.changeImpact)
        ) {
          findings.push({
            stack,
            logicalId,
            resourceType,
            impact: change.changeImpact,
          });
        }
      }
    );
  }
  return findings;
};
