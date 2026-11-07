import { describe, it, expect } from 'vitest';
import {
  chatHistoryGroupKey,
  getChatHistoryGroup,
} from '../../src/utils/chatHistoryGroup';

// Local-time dates, matching how the browser draws day boundaries.
const at = (y: number, m: number, d: number, h = 12) =>
  `${new Date(y, m - 1, d, h).getTime()}`;
const now = new Date(2026, 10, 7, 9, 0); // 2026-11-07 09:00 local

describe('getChatHistoryGroup', () => {
  it('puts a chat from earlier today in today', () => {
    expect(getChatHistoryGroup(at(2026, 11, 7, 0), now)).toEqual({
      kind: 'today',
    });
  });

  it('uses the local day boundary, not 24 hours', () => {
    // 23:30 yesterday is under 24 hours ago but still yesterday.
    expect(getChatHistoryGroup(at(2026, 11, 6, 23), now).kind).toBe(
      'yesterday'
    );
  });

  it('groups 2-6 days ago as the previous 7 days', () => {
    expect(getChatHistoryGroup(at(2026, 11, 5), now).kind).toBe('last_7_days');
    expect(getChatHistoryGroup(at(2026, 11, 1), now).kind).toBe('last_7_days');
  });

  it('groups 7-29 days ago as the previous 30 days', () => {
    expect(getChatHistoryGroup(at(2026, 10, 31), now).kind).toBe(
      'last_30_days'
    );
    expect(getChatHistoryGroup(at(2026, 10, 9), now).kind).toBe('last_30_days');
  });

  it('groups older chats by calendar month', () => {
    const group = getChatHistoryGroup(at(2026, 3, 15), now);
    expect(group).toEqual({ kind: 'month', year: 2026, month: 3 });
    expect(chatHistoryGroupKey(group)).toBe('2026-3');
  });

  it('puts an unparsable date in today instead of an invalid month', () => {
    expect(getChatHistoryGroup('not-a-date', now)).toEqual({ kind: 'today' });
  });

  it('treats a future timestamp (clock skew) as today', () => {
    expect(getChatHistoryGroup(at(2026, 11, 8), now).kind).toBe('today');
  });
});
