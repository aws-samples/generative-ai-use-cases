import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { format, subDays } from 'date-fns';
import useStat from '../hooks/useStat';
import useStatApi from '../hooks/useStatApi';
import Select from '../components/Select';

// The same periods as the admin page.
const RANGES = ['7', '30', '90'] as const;

const TokensTimeSeriesChart = lazy(
  () => import('../components/charts/TokensTimeSeriesChart')
);

const ModelExecutionsChart = lazy(
  () => import('../components/charts/ModelExecutionsChart')
);

const CostTimeSeriesChart = lazy(
  () => import('../components/charts/CostTimeSeriesChart')
);

const UsecaseDistributionChart = lazy(
  () => import('../components/charts/UsecaseDistributionChart')
);

const formatUsd = (value: number) =>
  value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const StatPage: React.FC = () => {
  const { t } = useTranslation();
  const { stats, isLoading, setLoading, setError, setStats } = useStat();
  const statApi = useStatApi();
  const [days, setDays] = useState<string>('7');

  useEffect(() => {
    // Ignore an older response when the period changes before it arrives.
    let cancelled = false;
    const fetchStats = async () => {
      setLoading(true);
      try {
        const endDate = new Date();
        const startDate = subDays(endDate, Number(days) - 1); // including today

        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');

        const data = await statApi.getTokenUsageByDateRange(
          formattedStartDate,
          formattedEndDate
        );
        if (!Array.isArray(data)) {
          throw new Error('Invalid response format');
        }
        if (cancelled) return;
        setStats(data);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to fetch stats:', error);
        setError(
          error instanceof Error ? error : new Error('Failed to fetch stats')
        );
        setStats([]); // Reset stats on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStats();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-6 text-center text-xl font-semibold">
        {t('stat.title')}
      </div>

      <div className="mb-6 flex justify-center">
        <Select
          label={t('admin.period')}
          value={days}
          options={RANGES.map((value) => ({
            value,
            label: t('admin.last_n_days', { days: value }),
          }))}
          onChange={setDays}
        />
      </div>

      {isLoading ? (
        <div className="text-center">{t('common.loading')}</div>
      ) : (
        <>
          <div className="mx-auto mb-6 w-fit rounded-lg border px-6 py-3 text-center">
            <div className="text-xs text-gray-500">{t('admin.cost')}</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatUsd(
                stats.reduce(
                  (sum, stat) => sum + (stat.estimatedCostUsd?.overall ?? 0),
                  0
                )
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {t('stat.estimated_cost_note')}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Suspense fallback={<div>{t('common.loading')}</div>}>
              <UsecaseDistributionChart
                data={stats}
                title={t('stat.usecase_distribution')}
              />
              <ModelExecutionsChart
                data={stats}
                title={t('stat.model_executions')}
              />
              <TokensTimeSeriesChart
                data={stats}
                title={t('stat.daily_token_usage')}
              />
              <CostTimeSeriesChart data={stats} title={t('stat.daily_cost')} />
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
};

export default StatPage;
