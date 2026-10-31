// Usage: ts-node scripts/destructive-guard/cli.ts <base cdk.out> <head cdk.out>
//
// Exits 1 when the head would replace, delete or orphan a stateful resource
// that exists in the base. Writes a Markdown report to $GITHUB_STEP_SUMMARY
// when it is set.
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CfnTemplate, findDestructiveChanges, Finding } from './compare';

const SUFFIX = '.template.json';

const readTemplates = (dir: string): Map<string, CfnTemplate> =>
  new Map(
    readdirSync(dir)
      .filter((f) => f.endsWith(SUFFIX))
      .map((f) => [
        f.slice(0, -SUFFIX.length),
        JSON.parse(readFileSync(join(dir, f), 'utf8')) as CfnTemplate,
      ])
  );

const report = (findings: Finding[]): string => {
  if (findings.length === 0) {
    return '### CDK destructive-change guard\n\nNo stateful resource is replaced, deleted or orphaned.\n';
  }
  const rows = findings.map(
    (f) => `| ${f.stack} | ${f.logicalId} | ${f.resourceType} | ${f.impact} |`
  );
  return [
    '### CDK destructive-change guard',
    '',
    'This change replaces, deletes or orphans stateful resources. Existing deployments would lose data. Describe the migration steps in the PR, and a maintainer adds the `cdk-destructive-ok` label once they are reviewed.',
    '',
    '| Stack | Logical ID | Type | Impact |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
};

const main = (): number => {
  const [baseDir, headDir] = process.argv.slice(2);
  if (!baseDir || !headDir) {
    console.error('usage: cli.ts <base cdk.out> <head cdk.out>');
    return 2;
  }
  const findings = findDestructiveChanges({
    base: readTemplates(baseDir),
    head: readTemplates(headDir),
  });
  const markdown = report(findings);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
  return findings.length > 0 ? 1 : 0;
};

process.exit(main());
