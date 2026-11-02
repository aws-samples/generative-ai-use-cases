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
 * Decode legacy Japanese text, or return null when the bytes are neither EUC-JP
 * nor Shift_JIS.
 *
 * EUC-JP is checked before Shift_JIS. Most EUC-JP text is also a valid Shift_JIS
 * byte sequence (0xA1-0xDF are halfwidth katakana in Shift_JIS), so trying
 * Shift_JIS first turns EUC-JP files into garbage. The opposite rarely happens:
 * Shift_JIS kanji and fullwidth kana use lead bytes 0x81-0x9F, which are not
 * valid in EUC-JP. The same order is used by established detectors such as
 * encoding.js.
 *
 * Known limitation: Shift_JIS text made only of halfwidth katakana and ASCII,
 * where the katakana come in pairs (e.g. 'ｶﾅ'), is also valid EUC-JP and is read
 * as EUC-JP kanji. No byte-level check can tell the two apart.
 */
const decodeLegacyJapanese = (bytes: Uint8Array): string | null => {
  if (isEucJp(bytes)) {
    const decoded = decodeStrict(bytes, 'euc-jp');
    if (decoded !== null) return decoded;
  }
  return decodeStrict(bytes, 'shift_jis');
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
