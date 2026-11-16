import {
  DetectDocumentTextResponse,
  TextractBoundingBox,
} from 'generative-ai-use-cases';

export const TEXTRACT_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const TEXTRACT_ACCEPT = '.jpg,.jpeg,.png,.pdf,.tif,.tiff';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png'];
const ALL_EXTENSIONS = [...IMAGE_EXTENSIONS, 'pdf', 'tif', 'tiff'];

export const getExtension = (fileName: string): string =>
  fileName.includes('.') ? (fileName.split('.').pop() ?? '').toLowerCase() : '';

export const isSupportedExtension = (fileName: string): boolean =>
  ALL_EXTENSIONS.includes(getExtension(fileName));

/** JPEG / PNG can be previewed in the browser (PDF / TIFF cannot) */
export const isPreviewableImage = (fileName: string): boolean =>
  IMAGE_EXTENSIONS.includes(getExtension(fileName));

export type TextractRow = {
  id: string;
  page: number;
  type: 'LINE' | 'WORD';
  text: string;
  confidence: number;
  boundingBox: TextractBoundingBox;
};

export type TextractView = 'lines' | 'words';

/** Flatten the result into rows for the selected view, hiding rows below minConfidence */
export const toRows = (
  result: DetectDocumentTextResponse,
  view: TextractView,
  minConfidence: number
): TextractRow[] =>
  result.pages.flatMap((page) =>
    page.lines
      .flatMap((line): TextractRow[] =>
        view === 'lines'
          ? [
              {
                id: line.id,
                page: page.page,
                type: 'LINE',
                text: line.text,
                confidence: line.confidence,
                boundingBox: line.boundingBox,
              },
            ]
          : line.words.map((word) => ({
              id: word.id,
              page: page.page,
              type: 'WORD',
              text: word.text,
              confidence: word.confidence,
              boundingBox: word.boundingBox,
            }))
      )
      .filter((row) => row.confidence >= minConfidence)
  );

/** Whole-document text (lines joined by newline, pages separated by a blank line) */
export const toFullText = (
  result: DetectDocumentTextResponse,
  minConfidence: number
): string =>
  result.pages
    .map((page) =>
      page.lines
        .filter((line) => line.confidence >= minConfidence)
        .map((line) => line.text)
        .join('\n')
    )
    .join('\n\n');

export type PixelBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Convert a normalized box to pixels using the image natural size */
export const toPixelBox = (
  box: TextractBoundingBox,
  naturalWidth: number,
  naturalHeight: number
): PixelBox => ({
  left: Math.round(box.left * naturalWidth),
  top: Math.round(box.top * naturalHeight),
  width: Math.round(box.width * naturalWidth),
  height: Math.round(box.height * naturalHeight),
});

/** Escape a CSV field (RFC 4180): quote when it has a comma, quote or line break */
export const escapeCsvField = (value: string | number): string => {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_BOM = '\uFEFF';

/** CSV text with a UTF-8 BOM so Excel opens Japanese text correctly */
export const toCsv = (
  rows: TextractRow[],
  naturalSize: { width: number; height: number } | null
): string => {
  const header = [
    'page',
    'type',
    'text',
    'confidence',
    'left',
    'top',
    'width',
    'height',
    ...(naturalSize ? ['left_px', 'top_px', 'width_px', 'height_px'] : []),
  ];
  const lines = rows.map((row) => {
    const b = row.boundingBox;
    const px = naturalSize
      ? Object.values(toPixelBox(b, naturalSize.width, naturalSize.height))
      : [];
    return [
      row.page,
      row.type,
      row.text,
      row.confidence,
      b.left,
      b.top,
      b.width,
      b.height,
      ...px,
    ]
      .map(escapeCsvField)
      .join(',');
  });
  return CSV_BOM + [header.join(','), ...lines].join('\r\n') + '\r\n';
};

/** Get the S3 object key (`<uuid>/<filename>`) from a presigned upload URL */
export const getKeyFromSignedUrl = (signedUrl: string): string =>
  new URL(signedUrl).pathname
    .split('/')
    .filter((s) => s.length > 0)
    .slice(-2)
    .map((s) => decodeURIComponent(s))
    .join('/');
