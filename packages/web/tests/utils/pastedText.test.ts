import { describe, expect, it } from 'vitest';
import {
  PASTED_TEXT_ATTACHMENT_THRESHOLD_BYTES,
  createPastedTextFile,
  pastedTextFileName,
  shouldAttachPastedText,
} from '../../src/utils/pastedText';

const ACCEPT_WITH_TEXT = ['.pdf', '.txt', '.png'];
const ACCEPT_IMAGES_ONLY = ['.png', '.jpeg'];

// A three-byte UTF-8 character (HIRAGANA LETTER A).
const MULTI_BYTE = String.fromCodePoint(0x3042);

describe('shouldAttachPastedText', () => {
  it('keeps short text inline', () => {
    expect(shouldAttachPastedText('hello', ACCEPT_WITH_TEXT)).toBe(false);
  });

  it('attaches text at the threshold', () => {
    const text = 'a'.repeat(PASTED_TEXT_ATTACHMENT_THRESHOLD_BYTES);
    expect(shouldAttachPastedText(text, ACCEPT_WITH_TEXT)).toBe(true);
  });

  it('measures the threshold in UTF-8 bytes, not characters', () => {
    const length = Math.ceil(PASTED_TEXT_ATTACHMENT_THRESHOLD_BYTES / 3);
    expect(
      shouldAttachPastedText(MULTI_BYTE.repeat(length), ACCEPT_WITH_TEXT)
    ).toBe(true);
    expect(shouldAttachPastedText('a'.repeat(length), ACCEPT_WITH_TEXT)).toBe(
      false
    );
  });

  it('keeps text inline when the model does not accept text documents', () => {
    const text = 'a'.repeat(PASTED_TEXT_ATTACHMENT_THRESHOLD_BYTES * 2);
    expect(shouldAttachPastedText(text, ACCEPT_IMAGES_ONLY)).toBe(false);
    expect(shouldAttachPastedText(text, undefined)).toBe(false);
  });
});

describe('createPastedTextFile', () => {
  it('names the file after the paste time', () => {
    expect(pastedTextFileName(new Date(2026, 10, 1, 9, 5, 7, 42))).toBe(
      'pasted-text-20261101-090507-042.txt'
    );
  });

  it('keeps the whole text as a plain text file', async () => {
    const text = `${MULTI_BYTE}\nline 2`;
    const file = createPastedTextFile(text, new Date(2026, 0, 2, 3, 4, 5));
    expect(file.name).toBe('pasted-text-20260102-030405-000.txt');
    expect(file.type).toBe('text/plain');
    expect(await file.text()).toBe(text);
  });
});
