import { Update } from './plan';

/**
 * One line of the backup file --apply writes before each record update: how
 * to put the record back, and the value the record holds after the migration,
 * so that a restore never overwrites a later change.
 *
 * Message entries hold the earlier message text and `extraData`. Store the
 * file as you would store the table itself.
 */
export type BackupEntry = {
  kind: Update['kind'];
  key: { id: string; createdDate: string };
  /** Fields to set back. */
  set: Record<string, unknown>;
  /** Fields the migration added; a restore removes them. */
  remove: string[];
  /** The record must still hold these values for the restore to apply. */
  expect: Record<string, unknown>;
};

export const backupEntry = (update: Update): BackupEntry => {
  switch (update.kind) {
    case 'message':
      return {
        kind: update.kind,
        key: update.key,
        set: { ...update.before },
        remove: [],
        // `content` is the field every message has; it is the migrated text
        // when the migration rewrote it, and unchanged otherwise.
        expect: { content: update.set.content ?? update.condition.content },
      };
    case 'videoJob':
      return {
        kind: update.kind,
        key: update.key,
        set: { ...update.before },
        remove: [],
        expect: { output: update.set.output },
      };
    case 'share':
      return {
        kind: update.kind,
        key: update.key,
        set: {},
        remove: ['ownerSub'],
        expect: { ownerSub: update.set.ownerSub },
      };
  }
};

/** The UpdateItem input that applies `entry` back to its record. */
export const restoreInput = (table: string, entry: BackupEntry) => {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const sets = Object.entries(entry.set).map(([field, value], i) => {
    names[`#s${i}`] = field;
    values[`:s${i}`] = value;
    return `#s${i} = :s${i}`;
  });
  const removes = entry.remove.map((field, i) => {
    names[`#r${i}`] = field;
    return `#r${i}`;
  });
  const conditions = Object.entries(entry.expect).map(([field, value], i) => {
    names[`#e${i}`] = field;
    values[`:e${i}`] = value;
    return `#e${i} = :e${i}`;
  });
  return {
    TableName: table,
    Key: entry.key,
    UpdateExpression: [
      sets.length > 0 ? `SET ${sets.join(', ')}` : '',
      removes.length > 0 ? `REMOVE ${removes.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' '),
    ConditionExpression: conditions.join(' AND '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
};
