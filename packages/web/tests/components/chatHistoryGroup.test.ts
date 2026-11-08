import { describe, it, expect } from 'vitest';
import {
  chatHistoryGroupKey,
  getChatActivityDate,
  getChatHistoryGroup,
  sortChatsByActivity,
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

describe('getChatActivityDate', () => {
  it('uses updatedDate when it is set', () => {
    expect(
      getChatActivityDate({ createdDate: '100', updatedDate: '200' })
    ).toBe('200');
  });

  it('falls back to createdDate for chats saved before updatedDate existed', () => {
    expect(getChatActivityDate({ createdDate: '100', updatedDate: '' })).toBe(
      '100'
    );
  });
});

describe('sortChatsByActivity', () => {
  it('moves an old chat that was used recently above newer idle chats', () => {
    // API order: newest createdDate first.
    const chats = [
      { chatId: 'new', createdDate: at(2026, 11, 5), updatedDate: '' },
      {
        chatId: 'old-but-active',
        createdDate: at(2026, 3, 1),
        updatedDate: at(2026, 11, 7, 8),
      },
    ];
    expect(sortChatsByActivity(chats).map((c) => c.chatId)).toEqual([
      'old-but-active',
      'new',
    ]);
  });

  it('keeps the API order for equal times and does not mutate the input', () => {
    const chats = [
      { chatId: 'a', createdDate: '100', updatedDate: '' },
      { chatId: 'b', createdDate: '100', updatedDate: '' },
    ];
    expect(sortChatsByActivity(chats).map((c) => c.chatId)).toEqual(['a', 'b']);
    expect(chats.map((c) => c.chatId)).toEqual(['a', 'b']);
  });

  it('sorts unparsable dates last', () => {
    const chats = [
      { chatId: 'bad', createdDate: 'x', updatedDate: '' },
      { chatId: 'ok', createdDate: '100', updatedDate: '' },
    ];
    expect(sortChatsByActivity(chats).map((c) => c.chatId)).toEqual([
      'ok',
      'bad',
    ]);
  });
});
