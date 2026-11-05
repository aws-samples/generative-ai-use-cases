import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as echarts from 'echarts';
import EChartsRenderer from '../../../src/components/ECharts/EChartsRenderer';
import { resolveValidatedData } from '../../../src/components/ECharts/chart-options';

// Helper: parse JSON and resolve validatedData (returns null on parse error)
function vd(json: string) {
  try {
    return resolveValidatedData(JSON.parse(json));
  } catch {
    return null;
  }
}

const prefectureName = 'Tokyo';

const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;
let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;

// ResizeObserver mock: fires callback immediately with non-zero dimensions on observe()
let lastResizeObserverCallback: ResizeObserverCallback | null = null;
// Vitest 4 requires a `function` (not an arrow) implementation for mocks called with `new`.
const MockResizeObserver = vi.fn(function (callback: ResizeObserverCallback) {
  lastResizeObserverCallback = callback;
  return {
    observe: vi.fn((target: Element) => {
      // Fire immediately with non-zero dimensions to trigger chart init
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

const {
  mockSetOption,
  mockResize,
  mockDispose,
  mockGetDataURL,
  mockClear,
  mockInit,
  mockRegisterMap,
  mockGetMap,
} = vi.hoisted(() => {
  const setOption = vi.fn();
  const resize = vi.fn();
  const dispose = vi.fn();
  const getDataURL = vi.fn(() => 'data:image/svg+xml;base64,...');
  const clear = vi.fn();
  const init = vi.fn(() => ({
    setOption,
    resize,
    dispose,
    getDataURL,
    clear,
  }));
  const registerMap = vi.fn();
  const getMap = vi.fn(() => null);

  return {
    mockSetOption: setOption,
    mockResize: resize,
    mockDispose: dispose,
    mockGetDataURL: getDataURL,
    mockClear: clear,
    mockInit: init,
    mockRegisterMap: registerMap,
    mockGetMap: getMap,
  };
});

vi.mock('echarts', () => ({
  init: mockInit,
  registerMap: mockRegisterMap,
  getMap: mockGetMap,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const singleSeriesData = {
  type: 'bar',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 20 },
    { name: 'C', value: 30 },
  ],
};

const multiSeriesData = {
  type: 'bar',
  series: [
    {
      name: 'Series1',
      data: [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
      ],
    },
    {
      name: 'Series2',
      data: [
        { name: 'A', value: 15 },
        { name: 'B', value: 25 },
      ],
    },
  ],
};

const reorderedMultiSeriesData = {
  type: 'line',
  series: [
    {
      name: 'Series1',
      data: [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
        { name: 'C', value: 30 },
      ],
    },
    {
      name: 'Series2',
      data: [
        { name: 'B', value: 200 },
        { name: 'A', value: 100 },
        { name: 'D', value: 400 },
      ],
    },
  ],
};

const duplicateCategorySeriesData = {
  type: 'bar',
  series: [
    {
      name: 'Series1',
      data: [
        { name: 'A', value: 10 },
        { name: 'A', value: 20 },
      ],
    },
    {
      name: 'Series2',
      data: [{ name: 'A', value: 30 }],
    },
  ],
};

const boxplotData = {
  type: 'boxplot',
  labels: ['A', 'B'],
  data: [
    [1, 2, 3, 4, 5],
    [2, 3, 4, 5, 6],
  ],
};

const heatmapData = {
  type: 'heatmap',
  xLabels: ['Mon', 'Tue'],
  yLabels: ['AM', 'PM'],
  data: [
    { x: 0, y: 0, value: 5 },
    { x: 1, y: 1, value: 9 },
  ],
};

const radarData = {
  type: 'radar',
  indicators: [
    { name: 'Speed', max: 100 },
    { name: 'Reliability', max: 100 },
  ],
  data: [
    { name: 'Model A', value: [80, 90] },
    { name: 'Model B', value: [70, 85] },
  ],
};

const candlestickData = {
  type: 'candlestick',
  dates: ['2024-01-01', '2024-01-02'],
  data: [
    [20, 25, 18, 27],
    [25, 22, 21, 28],
  ],
};

const scatterData = {
  type: 'scatter',
  data: [
    { name: 'A', value: [10, 20] },
    { name: 'B', value: [20, 30] },
    { name: 'C', value: [30, 40] },
  ],
};

const namedTupleScatterData = {
  type: 'scatter',
  xAxisLabel: 'GDP',
  yAxisLabel: 'Population',
  data: [{ name: 'Tokyo', value: [100, 200] }],
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('EChartsRenderer', () => {
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
    MockResizeObserver.mockClear();
    lastResizeObserverCallback = null;
    mockInit.mockClear();
    mockSetOption.mockClear();
    mockResize.mockClear();
    mockDispose.mockClear();
    mockGetDataURL.mockClear();
    mockRegisterMap.mockClear();
    mockClear.mockClear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    getBoundingClientRectSpy.mockRestore();
  });

  it('renders bar chart with valid single-series JSON', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(singleSeriesData)}
        validatedData={resolveValidatedData(singleSeriesData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          color: expect.arrayContaining(['#4e79a7', '#f28e2b']),
          series: [
            expect.objectContaining({ type: 'bar', data: [10, 20, 30] }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  it('renders line chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify({ ...singleSeriesData, type: 'line' })}
        validatedData={resolveValidatedData({
          ...singleSeriesData,
          type: 'line',
        })}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          series: [
            expect.objectContaining({ type: 'line', data: [10, 20, 30] }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  it('renders pie chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify({ ...singleSeriesData, type: 'pie' })}
        validatedData={resolveValidatedData({
          ...singleSeriesData,
          type: 'pie',
        })}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          series: [
            expect.objectContaining({
              type: 'pie',
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

  it('renders area chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify({ ...singleSeriesData, type: 'area' })}
        validatedData={resolveValidatedData({
          ...singleSeriesData,
          type: 'area',
        })}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          series: [
            expect.objectContaining({
              type: 'line',
              areaStyle: {},
              data: [10, 20, 30],
            }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  it('renders scatter chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(scatterData)}
        validatedData={resolveValidatedData(scatterData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          series: [
            expect.objectContaining({
              type: 'scatter',
              data: [
                { name: 'A', value: [10, 20] },
                { name: 'B', value: [20, 30] },
                { name: 'C', value: [30, 40] },
              ],
            }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  it('uses item tooltip for named tuple scatter points', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(namedTupleScatterData)}
        validatedData={resolveValidatedData(namedTupleScatterData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          tooltip: expect.objectContaining({
            trigger: 'item',
            formatter: expect.any(Function),
          }),
          series: [
            expect.objectContaining({
              type: 'scatter',
              data: [{ name: 'Tokyo', value: [100, 200] }],
            }),
          ],
        }),
        { notMerge: true }
      );

      const option = mockSetOption.mock.calls.at(-1)?.[0] as {
        tooltip?: { formatter?: (params: unknown) => string };
      };
      const formatter = option.tooltip?.formatter;

      expect(formatter).toBeTypeOf('function');
      expect(
        formatter?.({
          name: 'Tokyo',
          value: [100, 200],
          data: { name: 'Tokyo', value: [100, 200] },
        })
      ).toContain('Tokyo');
      expect(
        formatter?.({
          name: 'Tokyo',
          value: [100, 200],
          data: { name: 'Tokyo', value: [100, 200] },
        })
      ).toContain('GDP');
      expect(
        formatter?.({
          name: 'Tokyo',
          value: [100, 200],
          data: { name: 'Tokyo', value: [100, 200] },
        })
      ).toContain('Population');
      expect(
        formatter?.({
          name: 'Tokyo',
          value: [100, 200],
          data: { name: 'Tokyo', value: [100, 200] },
        })
      ).toContain('100');
      expect(
        formatter?.({
          name: 'Tokyo',
          value: [100, 200],
          data: { name: 'Tokyo', value: [100, 200] },
        })
      ).toContain('200');
    });
  });

  it('renders boxplot chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(boxplotData)}
        validatedData={resolveValidatedData(boxplotData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          xAxis: expect.objectContaining({ data: ['A', 'B'] }),
          series: [
            expect.objectContaining({
              type: 'boxplot',
              data: boxplotData.data,
            }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  it('renders heatmap chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(heatmapData)}
        validatedData={resolveValidatedData(heatmapData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          visualMap: expect.objectContaining({ min: 5, max: 9 }),
          series: [
            expect.objectContaining({
              type: 'heatmap',
              data: heatmapData.data.map(
                (d: { x: number; y: number; value: number | null }) => [
                  d.x,
                  d.y,
                  d.value,
                ]
              ),
            }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  it('renders radar chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(radarData)}
        validatedData={resolveValidatedData(radarData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          radar: expect.objectContaining({ indicator: radarData.indicators }),
          series: [
            expect.objectContaining({
              type: 'radar',
              data: radarData.data,
            }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  it('renders candlestick chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(candlestickData)}
        validatedData={resolveValidatedData(candlestickData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          xAxis: expect.objectContaining({ data: candlestickData.dates }),
          series: [
            expect.objectContaining({
              type: 'candlestick',
              data: candlestickData.data,
            }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  describe('Map chart', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            type: 'FeatureCollection',
            features: [],
          }),
      });
    });

    it('shows i18n error key when GeoJSON fails to load', () => {
      vi.doMock('../../../src/hooks/useGeoJSON', () => ({
        useGeoJSON: () => ({
          geoJson: null,
          loading: false,
          error: 'load_failed',
        }),
      }));

      const mapJson = JSON.stringify({
        type: 'map',
        region: 'japan',
        detail: 'prefecture',
        data: [{ name: 'Tokyo', value: 1 }],
      });

      // useGeoJSON is already imported at module level; simulate error via fetch failure
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 } as Response);

      render(<EChartsRenderer rawJson={mapJson} validatedData={vd(mapJson)} />);

      // After fetch fails, geoError becomes 'load_failed' and t('chart.geojson_load_failed') is rendered
      // The mock t returns the key itself, so we expect the i18n key in the DOM
      return waitFor(() => {
        expect(screen.getByText('chart.geojson_load_failed')).toBeTruthy();
      });
    });

    it('renders prefecture map', async () => {
      const mapJson = JSON.stringify({
        type: 'map',
        region: 'japan',
        detail: 'prefecture',
        data: [{ name: prefectureName, value: 13960000 }],
      });

      render(<EChartsRenderer rawJson={mapJson} validatedData={vd(mapJson)} />);

      expect(screen.getByText('common.loading')).toBeTruthy();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/geojson/japan-prefectures.geojson',
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
      });

      await waitFor(() => {
        expect(mockRegisterMap).toHaveBeenCalledWith(
          'japan-prefecture',
          expect.objectContaining({
            type: 'FeatureCollection',
            features: [],
          })
        );
      });

      await waitFor(() => {
        expect(mockSetOption).toHaveBeenCalledWith(
          expect.objectContaining({
            series: expect.arrayContaining([
              expect.objectContaining({ type: 'map', map: 'japan-prefecture' }),
            ]),
          }),
          { notMerge: true }
        );
      });
    });

    it('uses custom map color config when provided', async () => {
      const mapJson = JSON.stringify({
        type: 'map',
        region: 'japan',
        detail: 'prefecture',
        min: -16,
        max: 0,
        colorStops: [
          { offset: 1, color: '#0000ff' },
          { offset: 0, color: '#ff0000' },
          { offset: 0.5, color: '#00ff00' },
        ],
        data: [{ name: prefectureName, value: -8 }],
      });

      render(<EChartsRenderer rawJson={mapJson} validatedData={vd(mapJson)} />);

      await waitFor(() => {
        expect(mockSetOption).toHaveBeenCalledWith(
          expect.objectContaining({
            visualMap: expect.objectContaining({
              min: -16,
              max: 0,
              inRange: expect.objectContaining({
                color: ['#ff0000', '#00ff00', '#0000ff'],
              }),
            }),
          }),
          { notMerge: true }
        );
      });
    });

    it('rejects invalid custom map color config', () => {
      const invalidMapData = {
        type: 'map',
        region: 'japan',
        detail: 'prefecture',
        min: -16,
        max: 0,
        colorStops: [
          { offset: 0, color: '#ff0000' },
          { offset: 2, color: '#00ff00' },
        ],
        data: [{ name: prefectureName, value: -8 }],
      };
      render(
        <EChartsRenderer
          rawJson={JSON.stringify(invalidMapData)}
          validatedData={resolveValidatedData(invalidMapData)}
        />
      );

      expect(screen.getByText('chart.invalid_data')).toBeTruthy();
      expect(mockInit).not.toHaveBeenCalled();
      expect(mockSetOption).not.toHaveBeenCalled();
    });

    it('rejects malformed custom map color config objects', () => {
      const malformedMapData = {
        type: 'map',
        region: 'japan',
        detail: 'prefecture',
        min: -16,
        max: 0,
        colorStops: [{ offset: 0, color: '#ff0000' }, { color: '#00ff00' }],
        data: [{ name: prefectureName, value: -8 }],
      };
      render(
        <EChartsRenderer
          rawJson={JSON.stringify(malformedMapData)}
          validatedData={resolveValidatedData(malformedMapData)}
        />
      );

      expect(screen.getByText('chart.invalid_data')).toBeTruthy();
      expect(mockInit).not.toHaveBeenCalled();
      expect(mockSetOption).not.toHaveBeenCalled();
    });

    it('keeps the chart container mounted while GeoJSON is loading', async () => {
      const jsonDeferred = createDeferred<{
        type: string;
        features: never[];
      }>();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => jsonDeferred.promise,
      });

      const mapJson = JSON.stringify({
        type: 'map',
        region: 'japan',
        detail: 'prefecture',
        data: [{ name: prefectureName, value: 13960000 }],
      });

      render(<EChartsRenderer rawJson={mapJson} validatedData={vd(mapJson)} />);

      await waitFor(() => {
        expect(screen.getByTestId('map-loading-overlay')).toBeTruthy();
      });

      expect(screen.getByTestId('echarts-container')).toBeTruthy();
      expect(mockInit).toHaveBeenCalledTimes(1);

      jsonDeferred.resolve({
        type: 'FeatureCollection',
        features: [],
      });

      await waitFor(() => {
        expect(mockSetOption).toHaveBeenCalledWith(
          expect.objectContaining({
            series: expect.arrayContaining([
              expect.objectContaining({ type: 'map', map: 'japan-prefecture' }),
            ]),
          }),
          { notMerge: true }
        );
      });

      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    it('enforces tooltip renderMode richText on map path (overrides user html)', async () => {
      const mapJson = JSON.stringify({
        type: 'map',
        region: 'japan',
        detail: 'prefecture',
        data: [{ name: prefectureName, value: 13960000 }],
        options: { tooltip: { renderMode: 'html' } },
      });

      render(<EChartsRenderer rawJson={mapJson} validatedData={vd(mapJson)} />);

      await waitFor(() => {
        expect(mockSetOption).toHaveBeenCalled();
      });

      const option = mockSetOption.mock.calls.at(-1)?.[0] as {
        tooltip?: { renderMode?: string };
      };
      expect(option.tooltip?.renderMode).toBe('richText');
    });
  });

  it('outputs literal text in scatter tooltip name (richText mode — no HTML escaping)', async () => {
    const xssName = '<img src=x onerror=alert(1)>';
    const xssScatterData = {
      type: 'scatter',
      xAxisLabel: 'GDP',
      yAxisLabel: 'Population',
      data: [{ name: xssName, value: [100, 200] }],
    };
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(xssScatterData)}
        validatedData={resolveValidatedData(xssScatterData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalled();
    });

    const option = mockSetOption.mock.calls.at(-1)?.[0] as {
      tooltip?: { formatter?: (params: unknown) => string };
    };
    const formatter = option.tooltip?.formatter;
    expect(formatter).toBeTypeOf('function');

    const result = formatter?.({
      name: xssName,
      value: [100, 200],
      data: { name: xssName, value: [100, 200] },
    });
    // richText mode: literal text output, no HTML escaping needed
    expect(result).toContain('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('&lt;img');
  });

  it('outputs literal text in scatter tooltip axis labels (richText mode — no HTML escaping)', async () => {
    const xssLabel = '<img src=x onerror=alert(1)>';
    const xssAxisData = {
      type: 'scatter',
      xAxisLabel: xssLabel,
      yAxisLabel: xssLabel,
      data: [{ name: 'A', value: [1, 2] }],
    };
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(xssAxisData)}
        validatedData={resolveValidatedData(xssAxisData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalled();
    });

    const option = mockSetOption.mock.calls.at(-1)?.[0] as {
      tooltip?: { formatter?: (params: unknown) => string };
    };
    const formatter = option.tooltip?.formatter;
    expect(formatter).toBeTypeOf('function');

    const result = formatter?.({
      name: 'A',
      value: [1, 2],
      data: { name: 'A', value: [1, 2] },
    });
    // richText mode: literal text output, no HTML escaping needed
    expect(result).toContain('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('&lt;img');
  });

  it('outputs literal text in bar chart tooltip formatter (richText mode — no HTML escaping)', async () => {
    const xssName = '<img src=x onerror=alert(1)>';
    const xssBarData = {
      type: 'bar',
      data: [{ name: xssName, value: 1 }],
    };
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(xssBarData)}
        validatedData={resolveValidatedData(xssBarData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalled();
    });

    const option = mockSetOption.mock.calls.at(-1)?.[0] as {
      tooltip?: { formatter?: (params: unknown) => string };
    };
    const formatter = option.tooltip?.formatter;
    expect(formatter).toBeTypeOf('function');

    const result = formatter?.([
      { name: xssName, seriesName: 'Series', value: 1 },
    ]);
    // richText mode: literal text output, no HTML escaping needed
    expect(result).toContain('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('&lt;img');
  });

  it('renders multi-series chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(multiSeriesData)}
        validatedData={resolveValidatedData(multiSeriesData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          legend: expect.objectContaining({ top: 24 }),
          series: [
            expect.objectContaining({
              name: 'Series1',
              type: 'bar',
              data: [10, 20],
            }),
            expect.objectContaining({
              name: 'Series2',
              type: 'bar',
              data: [15, 25],
            }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  it('normalizes multi-series category charts by category name', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(reorderedMultiSeriesData)}
        validatedData={resolveValidatedData(reorderedMultiSeriesData)}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          xAxis: expect.objectContaining({ data: ['A', 'B', 'C', 'D'] }),
          series: [
            expect.objectContaining({
              name: 'Series1',
              type: 'line',
              data: [10, 20, 30, null],
            }),
            expect.objectContaining({
              name: 'Series2',
              type: 'line',
              data: [100, 200, null, 400],
            }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  it('rejects ambiguous duplicate category names in a series', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(duplicateCategorySeriesData)}
        validatedData={resolveValidatedData(duplicateCategorySeriesData)}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('chart.invalid_data')).toBeTruthy();
    });

    expect(mockSetOption).not.toHaveBeenCalled();
  });

  it('shows error for invalid JSON', () => {
    render(<EChartsRenderer rawJson="{invalid}" validatedData={null} />);

    expect(screen.getByText('chart.invalid_data')).toBeTruthy();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('shows error for valid JSON but invalid chart data', () => {
    render(<EChartsRenderer rawJson='{"foo":"bar"}' validatedData={null} />);

    expect(screen.getByText('chart.invalid_data')).toBeTruthy();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('initializes when chart data becomes valid after first render', async () => {
    const { rerender } = render(
      <EChartsRenderer rawJson='{"foo":"bar"}' validatedData={null} />
    );

    expect(mockInit).not.toHaveBeenCalled();

    rerender(
      <EChartsRenderer
        rawJson={JSON.stringify(singleSeriesData)}
        validatedData={resolveValidatedData(singleSeriesData)}
      />
    );

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          series: [
            expect.objectContaining({ type: 'bar', data: [10, 20, 30] }),
          ],
        }),
        { notMerge: true }
      );
    });
  });

  it('renders title when provided', () => {
    const titledData = { ...singleSeriesData, title: 'My Chart Title' };
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(titledData)}
        validatedData={resolveValidatedData(titledData)}
      />
    );

    expect(screen.getByText('My Chart Title')).toBeTruthy();
  });

  it('handles resize via ResizeObserver', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(singleSeriesData)}
        validatedData={resolveValidatedData(singleSeriesData)}
      />
    );

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    mockResize.mockClear();

    // Simulate a subsequent ResizeObserver callback (chart already initialized)
    lastResizeObserverCallback?.(
      [{ contentRect: { width: 800, height: 300 } } as ResizeObserverEntry],
      {} as ResizeObserver
    );

    await waitFor(() => {
      expect(mockResize).toHaveBeenCalled();
    });
  });

  it('disposes chart instance on unmount', async () => {
    const { unmount } = render(
      <EChartsRenderer
        rawJson={JSON.stringify(singleSeriesData)}
        validatedData={resolveValidatedData(singleSeriesData)}
      />
    );

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it('initializes echarts on the chart container', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify(singleSeriesData)}
        validatedData={resolveValidatedData(singleSeriesData)}
      />
    );

    await waitFor(() => {
      expect(echarts.init).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe('onChartInit callback', () => {
    it('calls onChartInit with instance after initialization', async () => {
      const onChartInit = vi.fn();

      render(
        <EChartsRenderer
          rawJson={JSON.stringify(singleSeriesData)}
          validatedData={resolveValidatedData(singleSeriesData)}
          onChartInit={onChartInit}
        />
      );

      await waitFor(() => {
        expect(onChartInit).toHaveBeenCalledTimes(1);
        expect(onChartInit).toHaveBeenCalledWith(
          expect.objectContaining({
            setOption: expect.any(Function),
            resize: expect.any(Function),
            dispose: expect.any(Function),
          })
        );
      });
    });

    it('calls onChartInit with null on unmount', async () => {
      const onChartInit = vi.fn();

      const { unmount } = render(
        <EChartsRenderer
          rawJson={JSON.stringify(singleSeriesData)}
          validatedData={resolveValidatedData(singleSeriesData)}
          onChartInit={onChartInit}
        />
      );

      await waitFor(() => {
        expect(onChartInit).toHaveBeenCalledTimes(1);
      });

      unmount();

      expect(onChartInit).toHaveBeenCalledWith(null);
      expect(onChartInit).toHaveBeenCalledTimes(2);
    });

    it('does not call onChartInit when not provided', async () => {
      render(
        <EChartsRenderer
          rawJson={JSON.stringify(singleSeriesData)}
          validatedData={resolveValidatedData(singleSeriesData)}
        />
      );

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalledTimes(1);
      });

      expect(mockInit).toHaveBeenCalled();
    });
  });

  it('shows error alert when echarts.init throws', async () => {
    mockInit.mockImplementationOnce(() => {
      throw new Error('init failed');
    });

    render(
      <EChartsRenderer
        rawJson={JSON.stringify(singleSeriesData)}
        validatedData={resolveValidatedData(singleSeriesData)}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    expect(mockSetOption).not.toHaveBeenCalled();
  });

  it('shows error alert when buildChartOption returns null', async () => {
    const chartOptions =
      await import('../../../src/components/ECharts/chart-options/index.js');
    const spy = vi
      .spyOn(chartOptions, 'buildChartOption')
      .mockReturnValue(null);

    render(
      <EChartsRenderer
        rawJson={JSON.stringify(singleSeriesData)}
        validatedData={resolveValidatedData(singleSeriesData)}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    spy.mockRestore();
  });
});
