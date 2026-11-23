/**
 * Long pasted text is attached as a text file instead of being inserted into
 * the prompt.
 *
 * A chat message is stored as a single DynamoDB item, which is limited to
 * 400 KB. Inserted as text, a long paste makes the message too large to save in
 * full. As an attachment it is stored in S3 and the message only keeps a
 * reference, while the model still receives the whole text as a document.
 */

/** UTF-8 size from which pasted text is attached instead of inserted. */
export const PASTED_TEXT_ATTACHMENT_THRESHOLD_BYTES = 100 * 1024;

const TEXT_FILE_EXTENSION = '.txt';

const utf8ByteLength = (text: string): number =>
  new TextEncoder().encode(text).length;

/**
 * Should `text` be attached as a file? Only when it is long enough and the
 * current model accepts text documents.
 */
export const shouldAttachPastedText = (
  text: string,
  accept: string[] | undefined
): boolean =>
  !!accept?.includes(TEXT_FILE_EXTENSION) &&
  // A UTF-8 character takes at most 4 bytes, so shorter text cannot reach the
  // threshold and is not encoded.
  text.length * 4 >= PASTED_TEXT_ATTACHMENT_THRESHOLD_BYTES &&
  utf8ByteLength(text) >= PASTED_TEXT_ATTACHMENT_THRESHOLD_BYTES;

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * `pasted-text-YYYYMMDD-HHMMSS-mmm.txt` in local time. The milliseconds keep
 * two pastes in a row apart: documents in one request should not share a name.
 */
export const pastedTextFileName = (date: Date): string =>
  `pasted-text-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate()
  )}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(
    date.getSeconds()
  )}-${String(date.getMilliseconds()).padStart(3, '0')}${TEXT_FILE_EXTENSION}`;

export const createPastedTextFile = (text: string, date = new Date()): File =>
  new File([text], pastedTextFileName(date), { type: 'text/plain' });
