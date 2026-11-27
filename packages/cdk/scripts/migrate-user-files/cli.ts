// Usage (from packages/cdk):
//   npx ts-node scripts/migrate-user-files/cli.ts \
//     --table <table> --file-bucket <bucket> --region <file bucket region> \
//     --user-pool-id <id> [--agent-core-bucket <bucket> --agent-core-region <region>] \
//     [--include-shared-keys] [--report <path>] [--apply [--backup <path>]]
//   npx ts-node scripts/migrate-user-files/cli.ts \
//     --table <table> --region <region> --restore <backup file>
//
// Without --apply it only reads (Scan, ListObjectsV2, ListUsers) and writes a
// report. With --apply it copies files inside S3 (CopyObject: the contents
// never reach this machine), then points the records at the copies. Files at
// their earlier location are never deleted. Running it again is safe.
// --apply saves the earlier value of each record it changes to a backup file
// first; --restore puts those values back.
// See README.md for the permissions and the order of steps.
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  ScanCommandOutput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider';
import { USER_FILE_PREFIX } from '@generative-ai-use-cases/common';
import {
  AlertReason,
  BucketObject,
  Copy,
  TableItem,
  Update,
  planMigration,
} from './plan';
import { MigrateArgs, RestoreArgs, parseArgs } from './args';
import { backupEntry, restoreInput, BackupEntry } from './backup';

const COPY_CONCURRENCY = 8;

const scanTable = async (
  client: DynamoDBDocumentClient,
  table: string
): Promise<TableItem[]> => {
  const items: TableItem[] = [];
  let start: ScanCommandOutput['LastEvaluatedKey'];
  do {
    const res: ScanCommandOutput = await client.send(
      new ScanCommand({
        TableName: table,
        // Only what the plan reads
        ProjectionExpression:
          '#id, createdDate, messageId, userId, chatId, extraData, content, #trace, #output, #status, ownerSub',
        ExpressionAttributeNames: {
          '#id': 'id',
          '#trace': 'trace',
          '#output': 'output',
          '#status': 'status',
        },
        ExclusiveStartKey: start,
      })
    );
    items.push(...((res.Items ?? []) as TableItem[]));
    start = res.LastEvaluatedKey;
  } while (start);
  return items;
};

/** Objects outside `users/`: files of earlier versions. */
const listLegacyObjects = async (
  client: S3Client,
  bucket: string
): Promise<BucketObject[]> => {
  const objects: BucketObject[] = [];
  let token: string | undefined;
  do {
    const res: ListObjectsV2CommandOutput = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token })
    );
    for (const o of res.Contents ?? []) {
      if (o.Key && !o.Key.startsWith(USER_FILE_PREFIX)) {
        objects.push({ key: o.Key, size: o.Size ?? 0 });
      }
    }
    token = res.NextContinuationToken;
  } while (token);
  return objects;
};

const listUserSubs = async (
  client: CognitoIdentityProviderClient,
  userPoolId: string
): Promise<Map<string, string>> => {
  const subs = new Map<string, string>();
  let token: string | undefined;
  do {
    const res: ListUsersCommandOutput = await client.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        AttributesToGet: ['sub'],
        PaginationToken: token,
      })
    );
    for (const user of res.Users ?? []) {
      const sub = user.Attributes?.find((a) => a.Name === 'sub')?.Value;
      if (user.Username && sub) subs.set(user.Username, sub);
    }
    token = res.PaginationToken;
  } while (token);
  return subs;
};

const encodeKey = (key: string): string =>
  key.split('/').map(encodeURIComponent).join('/');

/** Copy inside S3. Returns false when the copy failed. */
const copyObject = async (
  s3: S3Client,
  fileBucket: string,
  copy: Copy
): Promise<'copied' | 'exists' | 'failed'> => {
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: fileBucket, Key: copy.destinationKey })
    );
    // Same key and size: an earlier run copied it
    if (head.ContentLength === copy.size) return 'exists';
  } catch (error) {
    if ((error as { name?: string }).name !== 'NotFound') {
      console.error(`HeadObject failed for ${copy.destinationKey}:`, error);
      return 'failed';
    }
  }
  try {
    await s3.send(
      new CopyObjectCommand({
        Bucket: fileBucket,
        Key: copy.destinationKey,
        CopySource: `${copy.sourceBucket}/${encodeKey(copy.sourceKey)}`,
      })
    );
    return 'copied';
  } catch (error) {
    console.error(
      `CopyObject failed for ${copy.sourceBucket}/${copy.sourceKey}:`,
      error
    );
    return 'failed';
  }
};

const applyUpdate = async (
  client: DynamoDBDocumentClient,
  table: string,
  update: Update
): Promise<'updated' | 'changed'> => {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets = Object.entries(update.set).map(([field, value], i) => {
    names[`#f${i}`] = field;
    values[`:v${i}`] = value;
    return `#f${i} = :v${i}`;
  });
  let condition: string;
  if (update.kind === 'share') {
    names['#ownerSub'] = 'ownerSub';
    // A link that already has its owner's sub is left alone
    condition = 'attribute_not_exists(#ownerSub)';
  } else {
    const [field, value] = Object.entries(update.condition)[0];
    names['#c'] = field;
    values[':c'] = value;
    // The record must still hold what the scan read
    condition = '#c = :c';
  }
  try {
    await client.send(
      new UpdateCommand({
        TableName: table,
        Key: update.key,
        UpdateExpression: `SET ${sets.join(', ')}`,
        ConditionExpression: condition,
        ExpressionAttributeNames: names,
        ...(Object.keys(values).length > 0
          ? { ExpressionAttributeValues: values }
          : {}),
      })
    );
    return 'updated';
  } catch (error) {
    if (
      (error as { name?: string }).name === 'ConditionalCheckFailedException'
    ) {
      return 'changed';
    }
    throw error;
  }
};

const inPool = async <T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>
): Promise<void> => {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await run(items[next++]);
    })
  );
};

const migrate = async (args: MigrateArgs) => {
  const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: args.tableRegion })
  );
  const s3 = new S3Client({ region: args.region });
  const agentCoreS3 = new S3Client({
    region: args.agentCoreRegion ?? args.region,
  });

  console.log('Reading the table, the buckets and the user pool...');
  const [items, fileObjects, agentCoreObjects, subByUserName] =
    await Promise.all([
      scanTable(ddb, args.table),
      listLegacyObjects(s3, args.fileBucket),
      args.agentCoreBucket
        ? listLegacyObjects(agentCoreS3, args.agentCoreBucket)
        : Promise.resolve([]),
      listUserSubs(
        new CognitoIdentityProviderClient({ region: args.userPoolRegion }),
        args.userPoolId
      ),
    ]);
  const objects = new Map<string, BucketObject[]>([
    [args.fileBucket, fileObjects],
  ]);
  if (args.agentCoreBucket) objects.set(args.agentCoreBucket, agentCoreObjects);

  const plan = planMigration({
    fileBucket: args.fileBucket,
    fileBucketRegion: args.region,
    agentCoreBucket: args.agentCoreBucket,
    items,
    objects,
    subByUserName,
    includeSharedKeys: args.includeSharedKeys,
  });

  const counts = (reason: AlertReason) =>
    plan.alerts.filter((a) => a.reason === reason).length;
  console.log(`Table items: ${items.length}, users: ${subByUserName.size}`);
  console.log(
    `Files of earlier versions: ${fileObjects.length} in the file bucket, ${agentCoreObjects.length} in the AgentCore bucket`
  );
  console.log(
    `Planned: ${plan.copies.length} copies, ${plan.updates.filter((u) => u.kind === 'message').length} messages, ${plan.updates.filter((u) => u.kind === 'videoJob').length} video jobs, ${plan.updates.filter((u) => u.kind === 'share').length} share links`
  );
  const reasons: AlertReason[] = [
    'shared-key',
    'unknown-user',
    'missing-object',
    'unsafe-key',
    'too-large',
    'video-in-progress',
    'not-a-link',
    'unreferenced',
  ];
  for (const reason of reasons) {
    if (counts(reason) > 0) console.log(`  ALERT ${reason}: ${counts(reason)}`);
  }

  const result = {
    copies: { copied: 0, exists: 0, failed: [] as Copy[] },
    updates: { updated: 0, changed: [] as Update[], skipped: [] as Update[] },
  };
  if (args.apply) {
    console.log('Copying files inside S3...');
    const done = new Set<string>();
    await inPool(plan.copies, COPY_CONCURRENCY, async (copy) => {
      const status = await copyObject(s3, args.fileBucket, copy);
      if (status === 'failed') {
        result.copies.failed.push(copy);
      } else {
        result.copies[status]++;
        done.add(copy.destinationKey);
      }
    });
    const backupPath =
      args.backup ??
      join(process.cwd(), `migrate-user-files-${Date.now()}-backup.jsonl`);
    if (existsSync(backupPath)) {
      throw new Error(`${backupPath} exists; choose another --backup path`);
    }
    // Only its owner can read it: it holds the earlier message text
    writeFileSync(backupPath, '', { mode: 0o600 });
    console.log(`Updating records (earlier values in ${backupPath})...`);
    for (const update of plan.updates) {
      // A record is pointed at its copies only when every copy succeeded
      if (
        update.kind !== 'share' &&
        !update.requires.every((k) => done.has(k))
      ) {
        result.updates.skipped.push(update);
        continue;
      }
      // Saved before the update, so a failure mid-run loses no earlier value
      appendFileSync(backupPath, `${JSON.stringify(backupEntry(update))}\n`);
      const status = await applyUpdate(ddb, args.table, update);
      if (status === 'updated') result.updates.updated++;
      else result.updates.changed.push(update);
    }
    console.log(
      `Copied ${result.copies.copied} (already there: ${result.copies.exists}, failed: ${result.copies.failed.length}). ` +
        `Updated ${result.updates.updated} records (changed since the scan: ${result.updates.changed.length}, skipped after a failed copy: ${result.updates.skipped.length}).`
    );
  }

  const reportPath =
    args.report ?? join(process.cwd(), `migrate-user-files-${Date.now()}.json`);
  // Keys and record keys only: no message text, no file contents
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        applied: args.apply,
        copies: plan.copies,
        updates: plan.updates.map((u) => ({
          kind: u.kind,
          key: u.key,
          fields: Object.keys(u.set),
        })),
        alerts: plan.alerts,
        ...(args.apply
          ? {
              result: {
                ...result,
                updates: {
                  updated: result.updates.updated,
                  changed: result.updates.changed.map((u) => u.key),
                  skipped: result.updates.skipped.map((u) => u.key),
                },
              },
            }
          : {}),
      },
      null,
      2
    )
  );
  console.log(`Report: ${reportPath}`);
  if (!args.apply)
    console.log('Dry run: nothing was changed. Add --apply to migrate.');
  if (
    args.apply &&
    (result.copies.failed.length > 0 || result.updates.skipped.length > 0)
  ) {
    process.exitCode = 1;
  }
};

/**
 * Put back the records a migration changed, from its backup file. A record
 * changed again after the migration is left alone and reported. Copied files
 * stay where they are (nothing points at them after the restore).
 */
const restore = async (args: RestoreArgs) => {
  const ddb = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: args.tableRegion })
  );
  const entries = readFileSync(args.restore, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as BackupEntry);
  let restored = 0;
  const changed: BackupEntry['key'][] = [];
  for (const entry of entries.reverse()) {
    try {
      await ddb.send(new UpdateCommand(restoreInput(args.table, entry)));
      restored++;
    } catch (error) {
      if (
        (error as { name?: string }).name === 'ConditionalCheckFailedException'
      ) {
        changed.push(entry.key);
      } else {
        throw error;
      }
    }
  }
  console.log(
    `Restored ${restored} of ${entries.length} records. Changed after the migration, left alone: ${changed.length}.`
  );
  for (const key of changed) console.log(`  ${key.id} ${key.createdDate}`);
  if (changed.length > 0) process.exitCode = 1;
};

const args = parseArgs(process.argv.slice(2));
(args.mode === 'restore' ? restore(args) : migrate(args)).catch((error) => {
  console.error(error);
  process.exit(1);
});
