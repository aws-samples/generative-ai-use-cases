import { describe, it, expect } from 'vitest';
import { ShownMessage } from 'generative-ai-use-cases';
import { CHAT_FORMATTING_INSTRUCTIONS } from '@generative-ai-use-cases/common';
import {
  currentDateLine,
  withChatContext,
  withCurrentDate,
} from '../../src/utils/currentDate';

const now = new Date(2026, 10, 7, 8, 30); // 2026-11-07 08:30 local, a Saturday

describe('currentDateLine', () => {
  it('uses the local calendar date, weekday and time zone', () => {
    expect(currentDateLine(now, 'Asia/Tokyo')).toBe(
      "Today's date is 2026-11-07 (Saturday, time zone: Asia/Tokyo)."
    );
  });

  it('leaves out the time zone when the browser does not report one', () => {
    expect(currentDateLine(now, '')).toBe(
      "Today's date is 2026-11-07 (Saturday)."
    );
  });

  it('does not include the time, so it changes only once a day', () => {
    const later = new Date(2026, 10, 7, 23, 59);
    expect(currentDateLine(later, 'UTC')).toBe(currentDateLine(now, 'UTC'));
  });
});

describe('withCurrentDate', () => {
  const messages: ShownMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What day is it next Wednesday?' },
  ];

  it('appends the date to the system message only', () => {
    const result = withCurrentDate(messages, now);
    expect(result[0].content).toMatch(
      /^You are a helpful assistant\.\n\nToday's date is 2026-11-07 \(Saturday, /
    );
    expect(result[1]).toBe(messages[1]);
  });

  it('does not modify the stored messages', () => {
    withCurrentDate(messages, now);
    expect(messages[0].content).toBe('You are a helpful assistant.');
  });

  it('handles an empty system prompt', () => {
    const result = withCurrentDate(
      [{ role: 'system', content: '' }, messages[1]],
      now
    );
    expect(result[0].content).toMatch(/^Today's date is 2026-11-07/);
  });

  it('leaves messages without a leading system message unchanged', () => {
    const userOnly: ShownMessage[] = [messages[1]];
    expect(withCurrentDate(userOnly, now)).toEqual(userOnly);
  });
});

describe('withChatContext', () => {
  const messages: ShownMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Draw the flow.' },
  ];

  it('adds the formatting section and then the date to the system message', () => {
    const result = withChatContext(messages, now);
    expect(result[0].content).toBe(
      [
        'You are a helpful assistant.',
        CHAT_FORMATTING_INSTRUCTIONS,
        currentDateLine(now),
      ].join('\n\n')
    );
    expect(result[1]).toBe(messages[1]);
    expect(messages[0].content).toBe('You are a helpful assistant.');
  });

  it('keeps the formatting section when the user replaced the system prompt', () => {
    const result = withChatContext(
      [{ role: 'system', content: 'Answer like a pirate.' }, messages[1]],
      now
    );
    expect(result[0].content).toContain('Answer like a pirate.');
    expect(result[0].content).toContain(CHAT_FORMATTING_INSTRUCTIONS);
  });

  it('describes only what the chat renders', () => {
    for (const fence of ['```mermaid', '```chart', '```svg', '$$...$$']) {
      expect(CHAT_FORMATTING_INSTRUCTIONS).toContain(fence);
    }
  });
});
