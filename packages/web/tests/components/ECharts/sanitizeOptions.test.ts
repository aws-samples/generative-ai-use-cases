import { describe, expect, it } from 'vitest';
import { sanitizeOptions } from '../../../src/components/ECharts/chart-options/sanitize';
import { deepMerge } from '../../../src/components/ECharts/chart-options/deep-merge';

describe('sanitizeOptions', () => {
  // formatter — allowed
  it('allows safe template formatter {b}', () => {
    expect(sanitizeOptions({ tooltip: { formatter: '{b}' } })).toEqual({
      tooltip: { formatter: '{b}' },
    });
  });

  it('allows safe template formatter {a}: {c}%', () => {
    expect(sanitizeOptions({ tooltip: { formatter: '{a}: {c}%' } })).toEqual({
      tooltip: { formatter: '{a}: {c}%' },
    });
  });

  it('allows richText style formatter {a|highlight}', () => {
    expect(
      sanitizeOptions({ tooltip: { formatter: '{a|highlight}' } })
    ).toEqual({ tooltip: { formatter: '{a|highlight}' } });
  });

  it('allows formatter with HTML-like text (richText renders as literal)', () => {
    expect(
      sanitizeOptions({ tooltip: { formatter: '{b}<img src=x>' } })
    ).toEqual({ tooltip: { formatter: '{b}<img src=x>' } });
  });

  // formatter — blocked (function-like)
  it('blocks function() {} formatter', () => {
    expect(
      sanitizeOptions({ tooltip: { formatter: 'function() {}' } })
    ).toEqual({ tooltip: {} });
  });

  it('blocks arrow function formatter', () => {
    expect(sanitizeOptions({ tooltip: { formatter: 'a => 1' } })).toEqual({
      tooltip: {},
    });
  });

  it('blocks new Function formatter', () => {
    expect(
      sanitizeOptions({ tooltip: { formatter: 'new Function("alert(1)")' } })
    ).toEqual({ tooltip: {} });
  });

  it('blocks eval formatter', () => {
    expect(sanitizeOptions({ tooltip: { formatter: 'eval("x")' } })).toEqual({
      tooltip: {},
    });
  });

  it('blocks <script> formatter', () => {
    expect(
      sanitizeOptions({ tooltip: { formatter: '<script>alert(1)</script>' } })
    ).toEqual({ tooltip: {} });
  });

  it('blocks empty string formatter', () => {
    expect(sanitizeOptions({ tooltip: { formatter: '' } })).toEqual({
      tooltip: {},
    });
  });

  it('blocks formatter longer than 500 chars', () => {
    const long = 'a'.repeat(501);
    expect(sanitizeOptions({ tooltip: { formatter: long } })).toEqual({
      tooltip: {},
    });
  });

  it('blocks function object formatter', () => {
    const input = { tooltip: { formatter: (() => 'x') as unknown as string } };
    expect(sanitizeOptions(input)).toEqual({ tooltip: {} });
  });

  // symbolSize
  it('allows numeric symbolSize', () => {
    expect(sanitizeOptions({ series: [{ symbolSize: 20 }] })).toEqual({
      series: [{ symbolSize: 20 }],
    });
  });

  it('allows [width, height] symbolSize', () => {
    expect(sanitizeOptions({ series: [{ symbolSize: [10, 20] }] })).toEqual({
      series: [{ symbolSize: [10, 20] }],
    });
  });

  it('blocks function string symbolSize', () => {
    expect(
      sanitizeOptions({ series: [{ symbolSize: 'function(d){return d}' }] })
    ).toEqual({ series: [{}] });
  });

  it('blocks symbolSize exceeding 1000', () => {
    expect(sanitizeOptions({ series: [{ symbolSize: 9999 }] })).toEqual({
      series: [{}],
    });
  });

  // URL drop (reviewer ISSUE 1)
  it('drops image URL in rich.backgroundColor.image', () => {
    const richInput = {
      rich: { a: { backgroundColor: { image: 'https://evil/?session=xxx' } } },
    };
    expect(sanitizeOptions(richInput)).toEqual({});
  });

  it('strips rich key from options', () => {
    const input = {
      series: [
        { label: { rich: { a: { backgroundColor: 'image://evil.png' } } } },
      ],
    };
    const result = sanitizeOptions(input);
    expect(result).not.toHaveProperty('series[0].label.rich');
  });

  it('drops image:// symbol URL', () => {
    expect(sanitizeOptions({ series: [{ symbol: 'image://evil/x' }] })).toEqual(
      { series: [{}] }
    );
  });

  it('drops data: URL in backgroundColor', () => {
    expect(
      sanitizeOptions({
        tooltip: { backgroundColor: 'data:image/svg+xml,<svg>' },
      })
    ).toEqual({ tooltip: {} });
  });

  it('drops javascript: anywhere in string values', () => {
    expect(sanitizeOptions({ a: 'javascript:alert(1)' })).toEqual({});
  });

  it('drops URLs nested in arrays and keeps the other items in place', () => {
    expect(
      sanitizeOptions({
        series: [
          {
            markLine: { symbol: ['none', 'image://https://example.com/x.png'] },
            itemStyle: {
              decal: { symbol: ['rect', 'image://data:image/svg+xml,<svg/>'] },
            },
          },
        ],
        visualMap: { inRange: { symbol: ['circle', '//example.com/a.png'] } },
        xAxis: { data: ['Jan', 'Feb'] },
      })
    ).toEqual({
      series: [
        {
          markLine: { symbol: ['none', ''] },
          itemStyle: { decal: { symbol: ['rect', ''] } },
        },
      ],
      visualMap: { inRange: { symbol: ['circle', ''] } },
      xAxis: { data: ['Jan', 'Feb'] },
    });
  });

  it('drops // protocol-relative URL', () => {
    expect(sanitizeOptions({ a: '//cdn.example.com/x.png' })).toEqual({});
  });

  // proto pollution & existing blocks
  it('blocks __proto__ key', () => {
    const proto = JSON.parse('{"__proto__": {"polluted": true}, "safe": 1}');
    const safeResult = sanitizeOptions(proto) as Record<string, unknown>;
    expect(Object.hasOwn(safeResult, '__proto__')).toBe(false);
    expect(safeResult.safe).toBe(1);
  });

  it('blocks constructor key', () => {
    const input = { constructor: { name: 'evil' }, safe: 1 };
    const result = sanitizeOptions(input) as Record<string, unknown>;
    expect(Object.hasOwn(result, 'constructor')).toBe(false);
    expect(result.safe).toBe(1);
  });

  it('blocks extraCssText', () => {
    expect(sanitizeOptions({ extraCssText: 'background:url(evil)' })).toEqual(
      {}
    );
  });

  it('blocks graphic', () => {
    expect(sanitizeOptions({ graphic: [{}] })).toEqual({});
  });

  // LLM real example 1
  it('passes through visualMap config (LLM example 1)', () => {
    const llm1 = {
      visualMap: {
        min: 0,
        max: 480,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '5%',
      },
    };
    expect(sanitizeOptions(llm1)).toEqual(llm1);
  });

  // LLM real example 2
  it('drops symbolSize function string but keeps label.formatter and visualMap (LLM example 2)', () => {
    const llm2 = sanitizeOptions({
      series: [
        {
          symbolSize: 'function(data) { return data[2] / 10; }',
          label: { show: true, formatter: '{b}', position: 'top' },
        },
      ],
      visualMap: {
        min: 330,
        max: 480,
        dimension: 2,
        inRange: { color: ['#50a3ba', '#eac736', '#d94e5d'] },
        text: ['High', 'Low'],
        calculable: true,
      },
    }) as {
      series: Array<{
        symbolSize?: unknown;
        label: { show: boolean; formatter: string; position: string };
      }>;
      visualMap: { dimension: number; text: string[] };
    };
    expect(llm2.series[0].symbolSize).toBeUndefined();
    expect(llm2.series[0].label).toEqual({
      show: true,
      formatter: '{b}',
      position: 'top',
    });
    expect(llm2.visualMap.dimension).toBe(2);
    expect(llm2.visualMap.text).toEqual(['High', 'Low']);
  });

  // safe options pass through
  it('passes safe options through unchanged', () => {
    const input = { yAxis: { min: 0 }, legend: { show: true } };
    expect(sanitizeOptions(input)).toEqual(input);
  });

  // new blocked keys
  it('blocks toolbox', () => {
    expect(sanitizeOptions({ toolbox: { feature: { dataView: {} } } })).toEqual(
      {}
    );
  });

  it('blocks brush', () => {
    expect(sanitizeOptions({ brush: { toolbox: ['rect'] } })).toEqual({});
  });

  it('blocks dataset', () => {
    expect(sanitizeOptions({ dataset: { source: [[1, 2]] } })).toEqual({});
  });

  it('blocks encode', () => {
    expect(sanitizeOptions({ encode: { x: 0, y: 1 } })).toEqual({});
  });

  it('blocks dataset and encode together', () => {
    expect(
      sanitizeOptions({ dataset: { source: [[1, 2]] }, encode: { x: 0, y: 1 } })
    ).toEqual({});
  });

  it('blocks link (title navigation)', () => {
    expect(sanitizeOptions({ title: { text: 'x', link: '/admin' } })).toEqual({
      title: { text: 'x' },
    });
  });

  it('blocks sublink (title subtext navigation)', () => {
    expect(
      sanitizeOptions({ title: { text: 'x', sublink: '?logout' } })
    ).toEqual({ title: { text: 'x' } });
  });

  it('blocks target', () => {
    expect(sanitizeOptions({ title: { text: 'x', target: '_blank' } })).toEqual(
      { title: { text: 'x' } }
    );
  });

  it('blocks renderItem', () => {
    expect(
      sanitizeOptions({
        series: [{ type: 'custom', renderItem: 'function(){}' }],
      })
    ).toEqual({ series: [{ type: 'custom' }] });
  });

  it('blocks labelLayout', () => {
    expect(
      sanitizeOptions({ series: [{ labelLayout: { moveOverlap: 'shiftX' } }] })
    ).toEqual({ series: [{}] });
  });

  it('blocks animationDelay', () => {
    expect(sanitizeOptions({ animationDelay: 300 })).toEqual({});
  });

  it('blocks animationDurationUpdate', () => {
    expect(sanitizeOptions({ animationDurationUpdate: 1000 })).toEqual({});
  });

  it('blocks animationDelayUpdate', () => {
    expect(sanitizeOptions({ animationDelayUpdate: 200 })).toEqual({});
  });

  // depth limit
  it('truncates objects nested beyond maxDepth', () => {
    let deep: Record<string, unknown> = { value: 'leaf' };
    for (let i = 0; i < 15; i++) deep = { a: deep };
    const result = sanitizeOptions(deep) as Record<string, unknown>;
    // Walk 9 levels deep (depths 0-8 each have an 'a' key)
    let node: unknown = result;
    for (let i = 0; i < 9; i++) {
      expect(node).toBeDefined();
      node = (node as Record<string, unknown>).a;
    }
    // At depth 9, the 'a' child is processed at depth 10 (>= maxDepth) → returns undefined → omitted
    // So the object at depth 9 has no 'a' key
    expect(node).toEqual({});
    expect((node as Record<string, unknown>).a).toBeUndefined();
  });

  it('respects custom maxDepth', () => {
    const deep = { a: { b: { c: 'leaf' } } };
    const result = sanitizeOptions(deep, 2) as Record<string, unknown>;
    expect((result.a as Record<string, unknown>).b).toBeUndefined();
  });
});

describe('deepMerge', () => {
  it('handles depth-15 nesting without stack overflow', () => {
    let deep: Record<string, unknown> = { value: 'leaf' };
    for (let i = 0; i < 15; i++) deep = { a: deep };
    expect(() => deepMerge({}, deep)).not.toThrow();
  });

  it('uses source value as-is beyond maxDepth', () => {
    const source: Record<string, unknown> = { a: { b: { c: 'deep' } } };
    const result = deepMerge({}, source, 1);
    expect((result.a as Record<string, unknown>).b).toEqual({ c: 'deep' });
  });

  it('broadcast merge: type key is not overwritten', () => {
    const result = deepMerge(
      {
        series: [
          { type: 'bar', data: [1] },
          { type: 'bar', data: [2] },
        ],
      },
      { series: { type: 'scatter', label: { show: true } } }
    ) as { series: Array<{ type: string; label: { show: boolean } }> };
    expect(result.series[0].type).toBe('bar');
    expect(result.series[1].type).toBe('bar');
    expect(result.series[0].label).toEqual({ show: true });
    expect(result.series[1].label).toEqual({ show: true });
  });

  it('broadcast merge: non-type properties are applied to all elements', () => {
    const result = deepMerge(
      {
        series: [
          { type: 'bar', name: 'A' },
          { type: 'bar', name: 'B' },
        ],
      },
      { series: { itemStyle: { color: 'red' }, label: { show: true } } }
    ) as {
      series: Array<{
        type: string;
        name: string;
        itemStyle: { color: string };
        label: { show: boolean };
      }>;
    };
    expect(result.series[0].type).toBe('bar');
    expect(result.series[0].name).toBe('A');
    expect(result.series[0].itemStyle).toEqual({ color: 'red' });
    expect(result.series[0].label).toEqual({ show: true });
    expect(result.series[1].type).toBe('bar');
    expect(result.series[1].name).toBe('B');
    expect(result.series[1].itemStyle).toEqual({ color: 'red' });
    expect(result.series[1].label).toEqual({ show: true });
  });
});
