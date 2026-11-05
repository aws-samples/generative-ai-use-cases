// Usage: ts-node scripts/destructive-guard/cli.ts <base .snap> <head .snap> <result dir>
//
// Compares the CDK snapshot of a pull request with the one on its base and
// writes findings.json and report.md into <result dir>. Exits 1 when the head
// would replace, delete or orphan a stateful resource that exists in the base,
// and 2 when a snapshot file cannot be read. A base snapshot in the format
// used before the snapshot serializer escaped strings is skipped with exit 0.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findDestructiveChanges, Finding } from './compare';
import { parseSnapshotFile, SnapshotFormatError } from './snapshot';

const TITLE = '### CDK destructive-change guard';

const report = (findings: Finding[]): string => {
  if (findings.length === 0) {
    return `${TITLE}\n\nNo stateful resource is replaced, deleted or orphaned.\n`;
  }
  const rows = findings.map(
    (f) => `| ${f.stack} | ${f.logicalId} | ${f.resourceType} | ${f.impact} |`
  );
  return [
    TITLE,
    '',
    'This change replaces, deletes or orphans stateful resources. Existing deployments would lose data. Describe the impact and the migration steps in the pull request; a maintainer decides whether to accept it.',
    '',
    '| Snapshot | Logical ID | Type | Impact |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
};

const write = (resultDir: string, findings: Finding[], markdown: string) => {
  mkdirSync(resultDir, { recursive: true });
  writeFileSync(join(resultDir, 'findings.json'), JSON.stringify(findings));
  writeFileSync(join(resultDir, 'report.md'), markdown);
  console.log(markdown);
};

const main = (): number => {
  const [basePath, headPath, resultDir] = process.argv.slice(2);
  if (!basePath || !headPath || !resultDir) {
    console.error('usage: cli.ts <base .snap> <head .snap> <result dir>');
    return 2;
  }

  let base;
  try {
    base = parseSnapshotFile(readFileSync(basePath, 'utf8'));
  } catch (e) {
    if (!(e instanceof SnapshotFormatError)) throw e;
    write(
      resultDir,
      [],
      `${TITLE}\n\nSkipped: the base snapshot predates the escaped snapshot format (${e.message}).\n`
    );
    return 0;
  }

  let head;
  try {
    head = parseSnapshotFile(readFileSync(headPath, 'utf8'));
  } catch (e) {
    if (!(e instanceof SnapshotFormatError)) throw e;
    console.error(`head snapshot cannot be read: ${e.message}`);
    return 2;
  }
  if (base.size === 0 || head.size === 0) {
    console.error('a snapshot file has no entries');
    return 2;
  }
  // Snapshots are paired by name. Names are positional ("... 1", "... 2"), so
  // reordering the assertions in the test pairs different stacks; that shows
  // up as findings rather than being missed. With no name in common there is
  // nothing to pair up.
  if (![...base.keys()].some((key) => head.has(key))) {
    write(
      resultDir,
      [],
      `${TITLE}\n\nSkipped: no snapshot name is shared with the base, so the snapshots cannot be paired.\n`
    );
    return 0;
  }

  const findings = findDestructiveChanges({ base, head });
  write(resultDir, findings, report(findings));
  return findings.length > 0 ? 1 : 0;
};

process.exit(main());
