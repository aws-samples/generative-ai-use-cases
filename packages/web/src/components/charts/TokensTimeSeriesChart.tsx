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

// Blue color for input, green for output
const COLORS = ['#2196f3', '#90caf9', '#1976d2', '#4caf50'];

const TokensTimeSeriesChart: React.FC<ChartProps> = ({
  data,
  title,
  description,
  options = {},
}) => {
  const { t } = useTranslation();
  const chartData = useMemo(() => {
    return data.map((stat) => {
      return {
        date: format(new Date(stat.date), 'MM/dd'),
        inputTokens: stat.inputTokens?.overall || 0,
        outputTokens: stat.outputTokens?.overall || 0,
        cacheReadTokens: stat.cacheReadInputTokens?.overall || 0,
        cacheWriteTokens: stat.cacheWriteInputTokens?.overall || 0,
      };
    });
  }, [data]);

  const { legend = true, tooltip = true, colors = COLORS } = options;

  const getTokenLabel = (name: string): string => {
    switch (name) {
      case 'inputTokens':
        return t('stat.input_tokens');
      case 'outputTokens':
        return t('stat.output_tokens');
      case 'cacheReadTokens':
        return t('stat.cache_read_tokens');
      case 'cacheWriteTokens':
        return t('stat.cache_write_tokens');
      default:
        return name;
    }
  };

  if (data.length === 0) {
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
                  const label = getTokenLabel(name);
                  return [`${value.toLocaleString()}`, label];
                }}
              />
            )}
            {legend && <Legend formatter={getTokenLabel} />}
            <Bar
              dataKey="inputTokens"
              name="inputTokens"
              stackId="a"
              fill={colors[0]}
            />
            <Bar
              dataKey="cacheReadTokens"
              name="cacheReadTokens"
              stackId="a"
              fill={colors[1]}
            />
            <Bar
              dataKey="cacheWriteTokens"
              name="cacheWriteTokens"
              stackId="a"
              fill={colors[2]}
            />
            <Bar
              dataKey="outputTokens"
              name="outputTokens"
              stackId="a"
              fill={colors[3]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TokensTimeSeriesChart;
