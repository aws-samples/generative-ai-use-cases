import { TokenUsageStats } from 'generative-ai-use-cases';
import { invokeHandler } from './api/testApp';
import { handler, MAX_DAYS } from '../../lambda/getAdminTokenUsage';
import { listTokenUsageForDate } from '../../lambda/repository';
import { verifyToken } from '../../lambda/utils/auth';
import { getUserEmail } from '../../lambda/agentBuilder/utils/auth-utils';

jest.mock('../../lambda/repository');
jest.mock('../../lambda/agentBuilder/utils/auth-utils');
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
  mocked(getUserEmail).mockImplementation(async (id) => `${id}@example.com`);
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
    mocked(getUserEmail).mockResolvedValue(undefined);
    const res = await call({ startDate: '2026-11-01', endDate: '2026-11-01' });
    expect(JSON.parse(res.body).users).toEqual([
      expect.not.objectContaining({ email: expect.anything() }),
    ]);
  });
});
