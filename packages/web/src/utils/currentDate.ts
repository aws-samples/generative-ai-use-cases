import { ShownMessage } from 'generative-ai-use-cases';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * One line telling the model today's date in the user's own time zone.
 *
 * The browser builds it, not Lambda: Lambda runs in UTC, which is the previous
 * day for Japanese users until 09:00. Only the date is given (no time), so the
 * system prompt changes once a day and prompt caching keeps working.
 */
export const currentDateLine = (
  now: Date = new Date(),
  timeZone: string | undefined = Intl.DateTimeFormat().resolvedOptions()
    .timeZone
): string => {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  // Older engines may not report a time zone; then it is left out.
  const zone = timeZone ? `, time zone: ${timeZone}` : '';
  return `Today's date is ${date} (${WEEKDAYS[now.getDay()]}${zone}).`;
};

/**
 * Add today's date to the system message of a request.
 *
 * Used as `preProcessInput`, so it changes only what is sent to the model:
 * the system message stored with the chat stays as the user wrote it, and a
 * chat resumed on a later day gets that day's date.
 */
export const withCurrentDate = (
  messages: ShownMessage[],
  now: Date = new Date()
): ShownMessage[] =>
  messages.map((message, i) =>
    i === 0 && message.role === 'system'
      ? {
          ...message,
          content: [message.content.trim(), currentDateLine(now)]
            .filter((s) => s !== '')
            .join('\n\n'),
        }
      : message
  );
