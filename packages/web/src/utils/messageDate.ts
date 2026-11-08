/**
 * Parse a message's `createdDate` into a Date.
 *
 * Saved messages store `<epoch ms>#<index>`, where the index keeps messages
 * saved in the same request in order. Messages that are still streaming or
 * not yet saved have no `createdDate`; those return undefined.
 */
export const parseMessageDate = (createdDate?: string): Date | undefined => {
  if (!createdDate) return undefined;
  const ms = Number(createdDate.split('#')[0]);
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return new Date(ms);
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * How long ago `date` was, e.g. "3 hours ago", "yesterday", "5 days ago",
 * in the given locale.
 *
 * Today uses minutes or hours. Earlier dates count local calendar days, so a
 * message from 23:50 last night reads "yesterday" just after midnight.
 * From 30 days it switches to months, and from 12 months to years.
 */
export const formatRelativeTime = (
  date: Date,
  now: Date,
  locale?: string
): string => {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days <= 0) {
    const diff = Math.max(0, now.getTime() - date.getTime());
    // "now" for the first minute ('minute' would say "this minute").
    if (diff < MINUTE_MS) return rtf.format(0, 'second');
    if (diff < HOUR_MS) {
      return rtf.format(-Math.floor(diff / MINUTE_MS), 'minute');
    }
    return rtf.format(-Math.floor(diff / HOUR_MS), 'hour');
  }
  if (days < 30) return rtf.format(-days, 'day');

  const months =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());
  if (months < 12) return rtf.format(-Math.max(1, months), 'month');
  return rtf.format(-Math.floor(months / 12), 'year');
};
