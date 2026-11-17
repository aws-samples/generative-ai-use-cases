import { Request, Response } from 'express';
import { GetAdminTokenUsageResponse } from 'generative-ai-use-cases';
import { idTokenFromRequest, queryParams, sendJson } from './utils/http';
import { isSystemAdmin, verifyToken } from './utils/auth';
import { listTokenUsageForDate } from './repository';
import {
  datesInRange,
  sumByDate,
  totalsByModel,
  totalsByUser,
  withEstimatedCost,
} from './utils/tokenUsage';
import { MODEL_PRICING_DATE } from './utils/modelPricing';
import { getUserEmail } from './agentBuilder/utils/auth-utils';

/** Longest range one request may read (one query per day). */
export const MAX_DAYS = 93;
/** Most users one request may narrow the totals to (`userIds`). */
export const MAX_FILTER_USERS = 50;
/** Calls in flight to DynamoDB and to Cognito. */
const LOOKUP_CONCURRENCY = 10;
/** Emails are kept this long, so changing the period does not look them up again. */
const EMAIL_CACHE_TTL_MS = 10 * 60 * 1000;

const emailCache = new Map<
  string,
  { email: string | undefined; expiresAt: number }
>();

const lookupEmail = async (userId: string): Promise<string | undefined> => {
  const cached = emailCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.email;
  const email = await getUserEmail(userId);
  emailCache.set(userId, { email, expiresAt: Date.now() + EMAIL_CACHE_TTL_MS });
  return email;
};

/** Only for tests. */
export const clearEmailCache = (): void => emailCache.clear();

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isValidDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  DATE.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

/** Run `fn` over `items` with at most `limit` calls in flight. */
const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
};

/**
 * `GET /admin/token-usage?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD[&userIds=a,b]`:
 * every user's token usage from the Stats table. With `userIds`, every total
 * (daily, per user, per model, cost) counts only those users. Only members of the admin Cognito
 * group, read from the verified id token, may call it.
 */
export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const payload = await verifyToken(idTokenFromRequest(request) ?? '');
  if (!payload) {
    return sendJson(response, 401, { message: 'Unauthorized' });
  }
  if (!isSystemAdmin(payload)) {
    return sendJson(response, 403, { message: 'Forbidden' });
  }

  const { startDate, endDate } = queryParams(request);
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return sendJson(response, 400, {
      message: 'startDate and endDate must be YYYY-MM-DD',
    });
  }
  const dates = datesInRange(startDate, endDate);
  if (dates.length === 0 || dates.length > MAX_DAYS) {
    return sendJson(response, 400, {
      message: `The range must be 1 to ${MAX_DAYS} days`,
    });
  }

  const userIds = (queryParams(request).userIds ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (userIds.length > MAX_FILTER_USERS) {
    return sendJson(response, 400, {
      message: `At most ${MAX_FILTER_USERS} users can be selected`,
    });
  }
  const only = userIds.length > 0 ? new Set(userIds) : undefined;

  // Each day is one query, paged by listTokenUsageForDate.
  const records = (
    await mapLimit(dates, LOOKUP_CONCURRENCY, listTokenUsageForDate)
  )
    .flat()
    .filter((record) => !only || only.has(record.userId));

  const users = totalsByUser(records);
  const emails = await mapLimit(users, LOOKUP_CONCURRENCY, (user) =>
    lookupEmail(user.userId)
  );
  users.forEach((user, index) => {
    if (emails[index]) user.email = emails[index];
  });

  const models = totalsByModel(records);
  const body: GetAdminTokenUsageResponse = {
    daily: sumByDate(dates, records).map(withEstimatedCost),
    users,
    models,
    estimatedCostUsd: models.reduce(
      (sum, model) => sum + (model.estimatedCostUsd ?? 0),
      0
    ),
    pricingDate: MODEL_PRICING_DATE,
  };
  return sendJson(response, 200, body);
};
