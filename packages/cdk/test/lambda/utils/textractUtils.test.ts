/* eslint-disable i18nhelper/no-jp-string */
import type { Block } from '@aws-sdk/client-textract';
import {
  MAX_FILE_SIZE_BYTES,
  detectTypeFromMagicBytes,
  getTypeFromExtension,
  isValidUploadedFileKey,
  mapBlocksToPages,
  validateDocument,
} from '../../../lambda/utils/textractUtils';

const bytesOf = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0]);
const JPEG = bytesOf(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const PDF = bytesOf(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const TIFF_LE = bytesOf(0x49, 0x49, 0x2a, 0x00);
const TIFF_BE = bytesOf(0x4d, 0x4d, 0x00, 0x2a);

describe('detectTypeFromMagicBytes', () => {
  test('detects supported types', () => {
    expect(detectTypeFromMagicBytes(JPEG)).toBe('jpeg');
    expect(detectTypeFromMagicBytes(PNG)).toBe('png');
    expect(detectTypeFromMagicBytes(PDF)).toBe('pdf');
    expect(detectTypeFromMagicBytes(TIFF_LE)).toBe('tiff');
    expect(detectTypeFromMagicBytes(TIFF_BE)).toBe('tiff');
  });
  test('returns null for unsupported or short content', () => {
    expect(detectTypeFromMagicBytes(new TextEncoder().encode('GIF89a'))).toBe(
      null
    );
    expect(detectTypeFromMagicBytes(new Uint8Array([0xff]))).toBe(null);
    expect(detectTypeFromMagicBytes(new Uint8Array())).toBe(null);
  });
});

describe('getTypeFromExtension', () => {
  test('is case insensitive and normalizes jpg/tif', () => {
    expect(getTypeFromExtension('a.JPG')).toBe('jpeg');
    expect(getTypeFromExtension('a.tif')).toBe('tiff');
    expect(getTypeFromExtension('日本語.png')).toBe('png');
    expect(getTypeFromExtension('a.gif')).toBe(null);
    expect(getTypeFromExtension('noext')).toBe(null);
  });
});

describe('isValidUploadedFileKey', () => {
  const uuid = '123e4567-e89b-42d3-a456-426614174000';
  test('accepts <uuid>/<filename>', () => {
    expect(isValidUploadedFileKey(`${uuid}/scan 1.png`)).toBe(true);
    expect(isValidUploadedFileKey(`${uuid}/請求書.pdf`)).toBe(true);
  });
  test('rejects other keys', () => {
    expect(isValidUploadedFileKey('scan.png')).toBe(false);
    expect(isValidUploadedFileKey(`${uuid}/a/b.png`)).toBe(false);
    expect(isValidUploadedFileKey(`../${uuid}/a.png`)).toBe(false);
    expect(isValidUploadedFileKey(`${uuid}/..`)).toBe(false);
    expect(isValidUploadedFileKey(`${uuid}/`)).toBe(false);
    expect(isValidUploadedFileKey(`${uuid}/a\u0000.png`)).toBe(false);
    expect(isValidUploadedFileKey(undefined)).toBe(false);
    expect(isValidUploadedFileKey(123)).toBe(false);
  });
});

describe('validateDocument', () => {
  test('accepts matching extension and content', () => {
    expect(validateDocument('a.jpg', JPEG)).toEqual({
      ok: true,
      fileType: 'jpeg',
    });
    expect(validateDocument('a.TIFF', TIFF_BE)).toEqual({
      ok: true,
      fileType: 'tiff',
    });
  });
  test('rejects unsupported extension, empty, mismatch and bad content', () => {
    expect(validateDocument('a.gif', JPEG).ok).toBe(false);
    expect(validateDocument('a.png', new Uint8Array()).ok).toBe(false);
    expect(validateDocument('a.png', JPEG).ok).toBe(false);
    expect(validateDocument('a.png', bytesOf(1, 2, 3)).ok).toBe(false);
  });
  test('enforces the size limit', () => {
    const big = new Uint8Array(MAX_FILE_SIZE_BYTES + 1);
    big.set(PNG);
    expect(validateDocument('a.png', big).ok).toBe(false);
    const max = new Uint8Array(MAX_FILE_SIZE_BYTES);
    max.set(PNG);
    expect(validateDocument('a.png', max).ok).toBe(true);
  });
});

describe('mapBlocksToPages', () => {
  const box = (l: number, t: number, w: number, h: number) => ({
    Geometry: { BoundingBox: { Left: l, Top: t, Width: w, Height: h } },
  });
  const blocks: Block[] = [
    { BlockType: 'PAGE', Id: 'p1' },
    {
      BlockType: 'LINE',
      Id: 'l1',
      Text: 'こんにちは 世界',
      Confidence: 99.5,
      Page: 1,
      ...box(0.1, 0.2, 0.3, 0.05),
      Relationships: [{ Type: 'CHILD', Ids: ['w1', 'w2'] }],
    },
    {
      BlockType: 'WORD',
      Id: 'w1',
      Text: 'こんにちは',
      Confidence: 99,
      ...box(0.1, 0.2, 0.15, 0.05),
    },
    {
      BlockType: 'WORD',
      Id: 'w2',
      Text: '世界',
      Confidence: 98,
      ...box(0.26, 0.2, 0.14, 0.05),
    },
  ];

  test('maps lines and words keeping normalized boxes', () => {
    expect(mapBlocksToPages(blocks)).toEqual([
      {
        page: 1,
        lines: [
          {
            id: 'l1',
            text: 'こんにちは 世界',
            confidence: 99.5,
            boundingBox: { left: 0.1, top: 0.2, width: 0.3, height: 0.05 },
            words: [
              {
                id: 'w1',
                text: 'こんにちは',
                confidence: 99,
                boundingBox: { left: 0.1, top: 0.2, width: 0.15, height: 0.05 },
              },
              {
                id: 'w2',
                text: '世界',
                confidence: 98,
                boundingBox: {
                  left: 0.26,
                  top: 0.2,
                  width: 0.14,
                  height: 0.05,
                },
              },
            ],
          },
        ],
      },
    ]);
  });
  test('defaults the page to 1 and returns [] without lines', () => {
    const noPage = blocks.map((b) => ({ ...b, Page: undefined }));
    expect(mapBlocksToPages(noPage)[0].page).toBe(1);
    expect(mapBlocksToPages([{ BlockType: 'PAGE', Id: 'p' }])).toEqual([]);
  });
});
