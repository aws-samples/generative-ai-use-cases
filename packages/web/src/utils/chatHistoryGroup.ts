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
 * When the chat was last active, as an epoch-millisecond string.
 *
 * `updatedDate` is written each time messages are saved. Chats saved before
 * that existed have an empty `updatedDate`, so they fall back to
 * `createdDate` until their next message.
 */
export const getChatActivityDate = (chat: {
  createdDate: string;
  updatedDate?: string;
}): string => chat.updatedDate || chat.createdDate;

/**
 * Order chats by last activity, newest first.
 *
 * The API pages chats by `createdDate`, so this only orders the pages loaded
 * so far: an old chat that is still in use appears once its page is loaded.
 * Ties and unparsable dates keep the API order.
 */
export const sortChatsByActivity = <
  T extends { createdDate: string; updatedDate?: string },
>(
  chats: T[]
): T[] => {
  const time = (chat: T) => {
    const value = Number(getChatActivityDate(chat));
    return isNaN(value) ? -Infinity : value;
  };
  // Array.prototype.sort is stable, so equal times keep the API order.
  return [...chats].sort((a, b) => time(b) - time(a));
};

/**
 * Decide which history section a chat belongs to.
 *
 * `date` is an epoch-millisecond string, normally from getChatActivityDate.
 * Day boundaries follow the browser's local time zone, so "today" means the
 * user's today rather than UTC.
 */
export const getChatHistoryGroup = (
  date: string,
  now: Date = new Date()
): ChatHistoryGroup => {
  const created = new Date(Number(date));
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
