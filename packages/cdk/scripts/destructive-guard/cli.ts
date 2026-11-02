// Usage: ts-node scripts/destructive-guard/cli.ts <base out> <head out> <result dir>
//
// <base out> and <head out> hold one cdk.out directory per profile, as written
// by synth.ts. Writes findings.json and report.md into <result dir>. Exits 1
// when the head would replace, delete or orphan a stateful resource that
// exists in the base, and 2 when a profile is missing from either side.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { CfnTemplate, findDestructiveChanges, Finding } from './compare';
import { PROFILES } from './profiles';

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

type ProfileFinding = Finding & { profile: string };

const report = (findings: ProfileFinding[]): string => {
  if (findings.length === 0) {
    return '### CDK destructive-change guard\n\nNo stateful resource is replaced, deleted or orphaned.\n';
  }
  const rows = findings.map(
    (f) =>
      `| ${f.profile} | ${f.stack} | ${f.logicalId} | ${f.resourceType} | ${f.impact} |`
  );
  return [
    '### CDK destructive-change guard',
    '',
    'This change replaces, deletes or orphans stateful resources. Existing deployments would lose data. Describe the impact and the migration steps in the pull request; a maintainer decides whether to accept it.',
    '',
    '| Profile | Stack | Logical ID | Type | Impact |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
};

const main = (): number => {
  const [baseRoot, headRoot, resultDir] = process.argv.slice(2);
  if (!baseRoot || !headRoot || !resultDir) {
    console.error('usage: cli.ts <base out> <head out> <result dir>');
    return 2;
  }
  const findings: ProfileFinding[] = [];
  for (const profile of Object.keys(PROFILES)) {
    const baseDir = join(baseRoot, profile);
    const headDir = join(headRoot, profile);
    if (!existsSync(baseDir) || !existsSync(headDir)) {
      console.error(`profile ${profile} was not synthesized on both sides`);
      return 2;
    }
    findings.push(
      ...findDestructiveChanges({
        base: readTemplates(baseDir),
        head: readTemplates(headDir),
      }).map((f) => ({ ...f, profile }))
    );
  }
  const markdown = report(findings);
  mkdirSync(resultDir, { recursive: true });
  writeFileSync(join(resultDir, 'findings.json'), JSON.stringify(findings));
  writeFileSync(join(resultDir, 'report.md'), markdown);
  console.log(markdown);
  return findings.length > 0 ? 1 : 0;
};

process.exit(main());
