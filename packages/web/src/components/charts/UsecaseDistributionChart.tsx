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
import { ChartProps } from './types';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

const COLORS = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
];

interface UsecaseData {
  date: string;
  [key: string]: number | string; // Execution count for each usecase
}

const UsecaseDistributionChart: React.FC<ChartProps> = ({
  data,
  title,
  description,
  options = {},
}) => {
  const { t } = useTranslation();
  const { chartData, usecases } = useMemo(() => {
    // Aggregate execution count for each usecase by date
    const dailyData = data.map((stat) => {
      const dailyStats: UsecaseData = {
        date: format(new Date(stat.date), 'MM/dd'),
      };

      Object.entries(stat.executions || {}).forEach(([key, value]) => {
        if (key.startsWith('usecase#')) {
          const usecase = key.replace('usecase#', '');
          dailyStats[usecase] = value;
        }
      });

      return dailyStats;
    });

    // Get all usecases that appeared during the entire period
    const allUsecases = Array.from(
      new Set(
        data.flatMap((stat) =>
          Object.keys(stat.executions || {})
            .filter((key) => key.startsWith('usecase#'))
            .map((key) => key.replace('usecase#', ''))
        )
      )
    ).sort();

    // Initialize execution count for usecases that do not exist
    dailyData.forEach((daily) => {
      allUsecases.forEach((usecase) => {
        if (!(usecase in daily)) {
          daily[usecase] = 0;
        }
      });
    });

    return {
      chartData: dailyData,
      usecases: allUsecases,
    };
  }, [data]);

  const { legend = true, tooltip = true, colors = COLORS } = options;

  if (data.length === 0 || chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <div className="text-gray-500">{t('stat.no_data_available')}</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="mb-2 font-semibold">{title}</div>
      {description && (
        <div className="mb-4 text-sm text-gray-600">{description}</div>
      )}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            {tooltip && (
              <Tooltip
                formatter={(value: number, name: string) => {
                  return [`${value.toLocaleString()}`, name];
                }}
              />
            )}
            {legend && <Legend />}
            {usecases.map((usecase, index) => (
              <Bar
                key={usecase}
                dataKey={usecase}
                name={usecase}
                stackId="a"
                fill={colors[index % colors.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default UsecaseDistributionChart;
