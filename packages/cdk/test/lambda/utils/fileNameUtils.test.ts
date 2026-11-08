/* eslint-disable i18nhelper/no-jp-string */
import {
  convertToSafeFilename,
  createUniqueDocumentNamer,
} from '../../../lambda/utils/fileNameUtils';

describe('convertToSafeFilename', () => {
  it('should return filename without hash when only ASCII characters', () => {
    const result = convertToSafeFilename('document.pdf');
    expect(result).toBe('document');
  });

  it('should return filename without hash for ASCII with allowed special chars', () => {
    const result = convertToSafeFilename('report-2024 (final)[v1].pdf');
    expect(result).toBe('report-2024 (final)[v1]');
  });

  it('should add hash when Japanese characters are present', () => {
    const result = convertToSafeFilename('資料.pdf');
    expect(result).toBe('___46a890b2');
  });

  it('should add hash when mixed Japanese and ASCII characters', () => {
    const result = convertToSafeFilename('report資料2024.pdf');
    expect(result).toBe('report__2024_f3805637');
  });

  it('should generate different hashes for different Japanese filenames with same length', () => {
    const result1 = convertToSafeFilename('資料.pdf');
    const result2 = convertToSafeFilename('書類.pdf');
    expect(result1).toBe('___46a890b2');
    expect(result2).toBe('___5c4aa342');
    expect(result1).not.toBe(result2);
  });

  it('should generate consistent hash for same filename', () => {
    const result1 = convertToSafeFilename('資料.pdf');
    const result2 = convertToSafeFilename('資料.pdf');
    expect(result1).toBe('___46a890b2');
    expect(result2).toBe('___46a890b2');
  });

  it('should handle filename without extension', () => {
    const result = convertToSafeFilename('document');
    expect(result).toBe('document');
  });

  it('should handle filename with multiple dots', () => {
    const result = convertToSafeFilename('report.final.pdf');
    expect(result).toBe('report_final_8d101382');
  });

  it('should replace special characters with underscore and add hash', () => {
    const result = convertToSafeFilename('file@#$.pdf');
    expect(result).toBe('file____cf25ced4');
  });

  // Bedrock rejects every whitespace character except a single ASCII space.
  // \s in a character class also matches U+3000 and tabs, so they used to pass through.
  it('should replace ideographic space (U+3000) with underscore', () => {
    const result = convertToSafeFilename('test\u3000name.pdf');
    expect(result).toBe('test_name_706fc6f2');
  });

  it('should replace ideographic space in an all-Japanese filename', () => {
    const result = convertToSafeFilename(
      '\u30c6\u30b9\u30c8\u3000\u8cc7\u6599.xlsx'
    );
    expect(result).toBe('_______9c852928');
  });

  it('should replace tab with underscore', () => {
    const result = convertToSafeFilename('test\tname.pdf');
    expect(result).toBe('test_name_38e78b48');
  });

  it('should collapse consecutive spaces into a single space', () => {
    const result = convertToSafeFilename('test  name.pdf');
    expect(result).toBe('test name_695fce01');
  });

  it('should keep a single space as is', () => {
    const result = convertToSafeFilename('test name.pdf');
    expect(result).toBe('test name');
  });

  it('should fall back to a placeholder when the name becomes empty', () => {
    const result = convertToSafeFilename('');
    expect(result).toBe('file_d41d8cd9');
  });

  // DocumentBlock.name is documented as "Minimum length of 1. Maximum length of 200."
  // https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_DocumentBlock.html
  it('keeps an ASCII name of exactly 200 characters as is', () => {
    const result = convertToSafeFilename(`${'a'.repeat(200)}.pdf`);
    expect(result).toBe('a'.repeat(200));
  });

  it('caps a long ASCII name at 200 characters with a hash suffix', () => {
    const result = convertToSafeFilename(`${'a'.repeat(300)}.pdf`);
    expect(result).toHaveLength(200);
    expect(result).toMatch(/^a{191}_[0-9a-f]{8}$/);
  });

  // Truncation alone used to add no hash, so names sharing the first 200
  // characters collapsed into the same document name.
  it('gives two long ASCII names with the same prefix different results', () => {
    const a = convertToSafeFilename(`${'a'.repeat(250)}A.pdf`);
    const b = convertToSafeFilename(`${'a'.repeat(250)}B.pdf`);
    expect(a).not.toBe(b);
  });

  it('trims leading and trailing spaces', () => {
    const result = convertToSafeFilename(' test name .pdf');
    expect(result).toMatch(/^test name_[0-9a-f]{8}$/);
  });

  it('keeps names that differ only by surrounding spaces apart', () => {
    expect(convertToSafeFilename(' abc.pdf')).not.toBe(
      convertToSafeFilename('abc.pdf')
    );
  });

  it('keeps the hash suffix intact when a replaced name is too long', () => {
    const result = convertToSafeFilename(`${'あ'.repeat(300)}.pdf`);
    expect(result.length).toBeLessThanOrEqual(200);
    // The hash is what keeps two different names apart, so it must survive.
    expect(result).toMatch(/_[0-9a-f]{8}$/);
  });

  it('gives two different long names different results', () => {
    const a = convertToSafeFilename(`${'あ'.repeat(300)}.pdf`);
    const b = convertToSafeFilename(`${'い'.repeat(300)}.pdf`);
    expect(a).not.toBe(b);
  });

  it('does not leave a trailing space after truncation', () => {
    // The cut lands right after the space at index 190
    const result = convertToSafeFilename(
      `${'a'.repeat(190)} ${'b'.repeat(20)}.pdf`
    );
    expect(result).toMatch(/^a{190}_[0-9a-f]{8}$/);
  });

  it('never returns an empty name', () => {
    expect(convertToSafeFilename('   .pdf')).toMatch(/^file_[0-9a-f]{8}$/);
  });
});

describe('createUniqueDocumentNamer', () => {
  it('keeps the first name and numbers the later duplicates', () => {
    const toName = createUniqueDocumentNamer();
    expect(toName('report.xlsx')).toBe('report');
    expect(toName('report.pdf')).toBe('report (2)');
    expect(toName('report.xlsx')).toBe('report (3)');
    expect(toName('other.txt')).toBe('other');
  });

  it('skips a numbered name that is already taken', () => {
    const toName = createUniqueDocumentNamer();
    expect(toName('report (2).txt')).toBe('report (2)');
    expect(toName('report.txt')).toBe('report');
    expect(toName('report.txt')).toBe('report (3)');
  });

  it('gives the same names when called again in the same order', () => {
    const files = ['a.txt', 'a.txt', 'テスト.pdf', 'テスト.pdf'];
    const first = files.map(createUniqueDocumentNamer());
    const second = files.map(createUniqueDocumentNamer());
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(files.length);
  });

  it('stays within 200 characters with the suffix', () => {
    const toName = createUniqueDocumentNamer();
    const longName = 'a'.repeat(300) + '.txt';
    const first = toName(longName);
    const second = toName(longName);
    expect(first).toHaveLength(200);
    expect(second).toHaveLength(200);
    expect(second.endsWith(' (2)')).toBe(true);
    expect(second).not.toBe(first);
    // Same characters as convertToSafeFilename output, no double spaces
    expect(second).toMatch(/^[\w\-()[\]]+( [\w\-()[\]]+)*$/);
  });
});
