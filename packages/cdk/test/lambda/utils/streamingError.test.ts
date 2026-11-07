import { classifyStreamingError } from '../../../lambda/utils/streamingError';

const validation = (message: string) => {
  const e = new Error(message);
  e.name = 'ValidationException';
  return e;
};

describe('classifyStreamingError', () => {
  // Messages as Bedrock returns them (from production logs in #1672).
  it.each([
    [
      'The document file name can only contain alphanumeric characters, whitespace characters, hyphens, parentheses, and square brackets. The name can\u0027t contain more than one consecutive whitespace character.',
      'INVALID_FILE_NAME',
    ],
    [
      "Messages can't contain duplicate document names. Rename the document and retry your request.",
      'DUPLICATE_FILE_NAME',
    ],
    [
      "You can't include more than 5 documents in a request. Reduce the number of documents and retry your request.",
      'TOO_MANY_DOCUMENTS',
    ],
    [
      'The maximum document size is 4.5 MB. Reduce the size of your document and retry your request.',
      'DOCUMENT_TOO_LARGE',
    ],
    [
      'Unsupported MIME type: application/x-bat. Retry your request with a supported file type: xlsx, txt, pdf, csv, md, doc, html, xls, docx',
      'UNSUPPORTED_FILE_TYPE',
    ],
    [
      'The model returned the following errors: prompt is too long: 1011576 tokens > 1000000 maximum',
      'CONTEXT_TOO_LONG',
    ],
    ['Input is too long for requested model.', 'CONTEXT_TOO_LONG'],
    [
      'The model returned the following errors: messages: text content blocks must be non-empty',
      'EMPTY_MESSAGE',
    ],
  ])('classifies "%s"', (message, expected) => {
    expect(classifyStreamingError(validation(message))).toBe(expected);
  });

  it('falls back to UNKNOWN_ERROR for an unrecognized validation message', () => {
    expect(
      classifyStreamingError(validation('Something new went wrong.'))
    ).toBe('UNKNOWN_ERROR');
  });

  it('only classifies ValidationException', () => {
    const e = new Error('prompt is too long');
    e.name = 'InternalServerException';
    expect(classifyStreamingError(e)).toBe('UNKNOWN_ERROR');
  });

  it('handles non-Error values', () => {
    expect(classifyStreamingError('boom')).toBe('UNKNOWN_ERROR');
    expect(classifyStreamingError(undefined)).toBe('UNKNOWN_ERROR');
  });
});
