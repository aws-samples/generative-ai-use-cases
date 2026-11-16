/* eslint-disable i18nhelper/no-jp-string */
import { describe, expect, it } from 'vitest';
import {
  CSV_BOM,
  escapeCsvField,
  getKeyFromSignedUrl,
  isPreviewableImage,
  isSupportedExtension,
  toCsv,
  toFullText,
  toPixelBox,
  toRows,
} from '../../src/utils/TextractUtils';
import { DetectDocumentTextResponse } from 'generative-ai-use-cases';

const box = { left: 0.1, top: 0.2, width: 0.3, height: 0.05 };
const result: DetectDocumentTextResponse = {
  region: 'ap-northeast-1',
  blockCount: 5,
  pages: [
    {
      page: 1,
      lines: [
        {
          id: 'l1',
          text: 'こんにちは, "世界"',
          confidence: 99,
          boundingBox: box,
          words: [
            { id: 'w1', text: 'こんにちは,', confidence: 99, boundingBox: box },
            { id: 'w2', text: '"世界"', confidence: 40, boundingBox: box },
          ],
        },
        {
          id: 'l2',
          text: 'low',
          confidence: 30,
          boundingBox: box,
          words: [],
        },
      ],
    },
  ],
};

describe('TextractUtils', () => {
  it('escapes CSV fields', () => {
    expect(escapeCsvField('plain')).toBe('plain');
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField(12.5)).toBe('12.5');
  });

  it('creates CSV with BOM and pixel columns when the image size is known', () => {
    const csv = toCsv(toRows(result, 'lines', 50), {
      width: 1000,
      height: 500,
    });
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const [header, row] = csv.slice(1).split('\r\n');
    expect(header).toBe(
      'page,type,text,confidence,left,top,width,height,left_px,top_px,width_px,height_px'
    );
    expect(row).toBe(
      '1,LINE,"こんにちは, ""世界""",99,0.1,0.2,0.3,0.05,100,100,300,25'
    );
  });

  it('creates CSV without pixel columns when the image size is unknown', () => {
    const csv = toCsv(toRows(result, 'words', 0), null);
    expect(csv.slice(1).split('\r\n')[0]).toBe(
      'page,type,text,confidence,left,top,width,height'
    );
  });

  it('filters rows and text by confidence', () => {
    expect(toRows(result, 'lines', 0)).toHaveLength(2);
    expect(toRows(result, 'lines', 50)).toHaveLength(1);
    expect(toRows(result, 'words', 50)).toHaveLength(1);
    expect(toFullText(result, 50)).toBe('こんにちは, "世界"');
    expect(toFullText(result, 0)).toBe('こんにちは, "世界"\nlow');
  });

  it('converts a normalized box to pixels', () => {
    expect(toPixelBox(box, 1000, 500)).toEqual({
      left: 100,
      top: 100,
      width: 300,
      height: 25,
    });
  });

  it('detects supported extensions', () => {
    expect(isSupportedExtension('a.JPG')).toBe(true);
    expect(isSupportedExtension('a.tiff')).toBe(true);
    expect(isSupportedExtension('a.gif')).toBe(false);
    expect(isSupportedExtension('noext')).toBe(false);
    expect(isPreviewableImage('a.png')).toBe(true);
    expect(isPreviewableImage('a.pdf')).toBe(false);
  });

  it('gets the object key from a presigned URL', () => {
    expect(
      getKeyFromSignedUrl(
        'https://bucket.s3.us-east-1.amazonaws.com/123e4567-e89b-42d3-a456-426614174000/%E8%AB%8B%E6%B1%82%E6%9B%B8%201.png?X-Amz-Signature=abc'
      )
    ).toBe('123e4567-e89b-42d3-a456-426614174000/請求書 1.png');
    expect(
      getKeyFromSignedUrl(
        'https://s3.us-east-1.amazonaws.com/bucket/123e4567-e89b-42d3-a456-426614174000/a.png?x=1'
      )
    ).toBe('123e4567-e89b-42d3-a456-426614174000/a.png');
  });
});
