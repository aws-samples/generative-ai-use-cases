import { UserTokenUsageTotals } from 'generative-ai-use-cases';

const CSV_COLUMNS = [
  'executions',
  'inputTokens',
  'outputTokens',
  'cacheReadInputTokens',
  'cacheWriteInputTokens',
  'estimatedCostUsd',
  'lastActiveDate',
] as const;

/**
 * One CSV cell. Text starting with = + - @ tab or CR is prefixed with ' so
 * spreadsheets do not run it as a formula (emails and SAML user names come
 * from users and IdPs). Numbers are written as they are.
 */
export const csvCell = (value: string | number | undefined): string => {
  const text = String(value ?? '');
  const safe =
    typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV of the per-user totals, for joining with user attributes elsewhere. */
export const toCsv = (users: UserTokenUsageTotals[]): string => {
  const quote = csvCell;
  const header = ['userId', 'email', ...CSV_COLUMNS].map(quote).join(',');
  const rows = users.map((user) =>
    [user.userId, user.email, ...CSV_COLUMNS.map((column) => user[column])]
      .map(quote)
      .join(',')
  );
  return [header, ...rows].join('\n');
};
