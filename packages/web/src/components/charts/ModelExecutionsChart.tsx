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
import { Payload } from 'recharts/types/component/DefaultTooltipContent';
import { MODELS } from '../../hooks/useModel';
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

interface ModelExecutionData {
  date: string;
  total: number;
  [modelId: string]: number | string;
}

const ModelExecutionsChart: React.FC<ChartProps> = ({
  data,
  title,
  description,
  options = {},
}) => {
  const { t } = useTranslation();
  const chartData = useMemo(() => {
    return data.map((stat) => {
      const baseData: ModelExecutionData = {
        date: format(new Date(stat.date), 'MM/dd'),
        total: stat.executions?.overall || 0,
      };
      // Add execution counts for each model
      Object.entries(stat.executions || {}).forEach(([key, value]) => {
        if (key.startsWith('model#')) {
          const modelId = key.replace('model#', '');
          baseData[modelId] = value;
        }
      });
      return baseData;
    });
  }, [data]);

  const modelIds = useMemo(() => {
    const ids = new Set<string>();
    data.forEach((stat) => {
      Object.keys(stat.executions || {}).forEach((key) => {
        if (key.startsWith('model#')) {
          const modelId = key.replace('model#', '');
          ids.add(modelId);
        }
      });
    });
    return Array.from(ids);
  }, [data]);

  const { legend = true, tooltip = true, colors = COLORS } = options;

  if (data.length === 0 || modelIds.length === 0) {
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
                formatter={(
                  value: number,
                  name: string,
                  entry: Payload<number, string>
                ) => {
                  const payload = entry.payload as ModelExecutionData;
                  const total = payload.total;
                  const percentage = ((value / total) * 100).toFixed(1);
                  return [
                    `${value.toLocaleString()} (${percentage}%)`,
                    MODELS.modelDisplayName(name),
                  ];
                }}
              />
            )}
            {legend && (
              <Legend formatter={(value) => MODELS.modelDisplayName(value)} />
            )}
            {modelIds.map((modelId, index) => (
              <Bar
                key={modelId}
                dataKey={modelId}
                name={modelId}
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

export default ModelExecutionsChart;
