import {
  BucketObject,
  PlanInput,
  TableItem,
  destinationKey,
  planMigration,
} from '../../scripts/migrate-user-files/plan';
import { parseArgs } from '../../scripts/migrate-user-files/args';
import {
  backupEntry,
  restoreInput,
} from '../../scripts/migrate-user-files/backup';
import { canAccessFile, fileBucketKey } from '@generative-ai-use-cases/common';

const FILE = 'file-bucket';
const AGENT = 'agentcore-bucket';
const url = (key: string, bucket = FILE, region = 'us-west-2') =>
  `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

const SUBS = new Map([
  ['alice', 'sub-a'],
  ['bob', 'sub-b'],
  ['EntraID_carol#EXT#', 'sub-c'],
]);

const message = (params: {
  owner: string;
  createdDate?: string;
  attach?: string[];
  content?: string;
}): TableItem => ({
  id: 'chat#c1',
  createdDate: params.createdDate ?? '1',
  messageId: 'm',
  userId: `user#${params.owner}`,
  content: params.content ?? '',
  extraData: (params.attach ?? []).map((data) => ({
    type: 'image',
    name: 'x.png',
    source: { type: 's3', mediaType: 'image/png', data },
  })),
});

const plan = (
  items: TableItem[],
  objects: Record<string, (string | BucketObject)[]>,
  extra: Partial<PlanInput> = {}
) =>
  planMigration({
    fileBucket: FILE,
    fileBucketRegion: 'us-west-2',
    agentCoreBucket: AGENT,
    items,
    objects: new Map(
      Object.entries(objects).map(([bucket, list]) => [
        bucket,
        list.map((o) => (typeof o === 'string' ? { key: o, size: 10 } : o)),
      ])
    ),
    subByUserName: SUBS,
    ...extra,
  });

describe('destinationKey', () => {
  test.each([
    [FILE, 'u1/a.png', 'attachment', 'users/sub-a/attachments/u1/a.png'],
    [
      FILE,
      'u1/chart.png',
      'agentOutput',
      'users/sub-a/agent-outputs/u1/chart.png',
    ],
    [FILE, 'j1/output.mp4', 'video', 'users/sub-a/videos/j1/output.mp4'],
    [
      FILE,
      'mcp/s1/out.csv',
      'agentOutput',
      'users/sub-a/agent-outputs/s1/out.csv',
    ],
    [
      AGENT,
      'agentcore/t1/out.csv',
      'agentOutput',
      'users/sub-a/agent-outputs/t1/out.csv',
    ],
  ] as const)('%s %s (%s) -> %s', (bucket, key, kind, expected) => {
    expect(
      destinationKey({
        sub: 'sub-a',
        sourceBucket: bucket,
        sourceKey: key,
        fileBucket: FILE,
        kind,
      })
    ).toBe(expected);
  });
});

describe('planMigration', () => {
  test('moves an attachment to its chat owner and rewrites the message', () => {
    const p = plan([message({ owner: 'alice', attach: [url('u1/a.png')] })], {
      [FILE]: ['u1/a.png'],
    });
    expect(p.copies).toEqual([
      {
        sourceBucket: FILE,
        sourceKey: 'u1/a.png',
        destinationKey: 'users/sub-a/attachments/u1/a.png',
        size: 10,
      },
    ]);
    expect(p.updates).toHaveLength(1);
    const update = p.updates[0];
    if (update.kind !== 'message') throw new Error('expected a message');
    const data = (update.set.extraData![0] as { source: { data: string } })
      .source.data;
    expect(data).toBe(url('users/sub-a/attachments/u1/a.png'));
    expect(update.requires).toEqual(['users/sub-a/attachments/u1/a.png']);
    expect(p.alerts).toEqual([]);
    // The new key is the owner's under the access rule of this release
    expect(
      canAccessFile({ caller: 'sub-a', key: fileBucketKey(data, FILE)! })
    ).toBe(true);
    expect(
      canAccessFile({ caller: 'sub-b', key: fileBucketKey(data, FILE)! })
    ).toBe(false);
  });

  test('rewrites links in the text, keeping a fragment, and AgentCore outputs', () => {
    const content = [
      `![chart](${url('u2/chart%201.png')})`,
      `[doc](${url('agentcore/t1/out.csv', AGENT, 'us-east-1')}#p=2)`,
      `[kb](${url('docs/a.pdf', 'kb-bucket')})`,
    ].join('\n');
    const p = plan([message({ owner: 'alice', content })], {
      [FILE]: ['u2/chart 1.png'],
      [AGENT]: ['agentcore/t1/out.csv'],
    });
    const update = p.updates[0];
    if (update.kind !== 'message') throw new Error('expected a message');
    expect(update.set.content).toBe(
      [
        `![chart](${url('users/sub-a/agent-outputs/u2/chart%201.png')})`,
        `[doc](${url('users/sub-a/agent-outputs/t1/out.csv')}#p=2)`,
        // A Knowledge Base citation is not a user file and is left as it is
        `[kb](${url('docs/a.pdf', 'kb-bucket')})`,
      ].join('\n')
    );
    expect(update.condition).toEqual({ content });
    expect(update.before).toEqual({ content });
    expect(p.copies.map((c) => c.sourceBucket).sort()).toEqual([AGENT, FILE]);
  });

  test('leaves URLs outside Markdown links as typed, and reports them', () => {
    const pasted = `{"uri": "s3://${FILE}/u3/sample.mp4"}`;
    const content = [
      pasted,
      `see ${url('u4/plain.png')}`,
      `[ok](<${url('u5/a.png')}>)`,
    ].join('\n');
    const p = plan([message({ owner: 'alice', content })], {
      [FILE]: ['u3/sample.mp4', 'u4/plain.png', 'u5/a.png'],
    });
    const update = p.updates[0];
    if (update.kind !== 'message') throw new Error('expected a message');
    expect(update.set.content).toBe(
      [
        pasted,
        `see ${url('u4/plain.png')}`,
        `[ok](<${url('users/sub-a/agent-outputs/u5/a.png')}>)`,
      ].join('\n')
    );
    expect(p.copies.map((c) => c.sourceKey)).toEqual(['u5/a.png']);
    expect(p.alerts).toEqual([
      {
        reason: 'not-a-link',
        bucket: FILE,
        key: 'u3/sample.mp4',
        item: { id: 'chat#c1', createdDate: '1' },
      },
      {
        reason: 'not-a-link',
        bucket: FILE,
        key: 'u4/plain.png',
        item: { id: 'chat#c1', createdDate: '1' },
      },
    ]);
  });

  test('moves a finished video and rewrites the job output', () => {
    const job = {
      id: 'videoJob#alice',
      createdDate: '1',
      jobId: 'j1',
      status: 'Completed',
      output: `s3://${FILE}/j1/output.mp4`,
    };
    const p = plan([job], { [FILE]: ['j1/output.mp4'] });
    expect(p.updates).toEqual([
      {
        kind: 'videoJob',
        key: { id: 'videoJob#alice', createdDate: '1' },
        set: { output: `s3://${FILE}/users/sub-a/videos/j1/output.mp4` },
        before: { output: job.output },
        condition: { output: job.output },
        requires: ['users/sub-a/videos/j1/output.mp4'],
      },
    ]);
  });

  test('records the owner sub on share links that have none', () => {
    const p = plan(
      [
        {
          id: 'share#s1',
          createdDate: '1',
          userId: 'user#EntraID_carol#EXT#',
          chatId: 'chat#c1',
        },
        {
          id: 'share#s2',
          createdDate: '1',
          userId: 'user#alice',
          chatId: 'chat#c2',
          ownerSub: 'sub-a',
        },
        {
          id: 'share#s3',
          createdDate: '1',
          userId: 'user#gone',
          chatId: 'chat#c3',
        },
      ],
      {}
    );
    expect(p.updates).toEqual([
      {
        kind: 'share',
        key: { id: 'share#s1', createdDate: '1' },
        set: { ownerSub: 'sub-c' },
      },
    ]);
    expect(p.alerts).toEqual([
      {
        reason: 'unknown-user',
        owners: ['gone'],
        item: { id: 'share#s3', createdDate: '1' },
      },
    ]);
  });

  // Files that cannot be tied to one user are reported, not moved
  test.each([
    [
      'a key that chats of two owners attach',
      [
        message({ owner: 'alice', attach: [url('u1/a.png')] }),
        message({ owner: 'bob', createdDate: '2', attach: [url('u1/a.png')] }),
      ],
      { [FILE]: ['u1/a.png'] },
      {
        reason: 'shared-key',
        bucket: FILE,
        key: 'u1/a.png',
        owners: ['alice', 'bob'],
      },
    ],
    [
      'a chat of a user no longer in the user pool',
      [message({ owner: 'gone', attach: [url('u1/a.png')] })],
      { [FILE]: ['u1/a.png'] },
      {
        reason: 'unknown-user',
        bucket: FILE,
        key: 'u1/a.png',
        owners: ['gone'],
      },
    ],
    [
      'a key that is not in the bucket',
      [message({ owner: 'alice', attach: [url('u1/gone.png')] })],
      { [FILE]: [] },
      { reason: 'missing-object', bucket: FILE, key: 'u1/gone.png' },
    ],
    [
      // https:// URLs resolve `..` while parsing; an s3:// URI keeps it
      'a key with a .. segment',
      [
        {
          id: 'videoJob#alice',
          createdDate: '1',
          status: 'Completed',
          output: `s3://${FILE}/j1/../output.mp4`,
        },
      ],
      { [FILE]: ['j1/../output.mp4'] },
      { reason: 'unsafe-key', bucket: FILE, key: 'j1/../output.mp4' },
    ],
    [
      'an object larger than one CopyObject',
      [message({ owner: 'alice', attach: [url('u1/big.mp4')] })],
      { [FILE]: [{ key: 'u1/big.mp4', size: 6 * 1024 ** 3 }] },
      { reason: 'too-large', bucket: FILE, key: 'u1/big.mp4' },
    ],
  ])('%s', (_name, items, objects, alert) => {
    const p = plan(items as TableItem[], objects);
    expect(p.copies).toEqual([]);
    expect(p.updates).toEqual([]);
    expect(p.alerts).toEqual([alert]);
  });

  test('copies a shared key to each owner only when asked', () => {
    const items = [
      message({ owner: 'alice', attach: [url('u1/a.png')] }),
      message({ owner: 'bob', createdDate: '2', attach: [url('u1/a.png')] }),
    ];
    const p = plan(
      items,
      { [FILE]: ['u1/a.png'] },
      { includeSharedKeys: true }
    );
    expect(p.copies.map((c) => c.destinationKey).sort()).toEqual([
      'users/sub-a/attachments/u1/a.png',
      'users/sub-b/attachments/u1/a.png',
    ]);
    expect(p.updates).toHaveLength(2);
  });

  test('reports a video job that has not finished, and leaves it', () => {
    const p = plan(
      [
        {
          id: 'videoJob#alice',
          createdDate: '1',
          status: 'InProgress',
          output: `s3://${FILE}/j1/output.mp4`,
        },
      ],
      { [FILE]: [] }
    );
    expect(p.updates).toEqual([]);
    expect(p.alerts).toEqual([
      {
        reason: 'video-in-progress',
        key: 'j1/output.mp4',
        item: { id: 'videoJob#alice', createdDate: '1' },
      },
    ]);
  });

  test('reports objects no record points at, and ignores migrated keys', () => {
    const p = plan(
      [
        message({
          owner: 'alice',
          attach: [url('users/sub-a/attachments/u9/new.png')],
        }),
      ],
      { [FILE]: ['u5/audio.webm'] }
    );
    expect(p.updates).toEqual([]);
    expect(p.alerts).toEqual([
      { reason: 'unreferenced', bucket: FILE, key: 'u5/audio.webm' },
    ]);
  });

  test('a second run after the rewrite plans nothing', () => {
    const first = plan(
      [message({ owner: 'alice', attach: [url('u1/a.png')] })],
      {
        [FILE]: ['u1/a.png'],
      }
    );
    const update = first.updates[0];
    if (update.kind !== 'message') throw new Error('expected a message');
    const migrated = {
      ...message({ owner: 'alice' }),
      extraData: update.set.extraData,
    };
    const second = plan([migrated], { [FILE]: ['u1/a.png'] });
    expect(second.copies).toEqual([]);
    expect(second.updates).toEqual([]);
    // The earlier copy is left in place and is now only reported
    expect(second.alerts).toEqual([
      { reason: 'unreferenced', bucket: FILE, key: 'u1/a.png' },
    ]);
  });
});

describe('backup and restore', () => {
  const key = { id: 'chat#c1', createdDate: '1' };

  test.each([
    [
      'a message whose attachment was rewritten',
      {
        kind: 'message' as const,
        key,
        set: { extraData: ['new'] },
        before: { extraData: ['old'] },
        condition: { content: 'hi' },
        requires: [],
      },
      {
        kind: 'message',
        key,
        set: { extraData: ['old'] },
        remove: [],
        expect: { content: 'hi' },
      },
    ],
    [
      'a message whose text was rewritten',
      {
        kind: 'message' as const,
        key,
        set: { content: 'new text' },
        before: { content: 'old text' },
        condition: { content: 'old text' },
        requires: [],
      },
      {
        kind: 'message',
        key,
        set: { content: 'old text' },
        remove: [],
        expect: { content: 'new text' },
      },
    ],
    [
      'a video job',
      {
        kind: 'videoJob' as const,
        key,
        set: { output: 'new' },
        before: { output: 'old' },
        condition: { output: 'old' },
        requires: [],
      },
      {
        kind: 'videoJob',
        key,
        set: { output: 'old' },
        remove: [],
        expect: { output: 'new' },
      },
    ],
    [
      'a share link',
      { kind: 'share' as const, key, set: { ownerSub: 'sub-a' } },
      {
        kind: 'share',
        key,
        set: {},
        remove: ['ownerSub'],
        expect: { ownerSub: 'sub-a' },
      },
    ],
  ])('%s', (_name, update, entry) => {
    expect(backupEntry(update)).toEqual(entry);
  });

  test('a restore applies only to a record that still holds the migrated value', () => {
    expect(
      restoreInput('t', {
        kind: 'share',
        key,
        set: {},
        remove: ['ownerSub'],
        expect: { ownerSub: 'sub-a' },
      })
    ).toEqual({
      TableName: 't',
      Key: key,
      UpdateExpression: 'REMOVE #r0',
      ConditionExpression: '#e0 = :e0',
      ExpressionAttributeNames: { '#r0': 'ownerSub', '#e0': 'ownerSub' },
      ExpressionAttributeValues: { ':e0': 'sub-a' },
    });
    expect(
      restoreInput('t', {
        kind: 'message',
        key,
        set: { content: 'old', extraData: [] },
        remove: [],
        expect: { content: 'new' },
      })
    ).toMatchObject({
      UpdateExpression: 'SET #s0 = :s0, #s1 = :s1',
      ConditionExpression: '#e0 = :e0',
      ExpressionAttributeValues: { ':s0': 'old', ':s1': [], ':e0': 'new' },
    });
  });
});

describe('parseArgs', () => {
  const base = [
    '--table',
    't',
    '--file-bucket',
    'b',
    '--region',
    'us-west-2',
    '--user-pool-id',
    'us-west-2_x',
  ];

  test('is a dry run unless --apply is given', () => {
    expect(parseArgs(base)).toMatchObject({
      apply: false,
      tableRegion: 'us-west-2',
    });
    expect(parseArgs([...base, '--apply'])).toMatchObject({ apply: true });
  });

  test('takes a backup file to restore from', () => {
    expect(
      parseArgs([
        '--table',
        't',
        '--region',
        'us-west-2',
        '--restore',
        'b.jsonl',
      ])
    ).toEqual({
      mode: 'restore',
      table: 't',
      tableRegion: 'us-west-2',
      restore: 'b.jsonl',
    });
  });

  test.each([
    [['--table', 't']],
    [[...base, '--agent-core-bucket', 'a']],
    [[...base, '--unknown', 'x']],
    [[...base, '--report']],
    [[...base, '--backup', 'b.jsonl']],
    [[...base, '--restore', 'b.jsonl']],
  ])('refuses %j', (argv) => {
    expect(() => parseArgs(argv)).toThrow(/usage/);
  });
});
