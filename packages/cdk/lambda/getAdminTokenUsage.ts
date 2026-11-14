import { Request, Response } from 'express';
import { GetAdminTokenUsageResponse } from 'generative-ai-use-cases';
import { idTokenFromRequest, queryParams, sendJson } from './utils/http';
import { isSystemAdmin, verifyToken } from './utils/auth';
import { listTokenUsageForDate } from './repository';
import { datesInRange, sumByDate, totalsByUser } from './utils/tokenUsage';
import { getUserEmail } from './agentBuilder/utils/auth-utils';

/** Longest range one request may read (one query per day). */
export const MAX_DAYS = 93;
/** Users whose email is looked up per request; the rest show their user id. */
const MAX_EMAIL_LOOKUPS = 300;
const LOOKUP_CONCURRENCY = 10;

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
 * `GET /admin/token-usage?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`: every
 * user's token usage from the Stats table. Only members of the admin Cognito
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

  const records = (
    await mapLimit(dates, LOOKUP_CONCURRENCY, listTokenUsageForDate)
  ).flat();

  const users = totalsByUser(records);
  const looked = users.slice(0, MAX_EMAIL_LOOKUPS);
  const emails = await mapLimit(looked, LOOKUP_CONCURRENCY, (user) =>
    getUserEmail(user.userId)
  );
  looked.forEach((user, index) => {
    if (emails[index]) user.email = emails[index];
  });

  const body: GetAdminTokenUsageResponse = {
    daily: sumByDate(dates, records),
    users,
  };
  return sendJson(response, 200, body);
};
