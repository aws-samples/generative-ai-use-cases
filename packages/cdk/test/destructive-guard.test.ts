import {
  CfnTemplate,
  findDestructiveChanges,
} from '../scripts/destructive-guard/compare';

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
});
