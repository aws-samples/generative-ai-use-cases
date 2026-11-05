import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CfnTemplate,
  findDestructiveChanges,
  parseSnapshotFile,
} from '../scripts/destructive-guard';

const table = (keyName: string) => ({
  Type: 'AWS::DynamoDB::Table',
  Properties: {
    KeySchema: [{ AttributeName: keyName, KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: keyName, AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
});

const diff = (base: CfnTemplate, head: CfnTemplate) =>
  findDestructiveChanges({
    base: new Map([['S', base]]),
    head: new Map([['S', head]]),
  }).map((f) => [f.logicalId, f.impact]);

describe('findDestructiveChanges', () => {
  test('changing a table key replaces the table', () => {
    expect(
      diff(
        { Resources: { Table: table('id') } },
        { Resources: { Table: table('pk') } }
      )
    ).toEqual([['Table', 'WILL_REPLACE']]);
  });

  test('removing a bucket destroys it, or orphans it when retained', () => {
    expect(
      diff({ Resources: { B: { Type: 'AWS::S3::Bucket' } } }, { Resources: {} })
    ).toEqual([['B', 'WILL_DESTROY']]);
    expect(
      diff(
        {
          Resources: {
            B: { Type: 'AWS::S3::Bucket', DeletionPolicy: 'Retain' },
          },
        },
        { Resources: {} }
      )
    ).toEqual([['B', 'WILL_ORPHAN']]);
  });

  test('changes to stateless resources are ignored', () => {
    expect(
      diff(
        { Resources: { Fn: { Type: 'AWS::Lambda::Function' } } },
        { Resources: {} }
      )
    ).toEqual([]);
  });
});

describe('parseSnapshotFile', () => {
  test('reads escaped strings, raw newlines and trailing commas', () => {
    const snap = [
      'exports[`A 1`] = `',
      '{',
      '  "Policy": "[{\\\\"Rules\\\\":[],}]",',
      '  "Script": "line1',
      'line2 \\`x\\` \\${y}",',
      '}',
      '`;',
      '',
    ].join('\n');
    expect(parseSnapshotFile(snap).get('A 1')).toEqual({
      Policy: '[{"Rules":[],}]',
      Script: 'line1\nline2 `x` ${y}',
    });
  });

  test('reads the CDK snapshot of this repository', () => {
    const templates = parseSnapshotFile(
      readFileSync(
        join(__dirname, '__snapshots__/generative-ai-use-cases.test.ts.snap'),
        'utf8'
      )
    );
    expect(templates.size).toBeGreaterThan(0);
    expect(
      findDestructiveChanges({ base: templates, head: templates })
    ).toEqual([]);
  });
});
