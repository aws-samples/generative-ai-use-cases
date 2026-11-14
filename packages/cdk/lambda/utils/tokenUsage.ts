import { TokenUsageStats, UserTokenUsageTotals } from 'generative-ai-use-cases';

const METRICS = [
  'executions',
  'inputTokens',
  'outputTokens',
  'cacheReadInputTokens',
  'cacheWriteInputTokens',
] as const;

type Metric = (typeof METRICS)[number];

const emptyStats = (date: string, userId: string): TokenUsageStats => ({
  date,
  userId,
  executions: { overall: 0 },
  inputTokens: { overall: 0 },
  outputTokens: { overall: 0 },
  cacheReadInputTokens: { overall: 0 },
  cacheWriteInputTokens: { overall: 0 },
});

/** Add `from` into `into`, key by key (`overall`, `model#...`, `usecase#...`). */
const addStats = (into: TokenUsageStats, from: TokenUsageStats): void => {
  for (const metric of METRICS) {
    for (const [key, value] of Object.entries(from[metric] ?? {})) {
      if (typeof value !== 'number') continue;
      into[metric][key] = (into[metric][key] ?? 0) + value;
    }
  }
};

/** Every date from `startDate` to `endDate` (YYYY-MM-DD, inclusive, UTC). */
export const datesInRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
};

/** One record per date with every user added together; days without use are zero. */
export const sumByDate = (
  dates: string[],
  records: TokenUsageStats[]
): TokenUsageStats[] => {
  const byDate = new Map(dates.map((date) => [date, emptyStats(date, '*')]));
  for (const record of records) {
    const day = byDate.get(record.date);
    if (day) addStats(day, record);
  }
  return [...byDate.values()];
};

const overall = (record: TokenUsageStats, metric: Metric) =>
  record[metric]?.overall ?? 0;

/** Each user's totals, largest token use first. */
export const totalsByUser = (
  records: TokenUsageStats[]
): UserTokenUsageTotals[] => {
  const byUser = new Map<string, UserTokenUsageTotals>();
  for (const record of records) {
    const totals = byUser.get(record.userId) ?? {
      userId: record.userId,
      executions: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
    };
    for (const metric of METRICS) {
      totals[metric] += overall(record, metric);
    }
    byUser.set(record.userId, totals);
  }
  return [...byUser.values()].sort(
    (a, b) =>
      b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens) ||
      a.userId.localeCompare(b.userId)
  );
};
