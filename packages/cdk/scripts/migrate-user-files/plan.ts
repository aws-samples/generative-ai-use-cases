import {
  USER_FILE_PREFIX,
  isNormalizedKey,
  parseS3ObjectUrl,
  userFilePrefix,
} from '@generative-ai-use-cases/common';

/**
 * Plans the move of files stored before the per-user layout (`users/<sub>/`)
 * into it, and the rewrite of the records that point at them. No IO: the CLI
 * scans the table, lists the buckets and the user pool, and passes them in.
 *
 * A file is moved to the prefix of the user whose record points at it: the
 * owner of the chat whose message attaches or links it, or the owner of the
 * video job. Earlier versions served any key to any signed-in user, so each
 * owner keeps exactly what their own chats showed. A key that chats of more
 * than one owner point at cannot be tied to one user, and is reported instead
 * (copied to each owner only with `includeSharedKeys`).
 */

export type TableItem = Record<string, unknown>;

export type BucketObject = { key: string; size: number };

export type PlanInput = {
  /** The file bucket and its region (where every file moves to). */
  fileBucket: string;
  fileBucketRegion: string;
  /** The AgentCore file bucket of earlier versions, if the stack has one. */
  agentCoreBucket?: string;
  /** Every item of the main table. */
  items: TableItem[];
  /** Objects outside `users/` in the file bucket and the AgentCore bucket. */
  objects: Map<string, BucketObject[]>;
  /** `cognito:username` -> `sub` for every user in the user pool. */
  subByUserName: Map<string, string>;
  includeSharedKeys?: boolean;
};

export type Copy = {
  sourceBucket: string;
  sourceKey: string;
  destinationKey: string;
  size: number;
};

/**
 * A record update. `condition` is the value read by the scan; `before` holds
 * the earlier value of every field in `set`, so the update can be undone.
 */
export type Update =
  | {
      kind: 'message';
      key: { id: string; createdDate: string };
      set: { content?: string; trace?: string; extraData?: unknown[] };
      before: { content?: string; trace?: string; extraData?: unknown[] };
      condition: { content: unknown };
      /** Destination keys that must be copied before this update. */
      requires: string[];
    }
  | {
      kind: 'videoJob';
      key: { id: string; createdDate: string };
      set: { output: string };
      before: { output: string };
      condition: { output: string };
      requires: string[];
    }
  | {
      kind: 'share';
      key: { id: string; createdDate: string };
      set: { ownerSub: string };
    };

export type AlertReason =
  /** The record's owner is not in the user pool (deleted user). */
  | 'unknown-user'
  /** Chats of more than one owner point at the key. */
  | 'shared-key'
  /** The record points at a key that is not in the bucket. */
  | 'missing-object'
  /** The key has empty, `.` or `..` segments. */
  | 'unsafe-key'
  /** Larger than a single CopyObject can copy (5 GB). */
  | 'too-large'
  /** The video job has not finished; run again once it has. */
  | 'video-in-progress'
  /** A URL to the file appears in message text outside a Markdown link. */
  | 'not-a-link'
  /** No record points at the object. */
  | 'unreferenced';

export type Alert = {
  reason: AlertReason;
  bucket?: string;
  key?: string;
  /** Owners (user names) whose records point at the key. */
  owners?: string[];
  /** The table item the alert is about. */
  item?: { id: string; createdDate: string };
};

export type Plan = {
  copies: Copy[];
  updates: Update[];
  alerts: Alert[];
};

/** S3 CopyObject copies objects up to 5 GB in one request. */
export const MAX_COPY_SIZE = 5 * 1024 ** 3;

// S3 URLs: virtual-hosted, path-style and s3:// forms.
const S3_URL =
  /(?:https:\/\/[a-z0-9.-]*s3[a-z0-9.-]*\.amazonaws\.com\/|s3:\/\/)[^\s"'<>()[\]`]+/
    .source;
const URL_IN_TEXT = new RegExp(S3_URL, 'g');
// The target of a Markdown link or image: `](url` or `](<url`. Only these
// are rewritten; other text, such as JSON a user pasted, is left as typed.
const LINK_TARGET = new RegExp(`(\\]\\(\\s*<?)(${S3_URL})`, 'g');

/** Drop the partition prefix (`user#`, `chat#`); SAML ids contain `#`. */
const afterPrefix = (value: unknown): string =>
  typeof value === 'string' ? value.split('#').slice(1).join('#') : '';

type Kind = 'attachment' | 'agentOutput' | 'video';

/** The key in the per-user layout for a file of an earlier version. */
export const destinationKey = (params: {
  sub: string;
  sourceBucket: string;
  sourceKey: string;
  fileBucket: string;
  kind: Kind;
}): string => {
  const { sub, sourceBucket, sourceKey, fileBucket, kind } = params;
  const prefix = userFilePrefix(sub);
  if (sourceBucket !== fileBucket) {
    // AgentCore output files: agentcore/<trace id>/<name>
    return `${prefix}agent-outputs/${sourceKey.replace(/^agentcore\//, '')}`;
  }
  if (sourceKey.startsWith('mcp/') || sourceKey.startsWith('agentcore/')) {
    return `${prefix}agent-outputs/${sourceKey.replace(/^(mcp|agentcore)\//, '')}`;
  }
  if (kind === 'video') return `${prefix}videos/${sourceKey}`;
  if (kind === 'agentOutput') return `${prefix}agent-outputs/${sourceKey}`;
  return `${prefix}attachments/${sourceKey}`;
};

const encodeKey = (key: string): string =>
  key.split('/').map(encodeURIComponent).join('/');

type Reference = {
  bucket: string;
  key: string;
  owner: string;
  kind: Kind;
};

export const planMigration = (input: PlanInput): Plan => {
  const { fileBucket, fileBucketRegion, agentCoreBucket, subByUserName } =
    input;
  const sourceBuckets = new Set(
    [fileBucket, agentCoreBucket].filter((b): b is string => !!b)
  );
  const objects = new Map<string, BucketObject>();
  for (const [bucket, list] of input.objects) {
    for (const object of list)
      objects.set(`${bucket}\u0000${object.key}`, object);
  }
  const alerts: Alert[] = [];

  /** A legacy file a URL points at, or null for anything else. */
  const legacyFile = (url: string) => {
    const location = parseS3ObjectUrl(url);
    if (!location || !sourceBuckets.has(location.bucket)) return null;
    if (location.key.startsWith(USER_FILE_PREFIX)) return null;
    return location;
  };

  // Pass 1: who points at which key.
  const references: Reference[] = [];
  // URLs in message text outside a Markdown link
  const textOnly: {
    bucket: string;
    key: string;
    item: { id: string; createdDate: string };
  }[] = [];
  const messages: TableItem[] = [];
  const videoJobs: TableItem[] = [];
  for (const item of input.items) {
    const id = String(item.id ?? '');
    if (id.startsWith('chat#') && typeof item.messageId === 'string') {
      const owner = afterPrefix(item.userId);
      let found = false;
      for (const extra of (item.extraData as unknown[]) ?? []) {
        const source = (extra as { source?: { type?: string; data?: unknown } })
          ?.source;
        if (source?.type !== 's3' || typeof source.data !== 'string') continue;
        const file = legacyFile(source.data);
        if (file) {
          references.push({ ...file, owner, kind: 'attachment' });
          found = true;
        }
      }
      for (const field of ['content', 'trace']) {
        const text = item[field];
        if (typeof text !== 'string') continue;
        const linked = new Set<string>();
        for (const [, , url] of text.matchAll(LINK_TARGET)) {
          const file = legacyFile(url);
          if (file) {
            references.push({ ...file, owner, kind: 'agentOutput' });
            linked.add(url);
            found = true;
          }
        }
        // A URL elsewhere in the text is left as typed, and reported
        for (const url of text.match(URL_IN_TEXT) ?? []) {
          const file = legacyFile(url);
          if (file && !linked.has(url)) {
            textOnly.push({
              ...file,
              item: { id, createdDate: String(item.createdDate) },
            });
          }
        }
      }
      if (found) messages.push(item);
    } else if (id.startsWith('videoJob#') && typeof item.output === 'string') {
      const file = legacyFile(item.output);
      if (file) {
        references.push({ ...file, owner: afterPrefix(id), kind: 'video' });
        videoJobs.push(item);
      }
    }
  }

  const ownersOf = new Map<string, Set<string>>();
  for (const ref of references) {
    const k = `${ref.bucket}\u0000${ref.key}`;
    if (!ownersOf.has(k)) ownersOf.set(k, new Set());
    ownersOf.get(k)!.add(ref.owner);
  }

  // Pass 2: decide each (key, owner). The result is the URL to write, or null.
  const copies = new Map<string, Copy>();
  const decided = new Map<string, string | null>();
  // Destination keys used by the rewrites of the record being planned.
  let required: Set<string> = new Set();
  const destinationOf = new Map<string, string>();
  const alerted = new Set<string>();
  const alertOnce = (alert: Alert) => {
    const k = `${alert.reason}\u0000${alert.bucket}\u0000${alert.key}\u0000${alert.owners?.join(',')}`;
    if (!alerted.has(k)) {
      alerted.add(k);
      alerts.push(alert);
    }
  };
  const decide = (ref: Reference, asS3Uri: boolean): string | null => {
    const k = `${ref.bucket}\u0000${ref.key}\u0000${ref.owner}\u0000${ref.kind}\u0000${asS3Uri}`;
    if (decided.has(k)) {
      const known = destinationOf.get(k);
      if (known) required.add(known);
      return decided.get(k)!;
    }
    const owners = [...(ownersOf.get(`${ref.bucket}\u0000${ref.key}`) ?? [])];
    const object = objects.get(`${ref.bucket}\u0000${ref.key}`);
    const sub = subByUserName.get(ref.owner);
    let result: string | null = null;
    if (!isNormalizedKey(ref.key)) {
      alertOnce({ reason: 'unsafe-key', bucket: ref.bucket, key: ref.key });
    } else if (owners.length > 1 && !input.includeSharedKeys) {
      alertOnce({
        reason: 'shared-key',
        bucket: ref.bucket,
        key: ref.key,
        owners: owners.sort(),
      });
    } else if (!sub) {
      alertOnce({
        reason: 'unknown-user',
        bucket: ref.bucket,
        key: ref.key,
        owners: [ref.owner],
      });
    } else if (!object) {
      alertOnce({ reason: 'missing-object', bucket: ref.bucket, key: ref.key });
    } else if (object.size > MAX_COPY_SIZE) {
      alertOnce({ reason: 'too-large', bucket: ref.bucket, key: ref.key });
    } else {
      const dst = destinationKey({
        sub,
        sourceBucket: ref.bucket,
        sourceKey: ref.key,
        fileBucket,
        kind: ref.kind,
      });
      copies.set(`${ref.bucket}\u0000${ref.key}\u0000${dst}`, {
        sourceBucket: ref.bucket,
        sourceKey: ref.key,
        destinationKey: dst,
        size: object.size,
      });
      destinationOf.set(k, dst);
      required.add(dst);
      result = asS3Uri
        ? `s3://${fileBucket}/${dst}`
        : `https://${fileBucket}.s3.${fileBucketRegion}.amazonaws.com/${encodeKey(dst)}`;
    }
    decided.set(k, result);
    return result;
  };

  /** The URL rewritten to the new location, keeping a `#fragment`. */
  const rewrite = (url: string, owner: string, kind: Kind): string | null => {
    const file = legacyFile(url);
    if (!file) return null;
    const next = decide({ ...file, owner, kind }, url.startsWith('s3://'));
    if (next === null) return null;
    const hash = url.indexOf('#');
    return hash >= 0 ? `${next}${url.slice(hash)}` : next;
  };

  const updates: Update[] = [];
  for (const item of messages) {
    required = new Set();
    const owner = afterPrefix(item.userId);
    const set: { content?: string; trace?: string; extraData?: unknown[] } = {};
    if (Array.isArray(item.extraData)) {
      let changed = false;
      const extraData = item.extraData.map((extra) => {
        const source = (extra as { source?: { type?: string; data?: unknown } })
          ?.source;
        if (source?.type !== 's3' || typeof source.data !== 'string') {
          return extra;
        }
        const next = rewrite(source.data, owner, 'attachment');
        if (next === null) return extra;
        changed = true;
        return {
          ...(extra as object),
          source: { ...source, data: next },
        };
      });
      if (changed) set.extraData = extraData;
    }
    for (const field of ['content', 'trace'] as const) {
      const text = item[field];
      if (typeof text !== 'string') continue;
      const next = text.replace(
        LINK_TARGET,
        (match, open: string, url: string) => {
          const rewritten = rewrite(url, owner, 'agentOutput');
          return rewritten === null ? match : `${open}${rewritten}`;
        }
      );
      if (next !== text) set[field] = next;
    }
    if (Object.keys(set).length > 0) {
      const before: {
        content?: string;
        trace?: string;
        extraData?: unknown[];
      } = {};
      for (const field of Object.keys(set) as (keyof typeof set)[]) {
        (before as Record<string, unknown>)[field] = item[field];
      }
      updates.push({
        kind: 'message',
        key: {
          id: String(item.id),
          createdDate: String(item.createdDate),
        },
        set,
        before,
        condition: { content: item.content },
        requires: [...required],
      });
    }
  }

  for (const item of videoJobs) {
    const key = { id: String(item.id), createdDate: String(item.createdDate) };
    const output = String(item.output);
    if (item.status !== 'Completed' && item.status !== 'Failed') {
      alertOnce({
        reason: 'video-in-progress',
        key: parseS3ObjectUrl(output)?.key,
        item: key,
      });
      continue;
    }
    if (item.status === 'Failed') continue;
    required = new Set();
    const next = rewrite(output, afterPrefix(item.id), 'video');
    if (next !== null) {
      updates.push({
        kind: 'videoJob',
        key,
        set: { output: next },
        before: { output },
        condition: { output },
        requires: [...required],
      });
    }
  }

  // Share links created before the owner's sub was recorded.
  for (const item of input.items) {
    const id = String(item.id ?? '');
    if (!id.startsWith('share#') || typeof item.chatId !== 'string') continue;
    if (typeof item.ownerSub === 'string' && item.ownerSub) continue;
    const owner = afterPrefix(item.userId);
    const sub = subByUserName.get(owner);
    const key = { id, createdDate: String(item.createdDate) };
    if (sub) {
      updates.push({ kind: 'share', key, set: { ownerSub: sub } });
    } else {
      alertOnce({ reason: 'unknown-user', owners: [owner], item: key });
    }
  }

  // Objects no record points at (for example, audio uploaded for a
  // transcription, or files of deleted chats).
  const mentioned = new Set<string>();
  for (const ref of textOnly) {
    mentioned.add(`${ref.bucket}\u0000${ref.key}`);
    alertOnce({
      reason: 'not-a-link',
      bucket: ref.bucket,
      key: ref.key,
      item: ref.item,
    });
  }
  for (const [bucket, list] of input.objects) {
    for (const object of list) {
      const k = `${bucket}\u0000${object.key}`;
      if (!ownersOf.has(k) && !mentioned.has(k)) {
        alerts.push({ reason: 'unreferenced', bucket, key: object.key });
      }
    }
  }

  return { copies: [...copies.values()], updates, alerts };
};
