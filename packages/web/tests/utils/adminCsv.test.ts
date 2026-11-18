import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '../../src/utils/adminCsv';

describe('csvCell', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])(
    'keeps %j from running as a formula',
    (value) => {
      expect(csvCell(value)).toBe(`"'${value}"`);
    }
  );

  it('doubles quotes', () => {
    expect(csvCell('a"b')).toBe('"a""b"');
  });

  it('writes numbers as they are, including negative ones', () => {
    expect(csvCell(-1.5)).toBe('"-1.5"');
    expect(csvCell(0)).toBe('"0"');
  });

  it('writes an empty cell for undefined', () => {
    expect(csvCell(undefined)).toBe('""');
  });
});

describe('toCsv', () => {
  it('writes a header and one row per user', () => {
    const csv = toCsv([
      {
        userId: 'u1',
        email: '=evil@example.com',
        executions: 2,
        inputTokens: 10,
        outputTokens: 5,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
        estimatedCostUsd: 0.01,
        lastActiveDate: '2026-11-01',
      },
    ]);
    const [header, row] = csv.split('\n');
    expect(header.startsWith('"userId","email","executions"')).toBe(true);
    expect(row).toBe(
      '"u1","\'=evil@example.com","2","10","5","0","0","0.01","2026-11-01"'
    );
  });
});
