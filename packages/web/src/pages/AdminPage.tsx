import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import {
  GetAdminTokenUsageResponse,
  UserTokenUsageTotals,
} from 'generative-ai-use-cases';
import Select from '../components/Select';
import Button from '../components/Button';
import useIsAdmin from '../hooks/useIsAdmin';
import useAdminApi from '../hooks/useAdminApi';

const TokensTimeSeriesChart = lazy(
  () => import('../components/charts/TokensTimeSeriesChart')
);
const ModelExecutionsChart = lazy(
  () => import('../components/charts/ModelExecutionsChart')
);
const UsecaseDistributionChart = lazy(
  () => import('../components/charts/UsecaseDistributionChart')
);

// The API reads at most 93 days per request.
const RANGES = ['7', '30', '90'] as const;

const COLUMNS: (keyof Omit<UserTokenUsageTotals, 'userId' | 'email'>)[] = [
  'executions',
  'inputTokens',
  'outputTokens',
  'cacheReadInputTokens',
  'cacheWriteInputTokens',
];

/** CSV of the per-user totals, for joining with user attributes elsewhere. */
const toCsv = (users: UserTokenUsageTotals[]): string => {
  const quote = (value: string | number | undefined) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = ['userId', 'email', ...COLUMNS].map(quote).join(',');
  const rows = users.map((user) =>
    [user.userId, user.email, ...COLUMNS.map((column) => user[column])]
      .map(quote)
      .join(',')
  );
  return [header, ...rows].join('\n');
};

const AdminPage: React.FC = () => {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const { getAdminTokenUsage } = useAdminApi();
  const [days, setDays] = useState<string>('7');
  const [usage, setUsage] = useState<GetAdminTokenUsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Suspense fallback={<div>{t('common.loading')}</div>}>
              <UsecaseDistributionChart
                data={usage.daily}
                title={t('stat.usecase_distribution')}
              />
              <ModelExecutionsChart
                data={usage.daily}
                title={t('stat.model_executions')}
              />
              <TokensTimeSeriesChart
                data={usage.daily}
                title={t('stat.daily_token_usage')}
              />
            </Suspense>
          </div>

          <div className="mt-8 overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="px-3 py-2">{t('admin.user')}</th>
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
                {usage.users.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-center" colSpan={6}>
                      {t('stat.no_data_available')}
                    </td>
                  </tr>
                )}
                {usage.users.map((user) => (
                  <tr key={user.userId} className="border-t">
                    <td className="px-3 py-2">
                      <div>{user.email ?? user.userId}</div>
                      {user.email && (
                        <div className="text-xs text-gray-500">
                          {user.userId}
                        </div>
                      )}
                    </td>
                    {COLUMNS.map((column) => (
                      <td key={column} className="px-3 py-2 text-right">
                        {user[column].toLocaleString()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {t('admin.scope_note')}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPage;
