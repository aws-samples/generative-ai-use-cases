import { TokenUsageStats } from 'generative-ai-use-cases';

export type ChartType =
  | 'line_chart'
  | 'bar_chart'
  | 'stacked_bar_chart'
  | 'pie_chart'
  | 'heatmap';

export interface ChartOptions {
  legend?: boolean;
  tooltip?: boolean;
  responsive?: boolean;
  markers?: boolean;
  area?: boolean;
  donut?: boolean;
  grouped?: boolean;
  stacked_percentage?: boolean;
  color_scale?: string[];
  colors?: string[];
}

export interface ChartProps {
  data: TokenUsageStats[];
  title: string;
  description?: string;
  options?: ChartOptions;
}

export interface TimeSeriesData {
  date: string;
  value: number;
  [key: string]: number | string;
}

export interface PieChartData {
  name: string;
  value: number;
}

export interface HeatmapData {
  x: string;
  y: string;
  value: number;
}
