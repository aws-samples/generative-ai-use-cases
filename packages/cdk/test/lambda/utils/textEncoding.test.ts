/* eslint-disable i18nhelper/no-jp-string */
import { convertTextDocumentToUtf8 } from '../../../lambda/utils/textEncoding';

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

  it('leaves bytes untouched when no candidate encoding decodes them', () => {
    const undecodable = Uint8Array.from([0xff, 0xfe, 0x00, 0x81, 0xff]);
    const result = convertTextDocumentToUtf8(undecodable, 'txt');
    expect(result).toBe(undecodable);
  });
});
