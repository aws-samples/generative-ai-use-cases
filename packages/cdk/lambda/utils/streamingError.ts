import { StreamingErrorCode } from 'generative-ai-use-cases';

// Bedrock answers an invalid request with ValidationException and a message
// that names the cause. Matching the message lets the UI tell users what to
// fix (rename a file, attach fewer documents, ...) instead of a generic error.
// The raw message is not sent to the browser: it is English and exposes the
// request structure (e.g. "messages.2.content.0.image").
//
// The patterns follow the messages Bedrock returns today. If AWS rewords one,
// it no longer matches and the error falls back to UNKNOWN_ERROR, as before.
const VALIDATION_PATTERNS: [RegExp, StreamingErrorCode][] = [
  [/document file name can only contain/i, 'INVALID_FILE_NAME'],
  [/duplicate document names/i, 'DUPLICATE_FILE_NAME'],
  [/more than \d+ documents/i, 'TOO_MANY_DOCUMENTS'],
  [/maximum document size is/i, 'DOCUMENT_TOO_LARGE'],
  [/image exceeds .*maximum/i, 'IMAGE_TOO_LARGE'],
  [/unsupported mime type/i, 'UNSUPPORTED_FILE_TYPE'],
  [/prompt is too long|input is too long/i, 'CONTEXT_TOO_LONG'],
  [/text content blocks must be non-empty/i, 'EMPTY_MESSAGE'],
];

/**
 * Error code for an exception that is not throttling or access denied.
 * Callers keep their own checks for those, since the exception classes
 * differ between the Bedrock Runtime and Bedrock Agent Runtime clients.
 */
export const classifyStreamingError = (e: unknown): StreamingErrorCode => {
  if (!(e instanceof Error) || e.name !== 'ValidationException') {
    return 'UNKNOWN_ERROR';
  }
  const match = VALIDATION_PATTERNS.find(([pattern]) =>
    pattern.test(e.message)
  );
  return match ? match[1] : 'UNKNOWN_ERROR';
};
