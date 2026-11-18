import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { modelMetadata } from '@generative-ai-use-cases/common';
import { ChartProps } from './types';

const COLORS = [
  '#ff9900',
  '#2196f3',
  '#4caf50',
  '#9c27b0',
  '#f44336',
  '#00bcd4',
  '#795548',
];
const MODEL_PREFIX = 'model#';
// The rest of the models are added up as "other".
const MAX_SERIES = 6;
const OTHER = '__other__';

const usd = (value: number) =>
  `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  })}`;

/** Estimated cost per day, stacked by model. */
const CostTimeSeriesChart: React.FC<ChartProps> = ({
  data,
  title,
  description,
}) => {
  const { t } = useTranslation();

  const { rows, series } = useMemo(() => {
    const totals = new Map<string, number>();
    for (const stat of data) {
      for (const [key, value] of Object.entries(stat.estimatedCostUsd ?? {})) {
        if (!key.startsWith(MODEL_PREFIX)) continue;
        totals.set(key, (totals.get(key) ?? 0) + value);
      }
    }
    const ranked = [...totals]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);
    const shown = ranked.slice(0, MAX_SERIES);
    const hasOther = ranked.length > MAX_SERIES;
    const rows = data.map((stat) => {
      const row: Record<string, number | string> = {
        date: format(new Date(stat.date), 'MM/dd'),
      };
      let other = 0;
      for (const [key, value] of Object.entries(stat.estimatedCostUsd ?? {})) {
        if (!key.startsWith(MODEL_PREFIX)) continue;
        if (shown.includes(key)) row[key] = value;
        else other += value;
      }
      if (hasOther) row[OTHER] = other;
      return row;
    });
    return { rows, series: hasOther ? [...shown, OTHER] : shown };
  }, [data]);

  const label = (key: string) =>
    key === OTHER
      ? t('stat.other_models')
      : (modelMetadata[key.slice(MODEL_PREFIX.length)]?.displayName ??
        key.slice(MODEL_PREFIX.length));

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="mb-2 font-semibold">{title}</div>
      {description && (
        <div className="mb-4 text-sm text-gray-600">{description}</div>
      )}
      {series.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="text-gray-500">{t('stat.no_data_available')}</div>
        </div>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value: number) => `$${value}`} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  usd(value),
                  label(name),
                ]}
              />
              <Legend formatter={label} />
              {series.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key}
                  stackId="cost"
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default CostTimeSeriesChart;
