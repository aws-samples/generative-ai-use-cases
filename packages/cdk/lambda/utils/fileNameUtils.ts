import crypto from 'crypto';

// DocumentBlock.name is documented as "Minimum length of 1. Maximum length of 200."
// https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_DocumentBlock.html
const MAX_DOCUMENT_NAME_LENGTH = 200;
const HASH_LENGTH = 8;

/**
 * Convert filename to safe format for AWS Bedrock API
 * AWS Bedrock DocumentBlock.name only allows: alphanumeric, single ASCII spaces,
 * hyphens, parentheses, square brackets, is at least 1 and at most 200 characters
 * Replaces non-allowed characters with '_', and adds a hash suffix whenever the
 * name had to be changed (replaced, trimmed or truncated) so that two different
 * files never end up with the same name
 * @param filename Original filename
 * @returns Safe filename with hash suffix (only if the name had to be changed)
 */
export const convertToSafeFilename = (filename: string): string => {
  const lastDotIndex = filename.lastIndexOf('.');
  const nameWithoutExt =
    lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;

  // \s cannot be used here: it also matches U+3000 (ideographic space) and tabs,
  // which Bedrock rejects. Only the ASCII space is allowed through.
  // Bedrock also rejects two or more consecutive whitespace characters, and
  // leading or trailing spaces carry no meaning in a document name.
  const safeName = nameWithoutExt
    .replace(/[^a-zA-Z0-9 \-()[\]]/g, '_')
    .replace(/ {2,}/g, ' ')
    .trim();

  if (
    safeName === nameWithoutExt &&
    safeName.length > 0 &&
    safeName.length <= MAX_DOCUMENT_NAME_LENGTH
  ) {
    return safeName;
  }

  const hash = crypto
    .createHash('md5')
    .update(filename)
    .digest('hex')
    .substring(0, HASH_LENGTH);
  // The hash is what keeps two different names apart, so the base name is
  // what gets cut to fit rather than the suffix. Cutting can leave a trailing
  // space, which is trimmed again.
  const room = MAX_DOCUMENT_NAME_LENGTH - HASH_LENGTH - 1;
  // DocumentBlock.name requires a minimum length of 1
  const base = safeName.substring(0, room).trimEnd() || 'file';
  return `${base}_${hash}`;
};

/**
 * Create a function that returns a safe document name that is unique within
 * one request.
 *
 * Converse rejects a request in which two documents share a name
 * ("Messages can't contain duplicate document names"), and the check covers
 * the whole request, including earlier turns of the conversation that are
 * sent again. Attaching a file with the same name twice (in one message or in
 * different turns) would otherwise break the rest of the conversation.
 *
 * The first occurrence keeps its name, later ones get " (2)", " (3)" and so
 * on. Messages are always sent in the same order, so a file gets the same
 * name on every turn.
 */
export const createUniqueDocumentNamer = (): ((filename: string) => string) => {
  const usedNames = new Set<string>();
  return (filename: string): string => {
    const safeName = convertToSafeFilename(filename);
    let name = safeName;
    for (let n = 2; usedNames.has(name); n++) {
      const suffix = ` (${n})`;
      name =
        safeName
          .substring(0, MAX_DOCUMENT_NAME_LENGTH - suffix.length)
          .trimEnd() + suffix;
    }
    usedNames.add(name);
    return name;
  };
};
