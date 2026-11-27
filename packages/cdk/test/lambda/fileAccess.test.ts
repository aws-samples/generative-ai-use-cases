import {
  UnsupportedFilterError,
  agentOutputKey,
  attachmentKey,
  attachedFileKeys,
  canAccessFile,
  evaluateFilters,
  findDocumentSource,
  isOwnedFileKey,
  parseDocumentMetadata,
  parseS3ObjectUrl,
  sanitizeFileName,
  unsupportedFilterOperators,
  userFileOwner,
  videoOutputKey,
} from '@generative-ai-use-cases/common';
import { UnrecordedMessage } from 'generative-ai-use-cases';
import { RetrievalFilter } from '@aws-sdk/client-bedrock-agent-runtime';

const BUCKET = 'file-bucket';
const url = (key: string) =>
  `https://${BUCKET}.s3.us-east-1.amazonaws.com/${key
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

describe('file keys', () => {
  test.each([
    ['a.png', 'a.png'],
    ['../../etc/passwd', 'passwd'],
    ['dir\\evil.txt', 'evil.txt'],
    ['..', 'file'],
    ['', 'file'],
  ])('sanitizeFileName(%j) = %j', (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected);
  });

  test('places files under the encoded user prefix', () => {
    expect(attachmentKey('a#b', 'u1', '../x.png')).toBe(
      'users/a%23b/attachments/u1/x.png'
    );
    expect(videoOutputKey('alice', 'j1')).toBe(
      'users/alice/videos/j1/output.mp4'
    );
    expect(agentOutputKey('alice', 'u1', 'chart.png')).toBe(
      'users/alice/agent-outputs/u1/chart.png'
    );
  });

  test.each([
    ['users/alice/attachments/u/a.png', true],
    ['users/alice/', false],
    ['users/alice/../bob/a.png', false],
    ['users/alicex/a.png', false],
    ['users/bob/a.png', false],
  ])('isOwnedFileKey(alice, %s) = %s', (key, expected) => {
    expect(isOwnedFileKey('alice', key)).toBe(expected);
  });

  test('userFileOwner reads only the canonical encoding', () => {
    expect(userFileOwner('users/a%23b/x')).toBe('a#b');
    expect(userFileOwner('users/a#b/x')).toBeNull();
    expect(userFileOwner('uuid/x')).toBeNull();
  });

  test('parseS3ObjectUrl decodes the key of a URL once', () => {
    expect(parseS3ObjectUrl(url('users/a%23b/x y.png'))).toEqual({
      bucket: BUCKET,
      key: 'users/a%23b/x y.png',
      region: 'us-east-1',
    });
  });
});

describe('canAccessFile', () => {
  const ALICE = attachmentKey('alice', 'u1', 'a.png');
  const ALICE_UNSHOWN = attachmentKey('alice', 'u9', 'unshown.png');
  const ALICE_OUTPUT = agentOutputKey('alice', 'u3', 'chart.png');
  const BOB = attachmentKey('bob', 'u2', 'b.png');
  const OLD = '0b7e5a1c/old.png';

  // A chat of alice's that attaches her file, bob's file and a file from an
  // earlier version, and links her agent output in the text.
  const attached = attachedFileKeys(
    [
      {
        role: 'user',
        content: `![chart](${url(ALICE_OUTPUT)})`,
        extraData: [ALICE, BOB, OLD].map((key) => ({
          type: 'image',
          name: 'x.png',
          source: { type: 's3', mediaType: 'image/png', data: url(key) },
        })),
      },
    ] as UnrecordedMessage[],
    BUCKET
  );
  const aliceShare = { owner: 'alice', attached };

  test('collects only the attachments in the file bucket', () => {
    expect([...attached].sort()).toEqual([ALICE, BOB, OLD].sort());
  });

  // Every rule in one table: caller, key, shared chat, expected
  test.each([
    // 1. Own files
    ['alice', ALICE, undefined, true],
    ['alice', ALICE_OUTPUT, undefined, true],
    ['alice', BOB, undefined, false],
    ['alice', OLD, undefined, false],
    ['alice', 'users/alice/../bob/b.png', undefined, false],
    // 2. Through alice's share: her attachments only
    ['bob', ALICE, aliceShare, true],
    ['carol', ALICE, aliceShare, true],
    ['carol', ALICE_UNSHOWN, aliceShare, false],
    ['carol', ALICE_OUTPUT, aliceShare, false],
    ['carol', OLD, aliceShare, false],
    // An attachment of someone other than the owner is never served
    ['carol', BOB, aliceShare, false],
    // Own files stay readable with a share
    ['bob', BOB, aliceShare, true],
  ] as const)(
    '%s reads %s (share: %j) -> %s',
    (caller, key, share, expected) => {
      expect(canAccessFile({ caller, key, share })).toBe(expected);
    }
  );
});

describe('document sources', () => {
  const sources = [
    { kind: 'knowledgeBase' as const, bucket: 'kb', prefix: 'docs/' },
    { kind: 'kendra' as const, bucket: 'kendra', prefix: '' },
  ];

  test.each([
    [{ bucket: 'kb', key: 'docs/a.pdf' }, 'knowledgeBase'],
    [{ bucket: 'kb', key: 'other/a.pdf' }, null],
    [{ bucket: 'kb', key: 'docs/a.pdf.metadata.json' }, null],
    [{ bucket: 'kb', key: 'docs/../secret.pdf' }, null],
    [{ bucket: 'kendra', key: 'any/a.pdf' }, 'kendra'],
    [{ bucket: 'ac', key: 'agentcore/t/out.csv' }, null],
    [{ bucket: BUCKET, key: 'mcp/s/out.png' }, null],
    [{ bucket: BUCKET, key: 'users/alice/a.png' }, null],
  ])('%j -> %s', (location, expected) => {
    expect(findDocumentSource(sources, location)?.kind ?? null).toBe(expected);
  });

  test('a Knowledge Base source wins over an overlapping Kendra source', () => {
    // The Kendra source comes first and covers the whole shared bucket
    const overlapping = [
      { kind: 'kendra' as const, bucket: 'shared', prefix: '' },
      { kind: 'knowledgeBase' as const, bucket: 'shared', prefix: 'kb/' },
    ];
    expect(
      findDocumentSource(overlapping, { bucket: 'shared', key: 'kb/a.pdf' })
        ?.kind
    ).toBe('knowledgeBase');
    expect(
      findDocumentSource(overlapping, { bucket: 'shared', key: 'other.pdf' })
        ?.kind
    ).toBe('kendra');
  });
});

describe('Knowledge Base filter evaluation', () => {
  const metadata = parseDocumentMetadata({
    metadataAttributes: {
      group: 'sales',
      year: { value: { type: 'NUMBER', numberValue: 2024 } },
      tags: ['a', 'b'],
    },
  });

  // Expected values are what Retrieve returned for the same filter and
  // metadata on OpenSearch Serverless and S3 Vectors Knowledge Bases.
  test.each([
    ['equals on a scalar', { equals: { key: 'group', value: 'sales' } }, true],
    [
      'equals on another value',
      { equals: { key: 'group', value: 'hr' } },
      false,
    ],
    [
      'equals on another type',
      { equals: { key: 'year', value: '2024' } },
      false,
    ],
    ['equals on a list element', { equals: { key: 'tags', value: 'a' } }, true],
    [
      'equals on a missing key',
      { equals: { key: 'missing', value: 'x' } },
      false,
    ],
    [
      'notEquals on another value',
      { notEquals: { key: 'group', value: 'hr' } },
      true,
    ],
    [
      'notEquals on another type',
      { notEquals: { key: 'year', value: '2024' } },
      true,
    ],
    [
      'notEquals on a missing key',
      { notEquals: { key: 'missing', value: 'x' } },
      true,
    ],
    [
      'notEquals on a list element',
      { notEquals: { key: 'tags', value: 'a' } },
      false,
    ],
    [
      'greaterThanOrEquals',
      { greaterThanOrEquals: { key: 'year', value: 2024 } },
      true,
    ],
    ['lessThan', { lessThan: { key: 'year', value: 2024 } }, false],
    ['in on a scalar', { in: { key: 'group', value: ['sales', 'hr'] } }, true],
    ['in on a list element', { in: { key: 'tags', value: ['b'] } }, true],
    ['in on another type', { in: { key: 'year', value: ['2024'] } }, false],
    ['notIn on a scalar', { notIn: { key: 'group', value: ['hr'] } }, true],
    [
      'notIn on a list element',
      { notIn: { key: 'tags', value: ['x', 'b'] } },
      false,
    ],
    [
      'notIn on another type',
      { notIn: { key: 'year', value: ['2024'] } },
      true,
    ],
    [
      'notIn on a missing key',
      { notIn: { key: 'missing', value: ['x'] } },
      true,
    ],
    [
      'listContains on a list',
      { listContains: { key: 'tags', value: 'a' } },
      true,
    ],
    [
      'listContains on a scalar',
      { listContains: { key: 'group', value: 'sales' } },
      true,
    ],
    ['startsWith', { startsWith: { key: 'group', value: 'sal' } }, true],
    [
      'stringContains on a list',
      { stringContains: { key: 'tags', value: 'b' } },
      true,
    ],
    [
      'andAll',
      {
        andAll: [
          { equals: { key: 'group', value: 'sales' } },
          { lessThan: { key: 'year', value: 2024 } },
        ],
      },
      false,
    ],
    [
      'orAll',
      {
        orAll: [
          { equals: { key: 'group', value: 'hr' } },
          { listContains: { key: 'tags', value: 'b' } },
        ],
      },
      true,
    ],
  ])('%s', (_name, filter, expected) => {
    expect(
      evaluateFilters([filter as unknown as RetrievalFilter], metadata)
    ).toBe(expected);
  });

  test('S3 Vectors refuses string matching, nested too', () => {
    const options = {
      unsupportedOperators: unsupportedFilterOperators('s3vectors'),
    };
    for (const filter of [
      { startsWith: { key: 'group', value: 'sal' } },
      { orAll: [{ stringContains: { key: 'tags', value: 'b' } }] },
    ]) {
      expect(() =>
        evaluateFilters([filter as RetrievalFilter], metadata, options)
      ).toThrow(UnsupportedFilterError);
    }
    expect(unsupportedFilterOperators('opensearch')).toEqual([]);
  });

  // Filters Retrieve refuses with a ValidationException.
  test.each([
    [{ unknownOp: { key: 'group', value: 'x' } }],
    [{ andAll: [] }],
    [{ orAll: [] }],
    [{ in: { key: 'year', value: [2024] } }],
    [{ notIn: { key: 'group', value: [] } }],
    [{ listContains: { key: 'year', value: 2024 } }],
    [{ greaterThan: { key: 'year', value: '2024' } }],
  ])('rejects %j', (filter) => {
    expect(() =>
      evaluateFilters([filter as unknown as RetrievalFilter], metadata)
    ).toThrow(UnsupportedFilterError);
  });
});

describe('S3 URL parsing pins the bucket', () => {
  test('an agent output URL from the runtimes reads back as its key', () => {
    // user_files.py: quote(key, safe='/') after encoding the user name.
    const user = 'EntraID_a#b@x.com';
    const key = agentOutputKey(user, 'u9', 'chart 1.png');
    const url = `https://${BUCKET}.s3.us-east-1.amazonaws.com/users/EntraID_a%2523b%2540x.com/agent-outputs/u9/chart%201.png`;
    expect(parseS3ObjectUrl(url)).toEqual({
      bucket: BUCKET,
      key,
      region: 'us-east-1',
    });
    expect(userFileOwner(key)).toBe(user);
  });

  test.each([
    'https://file-bucket.s3.amazonaws.com.evil.example/users/alice/a.png',
    'http://file-bucket.s3.amazonaws.com/users/alice/a.png',
  ])('rejects %s', (url) => {
    expect(parseS3ObjectUrl(url)).toBeNull();
  });

  test('a path-style URL for another bucket keeps that bucket', () => {
    expect(
      parseS3ObjectUrl(
        'https://s3.us-east-1.amazonaws.com/other/users/alice/a.png'
      )?.bucket
    ).toBe('other');
  });
});
