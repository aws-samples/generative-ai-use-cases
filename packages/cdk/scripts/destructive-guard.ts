// Usage: ts-node scripts/destructive-guard.ts <base .snap> <head .snap>
//
// Compares the CDK snapshot of a pull request with the one on its base and
// exits 1 when a stateful resource (DynamoDB, S3, Cognito, KMS, ...) would be
// replaced, deleted or orphaned, because that change loses data in existing
// deployments. The snapshot test fails when the snapshot is out of date, so the
// snapshot stands in for the synthesized templates.
import { fullDiff, ResourceImpact } from '@aws-cdk/cloudformation-diff';
import { appendFileSync, readFileSync } from 'node:fs';

export const STATEFUL_RESOURCE_TYPES: ReadonlySet<string> = new Set([
  'AWS::DynamoDB::Table',
  'AWS::DynamoDB::GlobalTable',
  'AWS::S3::Bucket',
  'AWS::S3Vectors::VectorBucket',
  'AWS::S3Vectors::Index',
  'AWS::Cognito::UserPool',
  'AWS::Cognito::IdentityPool',
  'AWS::KMS::Key',
  'AWS::Bedrock::KnowledgeBase',
  'AWS::Bedrock::DataSource',
  'AWS::OpenSearchServerless::Collection',
  'AWS::SecretsManager::Secret',
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
  snapshot: string;
  logicalId: string;
  resourceType: string;
  impact: string;
};

const ENTRY = /^exports\[`((?:[^`\\]|\\.)*)`\] = `((?:[^`\\]|\\.)*)`;$/gms;
const CONTROL_ESCAPES: Readonly<Record<string, string>> = {
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

// Jest escapes backslashes, backticks and `${` inside the template literal.
const unescapeTemplateLiteral = (value: string): string =>
  value.replace(/\\(\\|`|\$(?=\{))/g, '$1');

// pretty-format with escapeString differs from JSON only in trailing commas and
// raw control characters inside strings.
const prettyFormatToJson = (value: string): string => {
  let out = '';
  let inString = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (inString) {
      if (c === '\\') {
        out += c + value[++i];
      } else {
        if (c === '"') inString = false;
        out += CONTROL_ESCAPES[c] ?? c;
      }
      continue;
    }
    if (c === '"') inString = true;
    if (c === ',' && /^\s*[}\]]/.test(value.slice(i + 1, i + 200))) continue;
    out += c;
  }
  return out;
};

/** Returns the templates in a Jest snapshot file, keyed by snapshot name. */
export const parseSnapshotFile = (content: string): Map<string, CfnTemplate> =>
  new Map(
    [...content.matchAll(ENTRY)].map(([, key, value]) => [
      unescapeTemplateLiteral(key),
      JSON.parse(
        prettyFormatToJson(unescapeTemplateLiteral(value))
      ) as CfnTemplate,
    ])
  );

/** Returns the destructive changes to stateful resources. */
export const findDestructiveChanges = (props: {
  base: ReadonlyMap<string, CfnTemplate>;
  head: ReadonlyMap<string, CfnTemplate>;
}): Finding[] => {
  const findings: Finding[] = [];
  for (const [snapshot, baseTemplate] of props.base) {
    const headTemplate = props.head.get(snapshot) ?? { Resources: {} };
    fullDiff(baseTemplate, headTemplate).resources.forEachDifference(
      (logicalId, change) => {
        const resourceType = change.oldResourceType ?? change.newResourceType;
        if (
          resourceType &&
          STATEFUL_RESOURCE_TYPES.has(resourceType) &&
          DESTRUCTIVE_IMPACTS.has(change.changeImpact)
        ) {
          findings.push({
            snapshot,
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

const report = (findings: Finding[]): string =>
  findings.length === 0
    ? '### CDK destructive-change guard\n\nNo stateful resource is replaced, deleted or orphaned.\n'
    : [
        '### CDK destructive-change guard',
        '',
        'This change replaces, deletes or orphans stateful resources, so existing deployments would lose data. Describe the impact and the migration steps in the pull request; a maintainer decides whether to accept it.',
        '',
        '| Snapshot | Logical ID | Type | Impact |',
        '| --- | --- | --- | --- |',
        ...findings.map(
          (f) =>
            `| ${f.snapshot} | ${f.logicalId} | ${f.resourceType} | ${f.impact} |`
        ),
        '',
      ].join('\n');

if (require.main === module) {
  const [basePath, headPath] = process.argv.slice(2);
  if (!basePath || !headPath) {
    console.error('usage: destructive-guard.ts <base .snap> <head .snap>');
    process.exit(2);
  }
  const findings = findDestructiveChanges({
    base: parseSnapshotFile(readFileSync(basePath, 'utf8')),
    head: parseSnapshotFile(readFileSync(headPath, 'utf8')),
  });
  const markdown = report(findings);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
  process.exit(findings.length > 0 ? 1 : 0);
}
