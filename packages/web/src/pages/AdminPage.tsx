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
import {
  PiCaretDown,
  PiCaretUp,
  PiFunnel,
  PiMagnifyingGlass,
  PiX,
} from 'react-icons/pi';
import {
  GetAdminTokenUsageResponse,
  UserTokenUsageTotals,
} from 'generative-ai-use-cases';
import { modelMetadata } from '@generative-ai-use-cases/common';
import Select from '../components/Select';
import Button from '../components/Button';
import useIsAdmin from '../hooks/useIsAdmin';
import useAdminApi from '../hooks/useAdminApi';
import { toCsv } from '../utils/adminCsv';

const TokensTimeSeriesChart = lazy(
  () => import('../components/charts/TokensTimeSeriesChart')
);
const CostTimeSeriesChart = lazy(
  () => import('../components/charts/CostTimeSeriesChart')
);
const UsecaseDistributionChart = lazy(
  () => import('../components/charts/UsecaseDistributionChart')
);

// The API reads at most 93 days per request.
const RANGES = ['7', '30', '90'] as const;
// The API narrows the totals to at most this many users.
const MAX_FILTER_USERS = 50;
const PAGE_SIZE = 50;

type SortKey =
  | 'estimatedCostUsd'
  | 'executions'
  | 'tokens'
  | 'lastActiveDate'
  | 'user';

/** Input, output, cache read and cache write tokens added together. */
const tokensOf = (counts: {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheWriteInputTokens: number;
}) =>
  counts.inputTokens +
  counts.outputTokens +
  counts.cacheReadInputTokens +
  counts.cacheWriteInputTokens;

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
  // Users ticked in the table, and the users the totals are narrowed to.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterUserIds, setFilterUserIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
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
    if (isAdmin !== true) return;
    let cancelled = false;
    const { startDate, endDate } = range();
    setLoading(true);
    setFailed(false);
    getAdminTokenUsage(startDate, endDate, filterUserIds)
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
  }, [isAdmin, days, filterUserIds]);

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

  useEffect(() => setPage(0), [usage, search, sort]);
  const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const pageUsers = users.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSelected = (userIds: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of userIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const pageAllSelected =
    pageUsers.length > 0 && pageUsers.every((u) => selected.has(u.userId));

  const applyFilter = () => {
    setFilterUserIds([...selected]);
    setSelected(new Set());
  };
  const clearFilter = () => {
    setFilterUserIds([]);
    setSelected(new Set());
  };

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

  // The admin group is read from the id token; others are sent home. Wait
  // for the session first, so reloading /admin does not redirect an admin.
  if (isAdmin === undefined) {
    return <div className="py-6 text-center">{t('common.loading')}</div>;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const modelName = (modelId: string) =>
    modelMetadata[modelId]?.displayName ?? modelId;
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
          {filterUserIds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
              <PiFunnel />
              <span>
                {t('admin.filtered_to_users', {
                  users: filterUserIds.length,
                })}
              </span>
              <button
                className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                onClick={clearFilter}>
                <PiX />
                {t('admin.clear_filter')}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card
              label={t('admin.cost')}
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
            <div className="flex flex-wrap items-center gap-2">
              {selected.size > 0 && (
                <>
                  <Button
                    outlined
                    disabled={selected.size > MAX_FILTER_USERS}
                    onClick={applyFilter}>
                    {t('admin.filter_selected', { users: selected.size })}
                  </Button>
                  {selected.size > MAX_FILTER_USERS && (
                    <span className="text-xs text-red-600">
                      {t('admin.too_many_selected', {
                        max: MAX_FILTER_USERS,
                      })}
                    </span>
                  )}
                </>
              )}
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
          </div>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={t('admin.select_page')}
                      checked={pageAllSelected}
                      onChange={(event) =>
                        toggleSelected(
                          pageUsers.map((u) => u.userId),
                          event.target.checked
                        )
                      }
                    />
                  </th>
                  <SortHeader
                    label={t('admin.user')}
                    column="user"
                    sort={sort}
                    onSort={onSort}
                  />
                  <SortHeader
                    label={t('admin.cost')}
                    column="estimatedCostUsd"
                    sort={sort}
                    onSort={onSort}
                    right
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
                    <td className="px-3 py-4 text-center" colSpan={6}>
                      {t('stat.no_data_available')}
                    </td>
                  </tr>
                )}
                {pageUsers.map((user) => (
                  <tr key={user.userId} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={user.email ?? user.userId}
                        checked={selected.has(user.userId)}
                        onChange={(event) =>
                          toggleSelected([user.userId], event.target.checked)
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div>{user.email ?? user.userId}</div>
                      {user.email && (
                        <div className="text-xs text-gray-500">
                          {user.userId}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {usd(user.estimatedCostUsd)}
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

          {users.length > PAGE_SIZE && (
            <div className="mt-2 flex items-center justify-end gap-2 text-sm">
              <span className="text-gray-500">
                {t('admin.page_range', {
                  from: page * PAGE_SIZE + 1,
                  to: Math.min((page + 1) * PAGE_SIZE, users.length),
                  total: users.length,
                })}
              </span>
              <Button
                outlined
                disabled={page === 0}
                onClick={() => setPage(page - 1)}>
                {t('admin.previous')}
              </Button>
              <Button
                outlined
                disabled={page >= pageCount - 1}
                onClick={() => setPage(page + 1)}>
                {t('admin.next')}
              </Button>
            </div>
          )}

          <div className="mb-2 mt-8 font-semibold">
            {t('admin.models_heading')}
          </div>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="px-3 py-2">{t('admin.model')}</th>
                  <th className="px-3 py-2 text-right">{t('admin.cost')}</th>
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
                  <th className="px-3 py-2 text-right">
                    {t('stat.cache_write_tokens')}
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
                    <td className="px-3 py-2 text-right tabular-nums">
                      {model.cacheWriteInputTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Suspense fallback={<div>{t('common.loading')}</div>}>
              <CostTimeSeriesChart
                data={usage.daily}
                title={t('stat.daily_cost')}
              />
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
