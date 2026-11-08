import { describe, it, expect } from 'vitest';
import { parseMessageDate } from '../../src/utils/messageDate';

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
