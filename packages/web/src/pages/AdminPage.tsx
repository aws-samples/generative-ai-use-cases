import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { PiCaretDown, PiCaretUp, PiMagnifyingGlass } from 'react-icons/pi';
import {
  GetAdminTokenUsageResponse,
  UserTokenUsageTotals,
} from 'generative-ai-use-cases';
import { modelMetadata } from '@generative-ai-use-cases/common';
import Select from '../components/Select';
import Button from '../components/Button';
import useIsAdmin from '../hooks/useIsAdmin';
import useAdminApi from '../hooks/useAdminApi';

const TokensTimeSeriesChart = lazy(
  () => import('../components/charts/TokensTimeSeriesChart')
);
const UsecaseDistributionChart = lazy(
  () => import('../components/charts/UsecaseDistributionChart')
);

// The API reads at most 93 days per request.
const RANGES = ['7', '30', '90'] as const;

type SortKey =
  | 'estimatedCostUsd'
  | 'executions'
  | 'tokens'
  | 'lastActiveDate'
  | 'user';

const tokensOf = (user: { inputTokens: number; outputTokens: number }) =>
  user.inputTokens + user.outputTokens;

const usd = (value: number) =>
  `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  })}`;

const compactNumber = (value: number) =>
  value.toLocaleString(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

const CSV_COLUMNS = [
  'executions',
  'inputTokens',
  'outputTokens',
  'cacheReadInputTokens',
  'cacheWriteInputTokens',
  'estimatedCostUsd',
  'lastActiveDate',
] as const;

/** CSV of the per-user totals, for joining with user attributes elsewhere. */
const toCsv = (users: UserTokenUsageTotals[]): string => {
  const quote = (value: string | number | undefined) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = ['userId', 'email', ...CSV_COLUMNS].map(quote).join(',');
  const rows = users.map((user) =>
    [user.userId, user.email, ...CSV_COLUMNS.map((column) => user[column])]
      .map(quote)
      .join(',')
  );
  return [header, ...rows].join('\n');
};

const Card: React.FC<{ label: string; value: string; note?: string }> = (
  props
) => (
  <div className="rounded-lg border px-4 py-3">
    <div className="text-xs text-gray-500">{props.label}</div>
    <div className="mt-1 text-2xl font-semibold">{props.value}</div>
    {props.note && (
      <div className="mt-1 text-xs text-gray-500">{props.note}</div>
    )}
  </div>
);

const SortHeader: React.FC<{
  label: string;
  column: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
  right?: boolean;
}> = (props) => (
  <th className={`px-3 py-2 ${props.right ? 'text-right' : ''}`}>
    <button
      className="inline-flex items-center gap-1 hover:underline"
      onClick={() => props.onSort(props.column)}>
      {props.label}
      {props.sort.key === props.column &&
        (props.sort.desc ? <PiCaretDown /> : <PiCaretUp />)}
    </button>
  </th>
);

const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const { getAdminTokenUsage } = useAdminApi();
  const [days, setDays] = useState<string>('7');
  const [usage, setUsage] = useState<GetAdminTokenUsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'estimatedCostUsd',
    desc: true,
  });

  const range = useCallback(() => {
    const end = new Date();
    const start = subDays(end, Number(days) - 1);
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    };
  }, [days]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const { startDate, endDate } = range();
    setLoading(true);
    setFailed(false);
    getAdminTokenUsage(startDate, endDate)
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setUsage(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, days]);

  const totals = useMemo(() => {
    const users = usage?.users ?? [];
    return {
      activeUsers: users.length,
      executions: users.reduce((sum, user) => sum + user.executions, 0),
      tokens: users.reduce((sum, user) => sum + tokensOf(user), 0),
      unpriced: (usage?.models ?? []).filter(
        (model) => model.estimatedCostUsd === undefined
      ),
    };
  }, [usage]);

  const users = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = (usage?.users ?? []).filter((user) =>
      words.every((word) =>
        `${user.email ?? ''} ${user.userId}`.toLowerCase().includes(word)
      )
    );
    const value = (user: UserTokenUsageTotals): number | string => {
      switch (sort.key) {
        case 'tokens':
          return tokensOf(user);
        case 'user':
          return user.email ?? user.userId;
        default:
          return user[sort.key];
      }
    };
    return [...filtered].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const order =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y));
      return sort.desc ? -order : order;
    });
  }, [usage, search, sort]);

  const onSort = useCallback((key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : { key, desc: key !== 'user' }
    );
  }, []);

  const downloadCsv = useCallback(() => {
    if (!usage) return;
    const { startDate, endDate } = range();
    // BOM so that Excel opens the UTF-8 file correctly.
    const blob = new Blob(['\uFEFF' + toCsv(usage.users)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `genu-token-usage-${startDate}-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [usage, range]);

  // The admin group is read from the id token; others are sent home.
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const modelName = (modelId: string) =>
    modelMetadata[modelId]?.displayName ?? modelId;
  const maxCost = Math.max(
    ...(usage?.users ?? []).map((user) => user.estimatedCostUsd),
    0
  );

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-2 text-center text-xl font-semibold">
        {t('admin.title')}
      </div>
      <div className="mb-6 text-center text-sm text-gray-500">
        {t('admin.description')}
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <Select
          label={t('admin.period')}
          value={days}
          options={RANGES.map((value) => ({
            value,
            label: t('admin.last_n_days', { days: value }),
          }))}
          onChange={setDays}
        />
        <Button outlined disabled={!usage} onClick={downloadCsv}>
          {t('admin.download_csv')}
        </Button>
      </div>

      {loading && <div className="text-center">{t('common.loading')}</div>}
      {!loading && failed && (
        <div className="text-center text-red-500">{t('admin.load_failed')}</div>
      )}

      {!loading && usage && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card
              label={t('admin.estimated_cost')}
              value={usd(usage.estimatedCostUsd)}
              note={t('admin.pricing_note', { date: usage.pricingDate })}
            />
            <Card
              label={t('admin.active_users')}
              value={totals.activeUsers.toLocaleString()}
            />
            <Card
              label={t('admin.executions')}
              value={totals.executions.toLocaleString()}
            />
            <Card
              label={t('admin.tokens')}
              value={compactNumber(totals.tokens)}
            />
          </div>
          {totals.unpriced.length > 0 && (
            <div className="mt-2 text-xs text-amber-700">
              {t('admin.unpriced_models', {
                models: totals.unpriced
                  .map((model) => modelName(model.modelId))
                  .join(', '),
              })}
            </div>
          )}

          <div className="mb-2 mt-8 flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">{t('admin.users_heading')}</div>
            <div className="relative">
              <PiMagnifyingGlass className="absolute left-2 top-2.5 text-gray-400" />
              <input
                className="rounded border py-1.5 pl-7 pr-2 text-sm"
                value={search}
                placeholder={t('admin.search_users')}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <SortHeader
                    label={t('admin.user')}
                    column="user"
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeader
                    label={t('admin.estimated_cost')}
                    column="estimatedCostUsd"
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeader
                    label={t('admin.executions')}
                    column="executions"
                    sort={sort}
                    onSort={onSort}
                    right
                  />
                  <SortHeader
                    label={t('admin.tokens')}
                    column="tokens"
                    sort={sort}
                    onSort={onSort}
                    right
                  />
                  <SortHeader
                    label={t('admin.last_active')}
                    column="lastActiveDate"
                    sort={sort}
                    onSort={onSort}
                    right
                  />
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center" colSpan={5}>
                      {t('stat.no_data_available')}
                    </td>
                  </tr>
                )}
                {users.map((user) => (
                  <tr key={user.userId} className="border-t">
                    <td className="px-3 py-2">
                      <div>{user.email ?? user.userId}</div>
                      {user.email && (
                        <div className="text-xs text-gray-500">
                          {user.userId}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded bg-gray-100">
                          <div
                            className="bg-aws-smile h-2 rounded"
                            style={{
                              width: `${maxCost > 0 ? (user.estimatedCostUsd / maxCost) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="tabular-nums">
                          {usd(user.estimatedCostUsd)}
                        </span>
                        {usage.estimatedCostUsd > 0 && (
                          <span className="text-xs text-gray-500">
                            {(
                              user.estimatedCostUsd / usage.estimatedCostUsd
                            ).toLocaleString(undefined, {
                              style: 'percent',
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {user.executions.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {tokensOf(user).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {user.lastActiveDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-2 mt-8 font-semibold">
            {t('admin.models_heading')}
          </div>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="px-3 py-2">{t('admin.model')}</th>
                  <th className="px-3 py-2 text-right">
                    {t('admin.estimated_cost')}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t('admin.executions')}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t('stat.input_tokens')}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t('stat.output_tokens')}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t('stat.cache_read_tokens')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {usage.models.map((model) => (
                  <tr key={model.modelId} className="border-t">
                    <td className="px-3 py-2">
                      <div>{modelName(model.modelId)}</div>
                      <div className="text-xs text-gray-500">
                        {model.modelId}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {model.estimatedCostUsd === undefined
                        ? t('admin.no_price')
                        : usd(model.estimatedCostUsd)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {model.executions.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {model.inputTokens.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {model.outputTokens.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {model.cacheReadInputTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Suspense fallback={<div>{t('common.loading')}</div>}>
              <TokensTimeSeriesChart
                data={usage.daily}
                title={t('stat.daily_token_usage')}
              />
              <UsecaseDistributionChart
                data={usage.daily}
                title={t('stat.usecase_distribution')}
              />
            </Suspense>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            {t('admin.scope_note')}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {t('admin.cost_note')}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPage;
