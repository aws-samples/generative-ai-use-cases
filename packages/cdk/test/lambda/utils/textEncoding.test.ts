/* eslint-disable i18nhelper/no-jp-string */
import { convertTextDocumentToUtf8 } from '@generative-ai-use-cases/common';

// The same two-line CSV in each encoding; EXPECTED below is the decoded text
const SHIFT_JIS = Uint8Array.from([
  0x96, 0xbc, 0x91, 0x4f, 0x2c, 0x95, 0x94, 0x8f, 0x90, 0x0a, 0x8e, 0x52, 0x93,
  0x63, 0x91, 0xbe, 0x98, 0x59, 0x2c, 0x89, 0x63, 0x8b, 0xc6, 0x95, 0x94, 0x0a,
]);
const EUC_JP = Uint8Array.from([
  0xcc, 0xbe, 0xc1, 0xb0, 0x2c, 0xc9, 0xf4, 0xbd, 0xf0, 0x0a, 0xbb, 0xb3, 0xc5,
  0xc4, 0xc2, 0xc0, 0xcf, 0xba, 0x2c, 0xb1, 0xc4, 0xb6, 0xc8, 0xc9, 0xf4, 0x0a,
]);
const EXPECTED = '名前,部署\n山田太郎,営業部\n';

const asText = (bytes: Uint8Array) => new TextDecoder('utf-8').decode(bytes);

describe('convertTextDocumentToUtf8', () => {
  it('converts Shift_JIS to UTF-8 for a text format', () => {
    const result = convertTextDocumentToUtf8(SHIFT_JIS, 'csv');
    expect(asText(result)).toBe(EXPECTED);
  });

  it('converts EUC-JP to UTF-8 for a text format', () => {
    const result = convertTextDocumentToUtf8(EUC_JP, 'txt');
    expect(asText(result)).toBe(EXPECTED);
  });

  it('leaves valid UTF-8 untouched', () => {
    const utf8 = new TextEncoder().encode(EXPECTED);
    const result = convertTextDocumentToUtf8(utf8, 'csv');
    expect(result).toBe(utf8);
  });

  it('leaves ASCII untouched', () => {
    const ascii = new TextEncoder().encode('name,department\n');
    const result = convertTextDocumentToUtf8(ascii, 'md');
    expect(result).toBe(ascii);
  });

  // Binary formats must never be re-encoded, even though their bytes are not valid UTF-8
  it.each(['pdf', 'doc', 'docx', 'xls', 'xlsx'])(
    'leaves %s untouched',
    (format) => {
      const result = convertTextDocumentToUtf8(SHIFT_JIS, format);
      expect(result).toBe(SHIFT_JIS);
    }
  );

  // Most EUC-JP text is also a valid Shift_JIS byte sequence, so it must be checked
  // before Shift_JIS. These were turned into halfwidth katakana garbage otherwise.
  it.each([
    [
      '氏名,金額\n山田太郎,1000\n',
      [
        0xbb, 0xe1, 0xcc, 0xbe, 0x2c, 0xb6, 0xe2, 0xb3, 0xdb, 0x0a, 0xbb, 0xb3,
        0xc5, 0xc4, 0xc2, 0xc0, 0xcf, 0xba, 0x2c, 0x31, 0x30, 0x30, 0x30, 0x0a,
      ],
    ],
    ['テスト', [0xa5, 0xc6, 0xa5, 0xb9, 0xa5, 0xc8]],
  ])('converts EUC-JP that is also valid Shift_JIS: %j', (expected, bytes) => {
    const result = convertTextDocumentToUtf8(Uint8Array.from(bytes), 'csv');
    expect(asText(result)).toBe(expected);
  });

  // TextDecoder('euc-jp') lets 0x80-0x8D through, so the first case (katakana with
  // 0x83 lead bytes) is a regression guard for the strict EUC-JP byte check. The
  // halfwidth katakana cases are also valid EUC-JP, and Shift_JIS must win.
  it.each([
    ['テスト', [0x83, 0x65, 0x83, 0x58, 0x83, 0x67]],
    ['ｶﾅ', [0xb6, 0xc5]],
    [
      'ﾌﾘｺﾐ,1000\nﾔﾏﾀﾞ,2000\n',
      [
        0xcc, 0xd8, 0xba, 0xd0, 0x2c, 0x31, 0x30, 0x30, 0x30, 0x0a, 0xd4, 0xcf,
        0xc0, 0xde, 0x2c, 0x32, 0x30, 0x30, 0x30, 0x0a,
      ],
    ],
    [
      '担当:ﾔﾏﾀﾞ\n',
      [0x92, 0x53, 0x93, 0x96, 0x3a, 0xd4, 0xcf, 0xc0, 0xde, 0x0a],
    ],
    ['ｶﾅ,ﾃｽﾄ\n', [0xb6, 0xc5, 0x2c, 0xc3, 0xbd, 0xc4, 0x0a]],
    [
      '商品ｺｰﾄﾞ,数量\nﾃｽﾄ商品,3\n',
      [
        0x8f, 0xa4, 0x95, 0x69, 0xba, 0xb0, 0xc4, 0xde, 0x2c, 0x90, 0x94, 0x97,
        0xca, 0x0a, 0xc3, 0xbd, 0xc4, 0x8f, 0xa4, 0x95, 0x69, 0x2c, 0x33, 0x0a,
      ],
    ],
  ])('converts Shift_JIS: %j', (expected, bytes) => {
    const result = convertTextDocumentToUtf8(Uint8Array.from(bytes), 'csv');
    expect(asText(result)).toBe(expected);
  });

  // Known limitation, pinned so a change in behavior is noticed: EUC-JP whose
  // Shift_JIS reading is plain halfwidth katakana is ambiguous and Shift_JIS wins.
  it('reads ambiguous EUC-JP as Shift_JIS (known limitation)', () => {
    // Two kanji (NA-MAE) in EUC-JP
    const eucJp = Uint8Array.from([0xcc, 0xbe, 0xc1, 0xb0]);
    const result = convertTextDocumentToUtf8(eucJp, 'txt');
    expect(asText(result)).toBe('ﾌｾﾁｰ');
  });

  it('leaves bytes untouched when no candidate encoding decodes them', () => {
    const undecodable = Uint8Array.from([0xff, 0xfe, 0x00, 0x81, 0xff]);
    const result = convertTextDocumentToUtf8(undecodable, 'txt');
    expect(result).toBe(undecodable);
  });
});
