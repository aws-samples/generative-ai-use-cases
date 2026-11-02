/**
 * Text-based document formats whose bytes Bedrock interprets as text.
 * Binary formats (pdf, doc, docx, xls, xlsx) must never be re-encoded.
 */
const TEXT_DOCUMENT_FORMATS = new Set(['txt', 'csv', 'md', 'html']);

const decodeStrict = (bytes: Uint8Array, encoding: string): string | null => {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
};

/**
 * Check that every non-ASCII byte forms a valid EUC-JP sequence:
 * - 0xA1-0xFE followed by 0xA1-0xFE (JIS X 0208)
 * - 0x8E followed by 0xA1-0xDF (halfwidth katakana)
 * - 0x8F followed by two bytes in 0xA1-0xFE (JIS X 0212)
 *
 * TextDecoder('euc-jp', { fatal: true }) cannot be used for this: it lets bytes in
 * 0x80-0x8D through instead of throwing, so most Shift_JIS text (whose lead bytes
 * are 0x81-0x9F) would be accepted as EUC-JP and turned into garbage.
 */
const isEucJp = (bytes: Uint8Array): boolean => {
  const inRange = (b: number | undefined, min: number, max: number) =>
    b !== undefined && b >= min && b <= max;

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) continue;

    if (b === 0x8e) {
      if (!inRange(bytes[++i], 0xa1, 0xdf)) return false;
    } else if (b === 0x8f) {
      if (!inRange(bytes[++i], 0xa1, 0xfe)) return false;
      if (!inRange(bytes[++i], 0xa1, 0xfe)) return false;
    } else if (inRange(b, 0xa1, 0xfe)) {
      if (!inRange(bytes[++i], 0xa1, 0xfe)) return false;
    } else {
      return false;
    }
  }
  return true;
};

/**
 * Whether the text is only ASCII and halfwidth katakana, without the halfwidth
 * ideographic comma (U+FF64) and middle dot (U+FF65). Those two are what the
 * EUC-JP hiragana and katakana lead bytes (0xA4, 0xA5) turn into when EUC-JP is
 * read as Shift_JIS.
 */
const isAsciiAndHalfwidthKatakana = (text: string): boolean => {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const isAscii = c < 0x80;
    const isHalfwidthKatakana =
      c >= 0xff61 && c <= 0xff9f && c !== 0xff64 && c !== 0xff65;
    if (!isAscii && !isHalfwidthKatakana) return false;
  }
  return true;
};

/**
 * Decode legacy Japanese text, or return null when the bytes are neither EUC-JP
 * nor Shift_JIS.
 *
 * When only one of the two decodes, that one is used. Shift_JIS kanji and
 * fullwidth kana use lead bytes 0x81-0x9F, which are invalid in EUC-JP, so most
 * Shift_JIS text is not ambiguous.
 *
 * When both decode, the bytes are ambiguous. Most EUC-JP text is also valid
 * Shift_JIS (0xA1-0xDF are halfwidth katakana there), and Shift_JIS made only of
 * paired halfwidth katakana (common in bank transfer files) is also valid
 * EUC-JP. Shift_JIS is preferred because it is by far the more common of the two
 * today, but only when its reading is plain ASCII and halfwidth katakana.
 * Otherwise the Shift_JIS reading mixes halfwidth katakana with kanji or contains
 * U+FF64 / U+FF65, which is what EUC-JP looks like when read as Shift_JIS, and
 * EUC-JP is used.
 *
 * Known limitation: short EUC-JP text whose Shift_JIS reading is plain halfwidth
 * katakana (e.g. a two-kanji word such as NA-MAE) is read as Shift_JIS.
 */
const decodeLegacyJapanese = (bytes: Uint8Array): string | null => {
  const sjis = decodeStrict(bytes, 'shift_jis');
  const eucJp = isEucJp(bytes) ? decodeStrict(bytes, 'euc-jp') : null;

  if (sjis !== null && eucJp !== null) {
    return isAsciiAndHalfwidthKatakana(sjis) ? sjis : eucJp;
  }
  return sjis ?? eucJp;
};

/**
 * Convert a text document to UTF-8 when it is encoded in a legacy Japanese charset.
 *
 * Bedrock inspects the bytes of a document rather than trusting the declared format.
 * Shift_JIS content is detected as `application/octet-stream` and the request fails with
 * `ValidationException: Unsupported MIME type`. Re-encoding to UTF-8 makes the same
 * content acceptable, so users do not have to convert the file themselves.
 *
 * Bytes are returned unchanged when the format is binary, when they are already valid
 * UTF-8, or when no candidate encoding decodes them cleanly.
 *
 * @param bytes Raw file content
 * @param format Bedrock document format (e.g. 'csv', 'pdf')
 * @returns UTF-8 encoded bytes, or the original bytes when no conversion applies
 */
export const convertTextDocumentToUtf8 = (
  bytes: Uint8Array,
  format: string
): Uint8Array => {
  if (!TEXT_DOCUMENT_FORMATS.has(format)) {
    return bytes;
  }

  if (decodeStrict(bytes, 'utf-8') !== null) {
    return bytes;
  }

  const decoded = decodeLegacyJapanese(bytes);
  if (decoded !== null) {
    return new TextEncoder().encode(decoded);
  }

  // Unknown encoding. Leave the bytes alone so Bedrock reports the problem.
  return bytes;
};
