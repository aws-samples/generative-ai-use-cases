import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CfnTemplate,
  findDestructiveChanges,
} from '../scripts/destructive-guard/compare';
import {
  parseSnapshotFile,
  SnapshotFormatError,
} from '../scripts/destructive-guard/snapshot';

const table = (keyName: string) => ({
  Type: 'AWS::DynamoDB::Table',
  Properties: {
    KeySchema: [{ AttributeName: keyName, KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: keyName, AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
});

const fn = (memorySize: number) => ({
  Type: 'AWS::Lambda::Function',
  Properties: { MemorySize: memorySize, Runtime: 'nodejs22.x' },
});

const stacks = (
  entries: Record<string, CfnTemplate>
): Map<string, CfnTemplate> => new Map(Object.entries(entries));

describe('findDestructiveChanges', () => {
  test('identical templates have no findings', () => {
    const t = { Resources: { Table: table('id'), Fn: fn(128) } };
    expect(
      findDestructiveChanges({ base: stacks({ S: t }), head: stacks({ S: t }) })
    ).toEqual([]);
  });

  test('changing a table key replaces the table', () => {
    const findings = findDestructiveChanges({
      base: stacks({ S: { Resources: { Table: table('id') } } }),
      head: stacks({ S: { Resources: { Table: table('pk') } } }),
    });
    expect(findings).toEqual([
      {
        stack: 'S',
        logicalId: 'Table',
        resourceType: 'AWS::DynamoDB::Table',
        impact: 'WILL_REPLACE',
      },
    ]);
  });

  test('removing a bucket is destructive', () => {
    const findings = findDestructiveChanges({
      base: stacks({
        S: { Resources: { Bucket: { Type: 'AWS::S3::Bucket' }, Fn: fn(128) } },
      }),
      head: stacks({ S: { Resources: { Fn: fn(128) } } }),
    });
    expect(findings.map((f) => [f.logicalId, f.impact])).toEqual([
      ['Bucket', 'WILL_DESTROY'],
    ]);
  });

  test('removing a bucket that is retained is reported as orphaned', () => {
    const findings = findDestructiveChanges({
      base: stacks({
        S: {
          Resources: {
            Bucket: { Type: 'AWS::S3::Bucket', DeletionPolicy: 'Retain' },
          },
        },
      }),
      head: stacks({ S: { Resources: {} } }),
    });
    expect(findings.map((f) => f.impact)).toEqual(['WILL_ORPHAN']);
  });

  test('changes to stateless resources are ignored', () => {
    expect(
      findDestructiveChanges({
        base: stacks({ S: { Resources: { Fn: fn(128) } } }),
        head: stacks({ S: { Resources: {} } }),
      })
    ).toEqual([]);
  });

  test('a removed stack reports its stateful resources', () => {
    const findings = findDestructiveChanges({
      base: stacks({
        Gone: { Resources: { Table: table('id'), Fn: fn(128) } },
      }),
      head: stacks({}),
    });
    expect(findings).toEqual([
      {
        stack: 'Gone',
        logicalId: 'Table',
        resourceType: 'AWS::DynamoDB::Table',
        impact: 'STACK_REMOVED',
      },
    ]);
  });

  test('an added stack is not destructive', () => {
    expect(
      findDestructiveChanges({
        base: stacks({}),
        head: stacks({ New: { Resources: { Table: table('id') } } }),
      })
    ).toEqual([]);
  });

  test('removing a log group is not reported', () => {
    expect(
      findDestructiveChanges({
        base: stacks({
          S: { Resources: { Logs: { Type: 'AWS::Logs::LogGroup' } } },
        }),
        head: stacks({ S: { Resources: {} } }),
      })
    ).toEqual([]);
  });
});

describe('parseSnapshotFile', () => {
  // Written the way Jest writes a .snap file with escapeString enabled:
  // escaped quotes, raw newlines inside strings, trailing commas, and
  // backticks and `${` escaped for the template literal.
  const snap = [
    '// Jest Snapshot v1, https://goo.gl/fbAQLP',
    '',
    'exports[`Stacks: A 1`] = `',
    '{',
    '  "Resources": {',
    '    "Table": {',
    '      "Properties": {',
    '        "Policy": "[{\\\\"Rules\\\\":[],}]",',
    '        "Script": "line1',
    'line2 \\`x\\` \\${y}",',
    '      },',
    '      "Type": "AWS::DynamoDB::Table",',
    '    },',
    '  },',
    '}',
    '`;',
    '',
    'exports[`Stacks: B 1`] = `',
    '{',
    '  "Resources": {},',
    '}',
    '`;',
    '',
  ].join('\n');

  test('reads every snapshot back as a template', () => {
    const templates = parseSnapshotFile(snap);
    expect([...templates.keys()]).toEqual(['Stacks: A 1', 'Stacks: B 1']);
    expect(templates.get('Stacks: A 1')).toEqual({
      Resources: {
        Table: {
          Properties: {
            Policy: '[{"Rules":[],}]',
            Script: 'line1\nline2 `x` ${y}',
          },
          Type: 'AWS::DynamoDB::Table',
        },
      },
    });
  });

  test('rejects a snapshot printed without escaping', () => {
    const unescaped = snap.replace(/\\\\"/g, '"');
    expect(() => parseSnapshotFile(unescaped)).toThrow(SnapshotFormatError);
  });

  test('reads the CDK snapshot of this repository', () => {
    const templates = parseSnapshotFile(
      readFileSync(
        join(__dirname, '__snapshots__/generative-ai-use-cases.test.ts.snap'),
        'utf8'
      )
    );
    expect(templates.size).toBeGreaterThan(0);
    const main = templates.get(
      'GenerativeAiUseCases matches the snapshot 6'
    );
    expect(main?.Resources).toBeDefined();
    // Comparing a snapshot with itself finds nothing.
    expect(
      findDestructiveChanges({ base: templates, head: templates })
    ).toEqual([]);
  });
});
