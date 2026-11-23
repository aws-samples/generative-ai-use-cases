import { UnrecordedMessage } from 'generative-ai-use-cases';

/**
 * Keep a message record within DynamoDB's 400 KB item limit.
 *
 * A message that is too large (a very long pasted input, or a long agent trace)
 * makes `BatchWriteItem` fail with `ValidationException: Item size has exceeded
 * the maximum allowed size`, and the whole turn is lost. Records that fit are
 * stored unchanged. Larger ones degrade in this order:
 *
 * 1. clamp `trace`, lowering the cap until the record fits,
 * 2. drop `trace` and keep the head of `content` (and `extraData` when it is
 *    small enough to keep).
 *
 * `content` is the part the user reads, so it is only truncated in the last
 * step.
 */

/**
 * Budget for the whole record. DynamoDB's hard limit is 400 KB per item; the
 * headroom covers DynamoDB's own per attribute name overhead, which
 * `JSON.stringify` only approximates.
 */
const MESSAGE_BUDGET_BYTES = 300 * 1024;

/** Starting cap for `trace` when the record is too big. */
const TRACE_MAX_BYTES = 32 * 1024;

/** Cap below which a trace no longer carries useful context. */
const TRACE_MIN_BYTES = 512;

const byteLength = (text: string): number => Buffer.byteLength(text, 'utf8');

const jsonByteLength = (value: unknown): number => {
  const json = JSON.stringify(value);
  return json === undefined ? 0 : byteLength(json);
};

const fits = (message: unknown): boolean =>
  jsonByteLength(message) <= MESSAGE_BUDGET_BYTES;

const truncationNote = (omittedBytes: number): string =>
  `\n\n[truncated: ${omittedBytes} bytes omitted to fit the message size limit]`;

/**
 * Cut `text` down to `maxBytes` UTF-8 bytes and say so.
 *
 * Slicing the buffer can land in the middle of a multi byte sequence, which
 * decodes to a replacement character; it is dropped so the stored text stays
 * valid.
 */
export const truncateToBytes = (text: string, maxBytes: number): string => {
  const totalBytes = byteLength(text);
  if (totalBytes <= maxBytes) return text;

  const note = truncationNote(totalBytes - maxBytes);
  const bodyBytes = Math.max(0, maxBytes - byteLength(note));
  let body = Buffer.from(text, 'utf8').subarray(0, bodyBytes).toString('utf8');
  if (body.endsWith('\uFFFD')) body = body.slice(0, -1);

  return `${body}${note}`;
};

const withoutTrace = <T extends UnrecordedMessage>(message: T): T => {
  const copy = { ...message };
  // The key is deleted rather than set to undefined: the document client is not
  // configured to strip undefined values and would reject the write.
  delete copy.trace;
  return copy;
};

/** Last resort: no trace, and the head of `content` in what budget is left. */
const contentOnly = <T extends UnrecordedMessage>(message: T): T => {
  let base: T = { ...withoutTrace(message), content: '' };
  if (!fits(base)) {
    base = { ...base };
    delete base.extraData;
  }
  // `content` is serialized as a JSON string, so escaping can make it larger
  // than its UTF-8 length. Halve the cap until the record fits.
  let cap = MESSAGE_BUDGET_BYTES - jsonByteLength(base);
  while (cap > 0) {
    const capped = { ...base, content: truncateToBytes(message.content, cap) };
    if (fits(capped)) return capped;
    cap = Math.floor(cap / 2);
  }
  return base;
};

/** Return the message unchanged when it fits, or a smaller copy that does. */
export const capMessageToItemLimit = <T extends UnrecordedMessage>(
  message: T
): T => {
  if (fits(message)) return message;

  if (message.trace) {
    for (let cap = TRACE_MAX_BYTES; cap >= TRACE_MIN_BYTES; cap /= 4) {
      const capped = { ...message, trace: truncateToBytes(message.trace, cap) };
      if (fits(capped)) return capped;
    }
  }

  return contentOnly(message);
};
