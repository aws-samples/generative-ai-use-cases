/**
 * Text-based document formats whose bytes Bedrock interprets as text.
 * Binary formats (pdf, doc, docx, xls, xlsx) must never be re-encoded.
 */
const TEXT_DOCUMENT_FORMATS = new Set(['txt', 'csv', 'md', 'html']);

/**
 * Legacy Japanese encodings to try, in order, when the bytes are not valid UTF-8.
 * Shift_JIS is first because it is by far the most common on Japanese systems.
 */
const FALLBACK_ENCODINGS = ['shift_jis', 'euc-jp'];

const isValidUtf8 = (bytes: Uint8Array): boolean => {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
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

  if (isValidUtf8(bytes)) {
    return bytes;
  }

  for (const encoding of FALLBACK_ENCODINGS) {
    try {
      const decoded = new TextDecoder(encoding, { fatal: true }).decode(bytes);
      return new TextEncoder().encode(decoded);
    } catch {
      // Not this encoding; try the next candidate
    }
  }

  // Unknown encoding. Leave the bytes alone so Bedrock reports the problem.
  return bytes;
};
