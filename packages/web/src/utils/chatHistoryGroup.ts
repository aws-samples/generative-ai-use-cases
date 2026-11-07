export type ChatHistoryGroup =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'last_7_days' }
  | { kind: 'last_30_days' }
  // Older chats are grouped by calendar month, e.g. "2026-03".
  | { kind: 'month'; year: number; month: number };

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * Decide which history section a chat belongs to.
 *
 * `createdDate` is the epoch-millisecond string stored on the chat record.
 * Day boundaries follow the browser's local time zone, so "today" means the
 * user's today rather than UTC.
 */
export const getChatHistoryGroup = (
  createdDate: string,
  now: Date = new Date()
): ChatHistoryGroup => {
  const created = new Date(Number(createdDate));
  // Should not happen (chats always store epoch ms), but an unparsable value
  // must not produce an invalid month that breaks date formatting.
  if (isNaN(created.getTime())) return { kind: 'today' };
  const daysAgo = Math.round((startOfDay(now) - startOfDay(created)) / DAY_MS);
  if (daysAgo <= 0) return { kind: 'today' };
  if (daysAgo === 1) return { kind: 'yesterday' };
  if (daysAgo < 7) return { kind: 'last_7_days' };
  if (daysAgo < 30) return { kind: 'last_30_days' };
  return {
    kind: 'month',
    year: created.getFullYear(),
    month: created.getMonth() + 1,
  };
};

export const chatHistoryGroupKey = (group: ChatHistoryGroup): string =>
  group.kind === 'month' ? `${group.year}-${group.month}` : group.kind;
