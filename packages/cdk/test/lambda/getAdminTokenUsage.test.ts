import { TokenUsageStats } from 'generative-ai-use-cases';
import { invokeHandler } from './api/testApp';
import {
  clearEmailCache,
  handler,
  MAX_DAYS,
  MAX_FILTER_USERS,
} from '../../lambda/getAdminTokenUsage';
import { listTokenUsageForDate } from '../../lambda/repository';
import { verifyToken } from '../../lambda/utils/auth';
import { resetConfiguredRegions } from '../../lambda/utils/modelPricing';
import { MODEL_PRICING } from '../../lambda/utils/modelPricing.generated';

jest.mock('../../lambda/repository');

// Cognito: AdminGetUser answers from `emailFor`; ListUsers pages 60 at a time
// over `poolUsers`.
const cognitoSend = jest.fn();
let poolUsers: string[] = [];
const emailFor = jest.fn(
  async (id: string): Promise<string | undefined> => `${id}@example.com`
);
jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const actual = jest.requireActual(
    '@aws-sdk/client-cognito-identity-provider'
  );
  return {
    ...actual,
    CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({
      send: (...args: unknown[]) => cognitoSend(...args),
    })),
  };
});
jest.mock('../../lambda/utils/auth', () => ({
  ...jest.requireActual('../../lambda/utils/auth'),
  verifyToken: jest.fn(),
}));

const mocked = <T extends (...args: never[]) => unknown>(fn: T) =>
  fn as unknown as jest.MockedFunction<T>;

const stats = (
  date: string,
  userId: string,
  input: number,
  output: number,
  model = 'm1'
): TokenUsageStats => ({
  date,
  userId,
  executions: { overall: 1, [`model#${model}`]: 1 },
  inputTokens: { overall: input, [`model#${model}`]: input },
  outputTokens: { overall: output, [`model#${model}`]: output },
  cacheReadInputTokens: { overall: 0 },
  cacheWriteInputTokens: { overall: 0 },
});

const admin = { 'cognito:groups': ['SystemAdminGroup'], sub: 's' };

const call = (query: Record<string, string>) =>
  invokeHandler(handler, {
    user: 'admin',
    query,
    headers: { authorization: 'Bearer token' },
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mocked(verifyToken).mockResolvedValue(admin as never);
  mocked(listTokenUsageForDate).mockResolvedValue([]);
  poolUsers = [];
  emailFor.mockImplementation(async (id: string) => `${id}@example.com`);
  cognitoSend.mockImplementation(
    async (command: {
      constructor: { name: string };
      input: Record<string, string>;
    }) => {
      if (command.constructor.name === 'AdminGetUserCommand') {
        const email = await emailFor(command.input.Username);
        return {
          UserAttributes: email ? [{ Name: 'email', Value: email }] : [],
        };
      }
      const start = Number(command.input.PaginationToken ?? 0);
      const page = poolUsers.slice(start, start + 60);
      return {
        Users: await Promise.all(
          page.map(async (id) => ({
            Username: id,
            Attributes: [{ Name: 'email', Value: await emailFor(id) }],
          }))
        ),
        PaginationToken:
          start + 60 < poolUsers.length ? String(start + 60) : undefined,
      };
    }
  );
  clearEmailCache();
  process.env.MODEL_REGION = 'us-east-1';
  process.env.MODEL_IDS = '[]';
  resetConfiguredRegions();
});

describe('GET /admin/token-usage', () => {
  test('rejects a request without a valid id token', async () => {
    mocked(verifyToken).mockResolvedValue(undefined);
    const res = await call({ startDate: '2026-11-01', endDate: '2026-11-02' });
    expect(res.statusCode).toBe(401);
    expect(listTokenUsageForDate).not.toHaveBeenCalled();
  });

  test.each([
    ['no groups', { sub: 's' }],
    ['other groups', { sub: 's', 'cognito:groups': ['Sales'] }],
  ])('rejects a caller with %s', async (_name, payload) => {
    mocked(verifyToken).mockResolvedValue(payload as never);
    const res = await call({ startDate: '2026-11-01', endDate: '2026-11-02' });
    expect(res.statusCode).toBe(403);
    expect(listTokenUsageForDate).not.toHaveBeenCalled();
  });

  test.each([
    ['missing dates', {}],
    ['a bad format', { startDate: '2026/11/01', endDate: '2026-11-02' }],
    ['an impossible date', { startDate: '2026-02-30', endDate: '2026-03-01' }],
    ['start after end', { startDate: '2026-11-02', endDate: '2026-11-01' }],
    ['a too long range', { startDate: '2026-01-01', endDate: '2026-12-31' }],
  ])('rejects %s with 400', async (_name, query) => {
    const res = await call(query as Record<string, string>);
    expect(res.statusCode).toBe(400);
    expect(listTokenUsageForDate).not.toHaveBeenCalled();
  });

  test('adds every user per day and per user', async () => {
    mocked(listTokenUsageForDate).mockImplementation(async (date) =>
      date === '2026-11-01'
        ? [stats(date, 'alice', 10, 1), stats(date, 'bob', 100, 10, 'm2')]
        : [stats(date, 'alice', 5, 1)]
    );
    const res = await call({ startDate: '2026-11-01', endDate: '2026-11-03' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(listTokenUsageForDate).toHaveBeenCalledTimes(3);
    expect(body.daily.map((d: TokenUsageStats) => d.date)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
    expect(body.daily[0].inputTokens).toEqual({
      overall: 110,
      'model#m1': 10,
      'model#m2': 100,
    });
    expect(body.daily[1].executions.overall).toBe(1);

    expect(body.users).toEqual([
      expect.objectContaining({
        userId: 'bob',
        email: 'bob@example.com',
        inputTokens: 100,
        outputTokens: 10,
        executions: 1,
      }),
      expect.objectContaining({
        userId: 'alice',
        email: 'alice@example.com',
        inputTokens: 20,
        outputTokens: 3,
        executions: 3,
      }),
    ]);
  });

  test('estimates the cost of priced models and lists unpriced ones', async () => {
    const opus = 'global.anthropic.claude-opus-5-5';
    mocked(listTokenUsageForDate).mockResolvedValue([
      stats('2026-11-01', 'alice', 1000, 2000, opus),
      stats('2026-11-01', 'bob', 500, 500, 'unknown.model'),
    ]);
    const res = await call({ startDate: '2026-11-01', endDate: '2026-11-01' });
    const body = JSON.parse(res.body);
    const price = MODEL_PRICING['us-east-1']['Claude Opus 5.5'].global!;
    const expected =
      (1000 * price.inputPer1k + 2000 * price.outputPer1k) / 1000;

    expect(body.estimatedCostUsd).toBeCloseTo(expected, 10);
    expect(body.daily[0].estimatedCostUsd.overall).toBeCloseTo(expected, 10);
    expect(body.daily[0].estimatedCostUsd[`model#${opus}`]).toBeCloseTo(
      expected,
      10
    );
    expect(body.daily[0].estimatedCostUsd).not.toHaveProperty(
      'model#unknown.model'
    );
    expect(body.pricingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.models).toEqual([
      expect.objectContaining({ modelId: opus, estimatedCostUsd: expected }),
      expect.not.objectContaining({ estimatedCostUsd: expect.anything() }),
    ]);
    const alice = body.users.find(
      (u: { userId: string }) => u.userId === 'alice'
    );
    const bob = body.users.find((u: { userId: string }) => u.userId === 'bob');
    expect(alice.estimatedCostUsd).toBeCloseTo(expected, 10);
    expect(alice.lastActiveDate).toBe('2026-11-01');
    expect(bob.estimatedCostUsd).toBe(0);
  });

  test('narrows every total to the selected users', async () => {
    mocked(listTokenUsageForDate).mockResolvedValue([
      stats('2026-11-01', 'alice', 10, 1, 'm1'),
      stats('2026-11-01', 'bob', 100, 10, 'm2'),
      stats('2026-11-01', 'carol', 1000, 100, 'm3'),
    ]);
    const res = await call({
      startDate: '2026-11-01',
      endDate: '2026-11-01',
      userIds: 'alice,carol',
    });
    const body = JSON.parse(res.body);
    expect(body.users.map((u: { userId: string }) => u.userId)).toEqual([
      'carol',
      'alice',
    ]);
    expect(
      body.models.map((m: { modelId: string }) => m.modelId).sort()
    ).toEqual(['m1', 'm3']);
    expect(body.daily[0].inputTokens.overall).toBe(1010);
    expect(body.daily[0].executions.overall).toBe(2);
  });

  test('rejects more selected users than allowed', async () => {
    const userIds = Array.from(
      { length: MAX_FILTER_USERS + 1 },
      (_, i) => `u${i}`
    ).join(',');
    const res = await call({
      startDate: '2026-11-01',
      endDate: '2026-11-01',
      userIds,
    });
    expect(res.statusCode).toBe(400);
  });

  test('orders users by all four token kinds', async () => {
    const withCache = stats('2026-11-01', 'cached', 1, 1);
    withCache.cacheReadInputTokens.overall = 10000;
    mocked(listTokenUsageForDate).mockResolvedValue([
      stats('2026-11-01', 'plain', 1000, 1000),
      withCache,
    ]);
    const res = await call({ startDate: '2026-11-01', endDate: '2026-11-01' });
    expect(
      JSON.parse(res.body).users.map((u: { userId: string }) => u.userId)
    ).toEqual(['cached', 'plain']);
  });

  test('looks up few users one by one, at most 10 at a time', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `user${i}`);
    mocked(listTokenUsageForDate).mockImplementation(async (date) =>
      ids.map((id) => stats(date, id, 10, 1))
    );
    let inFlight = 0;
    let peak = 0;
    emailFor.mockImplementation(async (id: string) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return `${id}@example.com`;
    });

    const res = await call({ startDate: '2026-10-01', endDate: '2026-10-30' });
    const body = JSON.parse(res.body);

    expect(body.users).toHaveLength(100);
    expect(body.users.every((u: { email?: string }) => u.email)).toBe(true);
    expect(cognitoSend).toHaveBeenCalledTimes(100);
    expect(peak).toBeLessThanOrEqual(10);
  });

  test.each([500, 2000])(
    'reads %i users in bulk with ListUsers',
    async (count) => {
      const ids = Array.from({ length: count }, (_, i) => `user${i}`);
      poolUsers = [...ids, 'inactive-user'];
      mocked(listTokenUsageForDate).mockImplementation(async (date) =>
        ids.map((id) => stats(date, id, 10, 1))
      );

      const res = await call({
        startDate: '2026-10-01',
        endDate: '2026-10-30',
      });
      const body = JSON.parse(res.body);

      expect(res.statusCode).toBe(200);
      expect(body.users).toHaveLength(count);
      expect(body.users.every((u: { email?: string }) => u.email)).toBe(true);
      expect(cognitoSend).toHaveBeenCalledTimes(
        Math.ceil(poolUsers.length / 60)
      );
      expect(body.daily).toHaveLength(30);
      expect(body.daily[0].executions.overall).toBe(count);
      // The web client reads this in one response; keep it well under the
      // API Gateway payload limit.
      expect(res.body.length).toBeLessThan(6_000_000);
    }
  );

  test('does not cache a failed lookup', async () => {
    mocked(listTokenUsageForDate).mockResolvedValue([
      stats('2026-11-01', 'alice', 1, 1),
    ]);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    emailFor.mockRejectedValueOnce(new Error('TooManyRequests'));
    const first = await call({
      startDate: '2026-11-01',
      endDate: '2026-11-01',
    });
    expect(JSON.parse(first.body).users[0].email).toBe(undefined);
    const second = await call({
      startDate: '2026-11-01',
      endDate: '2026-11-01',
    });
    expect(JSON.parse(second.body).users[0].email).toBe('alice@example.com');
  });

  test('reuses looked-up emails on the next request', async () => {
    mocked(listTokenUsageForDate).mockResolvedValue([
      stats('2026-11-01', 'alice', 1, 1),
    ]);
    await call({ startDate: '2026-11-01', endDate: '2026-11-01' });
    await call({ startDate: '2026-11-01', endDate: '2026-11-01' });
    expect(cognitoSend).toHaveBeenCalledTimes(1);
  });

  test('accepts the longest allowed range', async () => {
    const start = new Date(Date.UTC(2026, 0, 1));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + MAX_DAYS - 1);
    const res = await call({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    });
    expect(res.statusCode).toBe(200);
    expect(listTokenUsageForDate).toHaveBeenCalledTimes(MAX_DAYS);
  });

  test('keeps a user whose email cannot be looked up', async () => {
    mocked(listTokenUsageForDate).mockResolvedValue([
      stats('2026-11-01', 'gone', 1, 1),
    ]);
    emailFor.mockResolvedValue(undefined);
    const res = await call({ startDate: '2026-11-01', endDate: '2026-11-01' });
    expect(JSON.parse(res.body).users).toEqual([
      expect.not.objectContaining({ email: expect.anything() }),
    ]);
  });
});
