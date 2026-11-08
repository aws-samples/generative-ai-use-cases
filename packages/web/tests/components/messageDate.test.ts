import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  parseMessageDate,
} from '../../src/utils/messageDate';

describe('parseMessageDate', () => {
  it('reads the epoch milliseconds before the index suffix', () => {
    expect(parseMessageDate('1794093981122#1')?.getTime()).toBe(1794093981122);
  });

  it('accepts a value without the index suffix', () => {
    expect(parseMessageDate('1794093981122')?.getTime()).toBe(1794093981122);
  });

  it('returns undefined for messages that are not saved yet', () => {
    expect(parseMessageDate(undefined)).toBeUndefined();
    expect(parseMessageDate('')).toBeUndefined();
  });

  it('returns undefined for unparsable values', () => {
    expect(parseMessageDate('abc#0')).toBeUndefined();
    expect(parseMessageDate('0#0')).toBeUndefined();
  });
});

describe('formatRelativeTime', () => {
  const now = new Date(2026, 10, 8, 14, 0); // 2026-11-08 14:00 local
  const fmt = (date: Date) => formatRelativeTime(date, now, 'en');

  it('says now for the first minute', () => {
    expect(fmt(new Date(2026, 10, 8, 13, 59, 30))).toBe('now');
  });

  it('uses minutes and hours for today', () => {
    expect(fmt(new Date(2026, 10, 8, 13, 15))).toBe('45 minutes ago');
    expect(fmt(new Date(2026, 10, 8, 11, 0))).toBe('3 hours ago');
  });

  it('uses the local day boundary for yesterday', () => {
    expect(fmt(new Date(2026, 10, 7, 23, 50))).toBe('yesterday');
    expect(
      formatRelativeTime(
        new Date(2026, 10, 7, 23, 50),
        new Date(2026, 10, 8, 0, 5),
        'en'
      )
    ).toBe('yesterday');
  });

  it('counts days, then months, then years', () => {
    expect(fmt(new Date(2026, 10, 3, 9, 0))).toBe('5 days ago');
    expect(fmt(new Date(2026, 8, 20))).toBe('2 months ago');
    expect(fmt(new Date(2025, 9, 1))).toBe('last year');
  });

  it('treats a future time (clock skew) as now', () => {
    expect(fmt(new Date(2026, 10, 8, 14, 3))).toBe('now');
  });

  it('follows the UI language', () => {
    expect(formatRelativeTime(new Date(2026, 10, 7, 9), now, 'es')).toBe(
      'ayer'
    );
  });
});
