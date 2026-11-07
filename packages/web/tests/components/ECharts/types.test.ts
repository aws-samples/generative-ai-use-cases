import { createElement } from 'react';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EChartsRenderer from '../../../src/components/ECharts/EChartsRenderer';
import { normalizeSeriesData } from '../../../src/components/ECharts/chart-options/builders/_helpers';
import {
  validateBasicChart,
  validateBoxplot,
  validateCandlestick,
  validateHeatmap,
  validateMap,
  validateRadar,
  checkChartSizeLimits,
  MAX_DATA_POINTS,
  MAX_SERIES,
} from '../../../src/components/ECharts/validation';
import { resolveValidatedData } from '../../../src/components/ECharts/chart-options';
import {
  type BasicChartInput,
  type BoxplotInput,
  type CandlestickInput,
  type ChartType,
  type ChartInput,
  type HeatmapInput,
  type MapInput,
  type RadarInput,
  type ScatterChartInput,
} from '../../../src/components/ECharts/types';

const { mockSetOption, mockInit } = vi.hoisted(() => {
  const setOption = vi.fn();
  const init = vi.fn(() => ({
    setOption,
    resize: vi.fn(),
    dispose: vi.fn(),
    getDataURL: vi.fn(),
  }));

  return {
    mockSetOption: setOption,
    mockInit: init,
  };
});

vi.mock('echarts', () => ({
  init: mockInit,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const originalFetch = global.fetch;
const scalarScatterJson = JSON.stringify({
  type: 'scatter',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 20 },
    { name: 'C', value: 30 },
  ],
});

let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;

// ResizeObserver mock: fires callback immediately with non-zero dimensions on observe()
// Vitest 4 requires a `function` (not an arrow) implementation for mocks called with `new`.
const MockResizeObserver = vi.fn(function (callback: ResizeObserverCallback) {
  return {
    observe: vi.fn((target: Element) => {
      callback(
        [
          {
            target,
            contentRect: { width: 640, height: 300 } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver
      );
    }),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  };
});
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

beforeEach(() => {
  getBoundingClientRectSpy = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(
      () =>
        ({
          width: 640,
          height: 300,
          top: 0,
          right: 640,
          bottom: 300,
          left: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect
    );
  mockSetOption.mockClear();
  mockInit.mockClear();
});

afterEach(() => {
  getBoundingClientRectSpy.mockRestore();
  global.fetch = originalFetch;
});

describe('chart types', () => {
  it('supports all chart type literals', () => {
    const chartTypes: ChartType[] = [
      'bar',
      'line',
      'pie',
      'area',
      'scatter',
      'boxplot',
      'heatmap',
      'radar',
      'candlestick',
      'map',
    ];

    expect(chartTypes).toHaveLength(10);
  });
});

describe('validateBasicChart', () => {
  const validDataChart: BasicChartInput = {
    type: 'bar',
    data: [{ name: 'A', value: 1 }],
  };

  const validSeriesChart: BasicChartInput = {
    type: 'line',
    series: [{ name: 'Series 1', data: [{ name: 'A', value: 1 }] }],
  };

  const validScatterChart: ScatterChartInput = {
    type: 'scatter',
    data: [{ name: 'A', value: [1, 2] }],
  };

  it('accepts valid chart data', () => {
    expect(validateBasicChart(validDataChart)).toBe(true);
  });

  it('accepts valid chart series', () => {
    expect(validateBasicChart(validSeriesChart)).toBe(true);
  });

  it('accepts valid scatter data', () => {
    expect(validateBasicChart(validScatterChart)).toBe(true);
  });

  it('accepts scatter with scalar values', () => {
    expect(
      validateBasicChart({
        type: 'scatter',
        data: [{ name: 'A', value: 10 }],
      })
    ).toBe(true);
  });

  it('accepts multi-series scatter with mixed scalar and tuple values', () => {
    expect(
      validateBasicChart({
        type: 'scatter',
        series: [
          {
            name: 'Series 1',
            data: [
              { name: 'A', value: 10 },
              { name: 'B', value: [1, 2] },
            ],
          },
          { name: 'Series 2', data: [{ name: 'C', value: 20 }] },
        ],
      })
    ).toBe(true);
  });

  it('preserves scalar scatter payloads through validation and option generation', async () => {
    expect(
      validateBasicChart({
        type: 'scatter',
        data: [
          { name: 'A', value: 10 },
          { name: 'B', value: 20 },
          { name: 'C', value: 30 },
        ],
      })
    ).toBe(true);

    expect(() =>
      render(
        createElement(EChartsRenderer, {
          rawJson: scalarScatterJson,
          validatedData: resolveValidatedData(JSON.parse(scalarScatterJson)),
        })
      )
    ).not.toThrow();

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          series: [
            expect.objectContaining({
              type: 'scatter',
              data: [
                { name: 'A', value: 10 },
                { name: 'B', value: 20 },
                { name: 'C', value: 30 },
              ],
            }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  it('rejects charts without data and series', () => {
    expect(validateBasicChart({ type: 'pie' })).toBe(false);
  });

  it('rejects invalid data items', () => {
    expect(
      validateBasicChart({
        type: 'area',
        data: [{ name: 'A', value: '1' }],
      })
    ).toBe(false);
  });

  it('rejects invalid series items', () => {
    expect(
      validateBasicChart({
        type: 'scatter',
        series: [{ name: 'Series 1', data: [{ name: 'A', value: '1' }] }],
      })
    ).toBe(false);
  });

  it('rejects malformed series arrays without throwing', () => {
    expect(() =>
      validateBasicChart({
        type: 'bar',
        series: [{ name: 'Series 1' }],
      })
    ).not.toThrow();

    expect(
      validateBasicChart({
        type: 'bar',
        series: [{ name: 'Series 1' }],
      })
    ).toBe(false);
  });

  it('rejects invalid chart type', () => {
    expect(
      validateBasicChart({
        type: 'heatmap',
        data: [{ name: 'A', value: 1 }],
      })
    ).toBe(false);
  });

  it('accepts unequal-length multi-series pie', () => {
    expect(
      validateBasicChart({
        type: 'pie',
        series: [
          {
            name: 'Series 1',
            data: [
              { name: 'A', value: 1 },
              { name: 'B', value: 2 },
            ],
          },
          { name: 'Series 2', data: [{ name: 'C', value: 3 }] },
        ],
      })
    ).toBe(true);
  });

  it('accepts unequal-length multi-series scatter', () => {
    expect(
      validateBasicChart({
        type: 'scatter',
        series: [
          {
            name: 'Series 1',
            data: [
              { name: 'A', value: [1, 2] },
              { name: 'B', value: [3, 4] },
            ],
          },
          { name: 'Series 2', data: [{ name: 'C', value: [5, 6] }] },
        ],
      })
    ).toBe(true);
  });

  it('accepts unequal-length multi-series line', () => {
    expect(
      validateBasicChart({
        type: 'line',
        series: [
          {
            name: 'Series 1',
            data: [
              { name: 'A', value: 1 },
              { name: 'B', value: 2 },
            ],
          },
          { name: 'Series 2', data: [{ name: 'C', value: 3 }] },
        ],
      })
    ).toBe(true);
  });

  it('accepts unequal-length multi-series area', () => {
    expect(
      validateBasicChart({
        type: 'area',
        series: [
          {
            name: 'Series 1',
            data: [
              { name: 'A', value: 1 },
              { name: 'B', value: 2 },
            ],
          },
          { name: 'Series 2', data: [{ name: 'C', value: 3 }] },
        ],
      })
    ).toBe(true);
  });

  it('rejects duplicate category names in bar series', () => {
    expect(
      validateBasicChart({
        type: 'bar',
        series: [
          {
            name: 'Series 1',
            data: [
              { name: 'A', value: 1 },
              { name: 'A', value: 2 },
            ],
          },
        ],
      })
    ).toBe(false);
  });

  it('accepts duplicate category names in line series', () => {
    expect(
      validateBasicChart({
        type: 'line',
        series: [
          {
            name: 'Series 1',
            data: [
              { name: 'A', value: 1 },
              { name: 'A', value: 2 },
            ],
          },
        ],
      })
    ).toBe(true);
  });

  it('accepts duplicate category names in area series', () => {
    expect(
      validateBasicChart({
        type: 'area',
        series: [
          {
            name: 'Series 1',
            data: [
              { name: 'A', value: 1 },
              { name: 'A', value: 2 },
            ],
          },
        ],
      })
    ).toBe(true);
  });
});

describe('normalizeSeriesData', () => {
  it('normalizes categories consistently across series', () => {
    expect(
      normalizeSeriesData([
        {
          name: 'Series A',
          data: [
            { name: 'b', value: 2 },
            { name: 'a', value: 1 },
          ],
        },
        {
          name: 'Series B',
          data: [
            { name: 'a', value: 3 },
            { name: 'c', value: 4 },
          ],
        },
      ])
    ).toEqual({
      categories: ['b', 'a', 'c'],
      series: [
        { name: 'Series A', data: [2, 1, null] },
        { name: 'Series B', data: [null, 3, 4] },
      ],
    });
  });
});

describe('validateBoxplot', () => {
  const validInput: BoxplotInput = {
    type: 'boxplot',
    data: [[1, 2, 3, 4, 5]],
  };

  it('accepts valid data', () => {
    expect(validateBoxplot(validInput)).toBe(true);
  });

  it('rejects missing data', () => {
    expect(validateBoxplot({ type: 'boxplot' })).toBe(false);
  });

  it('rejects wrong tuple length', () => {
    expect(validateBoxplot({ type: 'boxplot', data: [[1, 2, 3, 4]] })).toBe(
      false
    );
  });

  it('rejects non-number values', () => {
    expect(
      validateBoxplot({
        type: 'boxplot',
        data: [[1, 2, 3, 4, '5']],
      })
    ).toBe(false);
  });

  it('rejects NaN values', () => {
    expect(
      validateBoxplot({
        type: 'boxplot',
        data: [[Number.NaN, 1, 2, 3, 4]],
      })
    ).toBe(false);
  });

  it('rejects labels length mismatch', () => {
    expect(
      validateBoxplot({
        type: 'boxplot',
        data: [[1, 2, 3, 4, 5]],
        labels: [],
      })
    ).toBe(false);
  });

  it('rejects non-string labels array', () => {
    expect(
      validateBoxplot({
        type: 'boxplot',
        data: [[1, 2, 3, 4, 5]],
        labels: [1, 2, 3, 4, 5],
      })
    ).toBe(false);
  });

  it('rejects labels with mixed types', () => {
    expect(
      validateBoxplot({
        type: 'boxplot',
        data: [[1, 2, 3, 4, 5]],
        labels: ['A', 'B', 'C', 4, 'E'],
      })
    ).toBe(false);
  });
});

describe('validateHeatmap', () => {
  const validInput: HeatmapInput = {
    type: 'heatmap',
    xLabels: ['Mon'],
    yLabels: ['AM'],
    data: [{ x: 0, y: 0, value: 42 }],
  };

  it('accepts valid data', () => {
    expect(validateHeatmap(validInput)).toBe(true);
  });

  it('rejects missing xLabels', () => {
    expect(
      validateHeatmap({
        type: 'heatmap',
        yLabels: ['AM'],
        data: [{ x: 0, y: 0, value: 1 }],
      })
    ).toBe(false);
  });

  it('rejects missing yLabels', () => {
    expect(
      validateHeatmap({
        type: 'heatmap',
        xLabels: ['Mon'],
        data: [{ x: 0, y: 0, value: 1 }],
      })
    ).toBe(false);
  });

  it('rejects missing data', () => {
    expect(
      validateHeatmap({ type: 'heatmap', xLabels: ['Mon'], yLabels: ['AM'] })
    ).toBe(false);
  });

  it('rejects out-of-bounds indices', () => {
    expect(
      validateHeatmap({
        type: 'heatmap',
        xLabels: ['Mon'],
        yLabels: ['AM'],
        data: [{ x: 1, y: 0, value: 42 }],
      })
    ).toBe(false);
  });

  it('rejects non-object data items', () => {
    expect(
      validateHeatmap({
        type: 'heatmap',
        xLabels: ['Mon'],
        yLabels: ['AM'],
        data: [[0, 0, 42]],
      })
    ).toBe(false);
  });

  it('rejects non-integer x index', () => {
    expect(
      validateHeatmap({
        type: 'heatmap',
        xLabels: ['Mon', 'Tue'],
        yLabels: ['AM', 'PM'],
        data: [{ x: 0.5, y: 0, value: 42 }],
      })
    ).toBe(false);
  });

  it('rejects non-integer y index', () => {
    expect(
      validateHeatmap({
        type: 'heatmap',
        xLabels: ['Mon', 'Tue'],
        yLabels: ['AM', 'PM'],
        data: [{ x: 0, y: 1.5, value: 42 }],
      })
    ).toBe(false);
  });

  it('rejects NaN index', () => {
    expect(
      validateHeatmap({
        type: 'heatmap',
        xLabels: ['Mon'],
        yLabels: ['AM'],
        data: [{ x: NaN, y: 0, value: 42 }],
      })
    ).toBe(false);
  });

  it('rejects Infinity index', () => {
    expect(
      validateHeatmap({
        type: 'heatmap',
        xLabels: ['Mon'],
        yLabels: ['AM'],
        data: [{ x: Infinity, y: 0, value: 42 }],
      })
    ).toBe(false);
  });
});

describe('validateRadar', () => {
  const validInput: RadarInput = {
    type: 'radar',
    indicators: [{ name: 'Speed', max: 100 }],
    data: [{ name: 'Model A', value: [80] }],
  };

  it('accepts valid data', () => {
    expect(validateRadar(validInput)).toBe(true);
  });

  it('rejects missing indicators', () => {
    expect(
      validateRadar({ type: 'radar', data: [{ name: 'A', value: [1] }] })
    ).toBe(false);
  });

  it('rejects missing data', () => {
    expect(
      validateRadar({
        type: 'radar',
        indicators: [{ name: 'Speed', max: 100 }],
      })
    ).toBe(false);
  });

  it('rejects invalid indicators', () => {
    expect(
      validateRadar({
        type: 'radar',
        indicators: [{ name: 'Speed' }],
        data: [{ name: 'Model A', value: [80] }],
      })
    ).toBe(false);
  });

  it('rejects invalid data values', () => {
    expect(
      validateRadar({
        type: 'radar',
        indicators: [{ name: 'Speed', max: 100 }],
        data: [{ name: 'Model A', value: [80, '90'] }],
      })
    ).toBe(false);
  });

  it('rejects indicator and value length mismatch', () => {
    expect(
      validateRadar({
        type: 'radar',
        indicators: [{ name: 'A', max: 10 }],
        data: [{ name: 'B', value: [1, 2] }],
      })
    ).toBe(false);
  });
});

describe('validateCandlestick', () => {
  const validInput: CandlestickInput = {
    type: 'candlestick',
    data: [[10, 12, 9, 13]],
  };

  it('accepts valid data', () => {
    expect(validateCandlestick(validInput)).toBe(true);
  });

  it('rejects missing data', () => {
    expect(validateCandlestick({ type: 'candlestick' })).toBe(false);
  });

  it('rejects wrong tuple length', () => {
    expect(
      validateCandlestick({ type: 'candlestick', data: [[10, 12, 9]] })
    ).toBe(false);
  });

  it('rejects non-number values', () => {
    expect(
      validateCandlestick({
        type: 'candlestick',
        data: [[10, 12, 9, '13']],
      })
    ).toBe(false);
  });

  it('rejects Infinity values', () => {
    expect(
      validateCandlestick({
        type: 'candlestick',
        data: [[1, 2, 3, Number.POSITIVE_INFINITY]],
      })
    ).toBe(false);
  });

  it('rejects dates length mismatch', () => {
    expect(
      validateCandlestick({
        type: 'candlestick',
        data: [[1, 2, 3, 4]],
        dates: [],
      })
    ).toBe(false);
  });

  it('rejects non-string dates array', () => {
    expect(
      validateCandlestick({
        type: 'candlestick',
        data: [[1, 2, 3, 4]],
        dates: [1, 2, 3, 4],
      })
    ).toBe(false);
  });

  it('rejects dates with mixed types', () => {
    expect(
      validateCandlestick({
        type: 'candlestick',
        data: [[1, 2, 3, 4]],
        dates: ['2024-01-01', '2024-01-02', 123, '2024-01-04'],
      })
    ).toBe(false);
  });
});

describe('validateMap', () => {
  const validJapanMap: MapInput = {
    type: 'map',
    region: 'japan',
    detail: 'prefecture',
    data: [{ name: 'Tokyo', value: 100 }],
  };

  const validWorldMap: MapInput = {
    type: 'map',
    region: 'world',
    data: [{ name: 'Japan', value: 1 }],
  };

  it('accepts valid japan map', () => {
    expect(validateMap(validJapanMap)).toBe(true);
  });

  it('accepts valid world map', () => {
    expect(validateMap(validWorldMap)).toBe(true);
  });

  it('rejects missing region', () => {
    expect(
      validateMap({ type: 'map', data: [{ name: 'Tokyo', value: 100 }] })
    ).toBe(false);
  });

  it('rejects invalid region', () => {
    expect(
      validateMap({
        type: 'map',
        region: 'asia',
        data: [{ name: 'Tokyo', value: 100 }],
      })
    ).toBe(false);
  });

  it('rejects municipality detail without prefecture', () => {
    expect(
      validateMap({
        type: 'map',
        region: 'japan',
        detail: 'municipality',
        data: [{ name: 'Shinjuku', value: 100 }],
      })
    ).toBe(false);
  });

  it('accepts municipality detail with prefecture', () => {
    expect(
      validateMap({
        type: 'map',
        region: 'japan',
        detail: 'municipality',
        prefecture: '13',
        data: [{ name: 'Shinjuku', value: 100 }],
      })
    ).toBe(true);
  });

  it('rejects world municipality detail', () => {
    expect(
      validateMap({
        type: 'map',
        region: 'world',
        detail: 'municipality',
        data: [],
      })
    ).toBe(false);
  });

  it.each(['0', '00', '48', '13-tokyo', 'abc', '', '100'])(
    'rejects invalid prefecture code %j',
    (code) => {
      expect(
        validateMap({
          type: 'map',
          region: 'japan',
          detail: 'municipality',
          prefecture: code,
          data: [{ name: 'Shinjuku', value: 100 }],
        })
      ).toBe(false);
    }
  );

  it.each(['01', '13', '47'])('accepts valid prefecture code %j', (code) => {
    expect(
      validateMap({
        type: 'map',
        region: 'japan',
        detail: 'municipality',
        prefecture: code,
        data: [{ name: 'Shinjuku', value: 100 }],
      })
    ).toBe(true);
  });
});

describe('isValidChartData', () => {
  it('accepts all supported chart types', () => {
    const inputs: ChartInput[] = [
      { type: 'bar', data: [{ name: 'A', value: 1 }] },
      {
        type: 'line',
        series: [{ name: 'S1', data: [{ name: 'A', value: 1 }] }],
      },
      { type: 'pie', data: [{ name: 'A', value: 1 }] },
      { type: 'area', data: [{ name: 'A', value: 1 }] },
      { type: 'scatter', data: [{ name: 'A', value: [1, 2] }] },
      { type: 'boxplot', data: [[1, 2, 3, 4, 5]] },
      {
        type: 'heatmap',
        xLabels: ['X'],
        yLabels: ['Y'],
        data: [{ x: 0, y: 0, value: 1 }],
      },
      {
        type: 'radar',
        indicators: [{ name: 'Metric', max: 10 }],
        data: [{ name: 'Series', value: [5] }],
      },
      { type: 'candlestick', data: [[1, 2, 0, 3]] },
      { type: 'map', region: 'world', data: [{ name: 'Japan', value: 1 }] },
    ];

    for (const input of inputs) {
      expect(resolveValidatedData(input)).not.toBeNull();
    }
  });

  it('rejects unknown chart types', () => {
    expect(
      resolveValidatedData({ type: 'unknown', data: [{ name: 'A', value: 1 }] })
    ).toBeNull();
  });

  it('rejects nullish and primitive inputs', () => {
    expect(resolveValidatedData(null)).toBeNull();
    expect(resolveValidatedData(undefined)).toBeNull();
    expect(resolveValidatedData('chart')).toBeNull();
  });

  it('accepts title within 500 chars', () => {
    expect(
      resolveValidatedData({
        type: 'bar',
        title: 'Sales Trend',
        data: [{ name: 'A', value: 1 }],
      })
    ).not.toBeNull();
  });

  it('rejects title over 500 chars', () => {
    expect(
      resolveValidatedData({
        type: 'bar',
        title: 'A'.repeat(501),
        data: [{ name: 'A', value: 1 }],
      })
    ).toBeNull();
  });

  it('accepts title absent', () => {
    expect(
      resolveValidatedData({ type: 'bar', data: [{ name: 'A', value: 1 }] })
    ).not.toBeNull();
  });

  it('rejects xAxisLabel over 500 chars', () => {
    expect(
      resolveValidatedData({
        type: 'bar',
        xAxisLabel: 'A'.repeat(501),
        data: [{ name: 'A', value: 1 }],
      })
    ).toBeNull();
  });

  it('rejects yAxisLabel over 500 chars', () => {
    expect(
      resolveValidatedData({
        type: 'bar',
        yAxisLabel: 'A'.repeat(501),
        data: [{ name: 'A', value: 1 }],
      })
    ).toBeNull();
  });
});

describe('DoS protection — size limits', () => {
  const point = { name: 'x', value: 1 };

  it('accepts exactly MAX_DATA_POINTS data points', () => {
    expect(
      validateBasicChart({
        type: 'bar',
        data: Array(MAX_DATA_POINTS).fill(point),
      })
    ).toBe(true);
  });

  it('rejects MAX_DATA_POINTS + 1 data points', () => {
    expect(
      validateBasicChart({
        type: 'bar',
        data: Array(MAX_DATA_POINTS + 1).fill(point),
      })
    ).toBe(false);
  });

  it('accepts exactly MAX_SERIES series', () => {
    expect(
      validateBasicChart({
        type: 'bar',
        series: Array(MAX_SERIES)
          .fill(null)
          .map((_, i) => ({ name: `S${i}`, data: [point] })),
      })
    ).toBe(true);
  });

  it('rejects MAX_SERIES + 1 series', () => {
    expect(
      validateBasicChart({
        type: 'bar',
        series: Array(MAX_SERIES + 1)
          .fill(null)
          .map((_, i) => ({ name: `S${i}`, data: [point] })),
      })
    ).toBe(false);
  });

  it('rejects total series data points exceeding MAX_DATA_POINTS', () => {
    const halfPoints = Math.ceil(MAX_DATA_POINTS / 2) + 1;
    expect(
      validateBasicChart({
        type: 'bar',
        series: [
          {
            name: 'S1',
            data: Array(halfPoints)
              .fill(null)
              .map((_, i) => ({ name: `x${i}`, value: i })),
          },
          {
            name: 'S2',
            data: Array(halfPoints)
              .fill(null)
              .map((_, i) => ({ name: `x${i}`, value: i })),
          },
        ],
      })
    ).toBe(false);
  });

  it('checkChartSizeLimits returns reason for data_points_exceeded', () => {
    const reason = checkChartSizeLimits({
      type: 'bar',
      data: Array(MAX_DATA_POINTS + 1).fill(point),
    });
    expect(reason).toMatch(/data_points_exceeded/);
  });

  it('checkChartSizeLimits returns reason for series_exceeded', () => {
    const reason = checkChartSizeLimits({
      type: 'bar',
      series: Array(MAX_SERIES + 1)
        .fill(null)
        .map((_, i) => ({ name: `S${i}`, data: [point] })),
    });
    expect(reason).toMatch(/series_exceeded/);
  });

  it('checkChartSizeLimits returns null for valid data', () => {
    expect(
      checkChartSizeLimits({ type: 'bar', data: Array(100).fill(point) })
    ).toBeNull();
  });

  it('EChartsRenderer shows size limit warning for 10001 data points', () => {
    const oversizedData = {
      type: 'bar',
      data: Array(MAX_DATA_POINTS + 1).fill(point),
    };
    const { getByText } = render(
      createElement(EChartsRenderer, {
        rawJson: JSON.stringify(oversizedData),
        validatedData: resolveValidatedData(oversizedData),
        sizeLimitReason: checkChartSizeLimits(oversizedData),
      })
    );
    expect(getByText('chart.data_limit_exceeded')).toBeTruthy();
  });

  it('EChartsRenderer shows size limit warning for 51 series', () => {
    const oversizedSeries = {
      type: 'bar',
      series: Array(MAX_SERIES + 1)
        .fill(null)
        .map((_, i) => ({ name: `S${i}`, data: [point] })),
    };
    const { getByText } = render(
      createElement(EChartsRenderer, {
        rawJson: JSON.stringify(oversizedSeries),
        validatedData: resolveValidatedData(oversizedSeries),
        sizeLimitReason: checkChartSizeLimits(oversizedSeries),
      })
    );
    expect(getByText('chart.data_limit_exceeded')).toBeTruthy();
  });
});
