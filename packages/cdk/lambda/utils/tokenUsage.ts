import {
  ModelTokenUsageTotals,
  TokenUsageStats,
  UserTokenUsageTotals,
} from 'generative-ai-use-cases';
import { costOf, priceOf } from './modelPricing';

const METRICS = [
  'executions',
  'inputTokens',
  'outputTokens',
  'cacheReadInputTokens',
  'cacheWriteInputTokens',
] as const;

type Metric = (typeof METRICS)[number];
type Counts = Record<Metric, number>;

const MODEL_PREFIX = 'model#';

const zero = (): Counts => ({
  executions: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheWriteInputTokens: 0,
});

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

/** Per-model counts of one record (`model#<modelId>` keys). */
const modelCounts = (record: TokenUsageStats): Map<string, Counts> => {
  const byModel = new Map<string, Counts>();
  for (const metric of METRICS) {
    for (const [key, value] of Object.entries(record[metric] ?? {})) {
      if (!key.startsWith(MODEL_PREFIX) || typeof value !== 'number') continue;
      const modelId = key.slice(MODEL_PREFIX.length);
      const counts = byModel.get(modelId) ?? zero();
      counts[metric] += value;
      byModel.set(modelId, counts);
    }
  }
  return byModel;
};

/** Estimated cost of a record's priced models. */
const recordCost = (record: TokenUsageStats): number => {
  let cost = 0;
  for (const [modelId, counts] of modelCounts(record)) {
    const price = priceOf(modelId);
    if (price) cost += costOf(price, counts);
  }
  return cost;
};

/** Input, output, cache read and cache write tokens added together. */
export const totalTokens = (counts: Omit<Counts, 'executions'>): number =>
  counts.inputTokens +
  counts.outputTokens +
  counts.cacheReadInputTokens +
  counts.cacheWriteInputTokens;

const byTokens = (a: Counts, b: Counts) => totalTokens(b) - totalTokens(a);

/** The record with `estimatedCostUsd` (overall and per priced model) added. */
export const withEstimatedCost = (record: TokenUsageStats): TokenUsageStats => {
  const estimatedCostUsd: Record<string, number> & { overall: number } = {
    overall: 0,
  };
  for (const [modelId, counts] of modelCounts(record)) {
    const price = priceOf(modelId);
    if (!price) continue;
    const cost = costOf(price, counts);
    estimatedCostUsd[`${MODEL_PREFIX}${modelId}`] = cost;
    estimatedCostUsd.overall += cost;
  }
  return { ...record, estimatedCostUsd };
};

/** Each user's totals and estimated cost, most tokens first. */
export const totalsByUser = (
  records: TokenUsageStats[]
): UserTokenUsageTotals[] => {
  const byUser = new Map<string, UserTokenUsageTotals>();
  for (const record of records) {
    const totals = byUser.get(record.userId) ?? {
      userId: record.userId,
      ...zero(),
      estimatedCostUsd: 0,
      lastActiveDate: record.date,
    };
    for (const metric of METRICS) {
      totals[metric] += record[metric]?.overall ?? 0;
    }
    totals.estimatedCostUsd += recordCost(record);
    if (record.date > totals.lastActiveDate) {
      totals.lastActiveDate = record.date;
    }
    byUser.set(record.userId, totals);
  }
  return [...byUser.values()].sort(
    (a, b) => byTokens(a, b) || a.userId.localeCompare(b.userId)
  );
};

/** Each model's totals; models without a list price have no cost. */
export const totalsByModel = (
  records: TokenUsageStats[]
): ModelTokenUsageTotals[] => {
  const byModel = new Map<string, Counts>();
  for (const record of records) {
    for (const [modelId, counts] of modelCounts(record)) {
      const totals = byModel.get(modelId) ?? zero();
      for (const metric of METRICS) totals[metric] += counts[metric];
      byModel.set(modelId, totals);
    }
  }
  return [...byModel]
    .map(([modelId, counts]): ModelTokenUsageTotals => {
      const price = priceOf(modelId);
      return {
        modelId,
        ...counts,
        ...(price ? { estimatedCostUsd: costOf(price, counts) } : {}),
      };
    })
    .sort(
      (a, b) =>
        (b.estimatedCostUsd ?? -1) - (a.estimatedCostUsd ?? -1) ||
        byTokens(a, b) ||
        a.modelId.localeCompare(b.modelId)
    );
};
