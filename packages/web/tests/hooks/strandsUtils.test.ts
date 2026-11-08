import { describe, expect, it } from 'vitest';
import {
  convertFilesToStrandsContentBlocks,
  convertToStrandsFormat,
  makeDocumentNamesUnique,
} from '../../src/utils/strandsUtils';

// A short CSV ("item,amount" / "travel,1200" in Japanese) in each encoding
// eslint-disable-next-line i18nhelper/no-jp-string
const TEXT = '品目,金額\n交通費,1200\n';
const SHIFT_JIS = new Uint8Array([
  0x95, 0x69, 0x96, 0xda, 0x2c, 0x8b, 0xe0, 0x8a, 0x7a, 0x0a, 0x8c, 0xf0, 0x92,
  0xca, 0x94, 0xef, 0x2c, 0x31, 0x32, 0x30, 0x30, 0x0a,
]);
const EUC_JP = new Uint8Array([
  0xc9, 0xca, 0xcc, 0xdc, 0x2c, 0xb6, 0xe2, 0xb3, 0xdb, 0x0a, 0xb8, 0xf2, 0xc4,
  0xcc, 0xc8, 0xf1, 0x2c, 0x31, 0x32, 0x30, 0x30, 0x0a,
]);
const UTF8 = new TextEncoder().encode(TEXT);

const toBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...Array.from(bytes)));
const fromBase64 = (base64: string) =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

const documentBytesOf = async (bytes: Uint8Array, type: string) => {
  const file = new File([bytes], 'expenses', { type });
  const [block] = await convertFilesToStrandsContentBlocks([file]);
  return 'document' in block ? block.document.source.bytes : undefined;
};

describe('strandsUtils - text documents in legacy Japanese charsets', () => {
  // Bedrock rejects EUC-JP documents and reads Shift_JIS ones as mojibake, and
  // AgentCore hands the bytes to Bedrock as they are (#1399).
  it.each([
    ['Shift_JIS', SHIFT_JIS],
    ['EUC-JP', EUC_JP],
  ])('re-encodes a %s CSV as UTF-8 before it is sent', async (_, bytes) => {
    const sent = await documentBytesOf(bytes, 'text/csv');
    expect(new TextDecoder().decode(fromBase64(sent!))).toBe(TEXT);
  });

  it('sends a UTF-8 CSV unchanged', async () => {
    expect(await documentBytesOf(UTF8, 'text/csv')).toBe(toBase64(UTF8));
  });

  it('never touches a binary format', async () => {
    expect(await documentBytesOf(SHIFT_JIS, 'application/pdf')).toBe(
      toBase64(SHIFT_JIS)
    );
  });

  // Earlier turns are sent again with every request, so an attachment in the
  // history has to be converted too.
  it('re-encodes a Shift_JIS attachment in an earlier message', () => {
    const [message] = convertToStrandsFormat([
      {
        role: 'user',
        content: 'summarize',
        extraData: [
          {
            type: 'file',
            name: 'expenses',
            source: {
              type: 'base64',
              mediaType: 'text/csv',
              data: toBase64(SHIFT_JIS),
            },
          },
        ],
      },
    ]);
    const block = message.content.find((b) => 'document' in b);
    const sent =
      block && 'document' in block ? block.document.source.bytes : '';
    expect(new TextDecoder().decode(fromBase64(sent))).toBe(TEXT);
  });
});

describe('strandsUtils - makeDocumentNamesUnique', () => {
  const doc = (name: string) => ({
    document: { format: 'pdf' as const, name, source: { bytes: 'AA==' } },
  });
  const names = (blocks: { document?: { name?: string } }[]) =>
    blocks.map((b) => b.document?.name);

  it('numbers repeated names in the prompt', () => {
    const { prompt } = makeDocumentNamesUnique(
      [],
      [{ text: 'compare' }, doc('reportXpdf'), doc('reportXpdf')]
    );
    expect(names(prompt)).toEqual([undefined, 'reportXpdf', 'reportXpdf (2)']);
  });

  it('separates Japanese names of the same length', async () => {
    // Both names become "XXXXXpdf" after sanitising
    const blocks = await convertFilesToStrandsContentBlocks([
      // eslint-disable-next-line i18nhelper/no-jp-string
      new File(['a'], 'レポート.pdf', { type: 'application/pdf' }),
      // eslint-disable-next-line i18nhelper/no-jp-string
      new File(['b'], '議事録案.pdf', { type: 'application/pdf' }),
    ]);
    const { prompt } = makeDocumentNamesUnique([], blocks);
    expect(names(prompt)).toEqual(['XXXXXpdf', 'XXXXXpdf (2)']);
  });

  it('counts names across earlier messages and the prompt', () => {
    const { messages, prompt } = makeDocumentNamesUnique(
      [
        { role: 'user', content: [{ text: 'first' }, doc('a')] },
        { role: 'assistant', content: [{ text: 'ok' }] },
      ],
      [{ text: 'again' }, doc('a'), doc('a (2)')]
    );
    expect(names(messages[0].content)).toEqual([undefined, 'a']);
    expect(names(prompt)).toEqual([undefined, 'a (2)', 'a (2) (2)']);
  });

  it('keeps names within 200 characters and leaves unique names alone', () => {
    const long = 'x'.repeat(200);
    const original = doc('unique');
    const { prompt } = makeDocumentNamesUnique(
      [],
      [original, doc(long), doc(long)]
    );
    expect(prompt[0]).toBe(original);
    expect(prompt[2].document?.name).toBe('x'.repeat(196) + ' (2)');
  });
});
