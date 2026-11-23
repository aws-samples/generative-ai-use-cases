import { RecordedMessage } from 'generative-ai-use-cases';
import {
  capMessageToItemLimit,
  truncateToBytes,
} from '../../../lambda/utils/messageSize';

// DynamoDB rejects items over 400 KB. The module keeps a margin below it.
const ITEM_LIMIT_BYTES = 400 * 1024;

// A three-byte UTF-8 character (HIRAGANA LETTER A).
const MULTI_BYTE = String.fromCodePoint(0x3042);

const byteSize = (value: unknown): number =>
  Buffer.byteLength(JSON.stringify(value), 'utf8');

const message = (overrides: Partial<RecordedMessage>): RecordedMessage => ({
  id: 'chat#c1',
  createdDate: '1700000000000#0',
  messageId: 'm1',
  role: 'user',
  content: 'hello',
  userId: 'user#u1',
  feedback: 'none',
  usecase: '/chat',
  llmType: 'model',
  ...overrides,
});

const s3Attachment = {
  type: 'file' as const,
  name: 'doc.pdf',
  source: {
    type: 's3' as const,
    mediaType: 'application/pdf',
    data: 'https://bucket.s3.us-east-1.amazonaws.com/uuid/doc.pdf',
  },
};

describe('truncateToBytes', () => {
  test('leaves text that already fits untouched', () => {
    expect(truncateToBytes('abc', 10)).toBe('abc');
  });

  test('reports how much was dropped and stays within the limit', () => {
    const text = 'a'.repeat(10_000);
    const truncated = truncateToBytes(text, 1_000);
    expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(1_000);
    expect(truncated).toContain('[truncated: 9000 bytes omitted');
  });

  test('does not leave a partial multi-byte character behind', () => {
    const truncated = truncateToBytes(MULTI_BYTE.repeat(1_000), 200);
    expect(truncated).not.toContain('\uFFFD');
  });
});

describe('capMessageToItemLimit', () => {
  test('returns a message that fits unchanged', () => {
    const original = message({ trace: 'step', extraData: [s3Attachment] });
    expect(capMessageToItemLimit(original)).toBe(original);
  });

  test('truncates the trace before touching the content', () => {
    const content = 'answer '.repeat(100);
    const capped = capMessageToItemLimit(
      message({ role: 'assistant', content, trace: 'x'.repeat(500_000) })
    );
    expect(byteSize(capped)).toBeLessThan(ITEM_LIMIT_BYTES);
    expect(capped.content).toBe(content);
    expect(capped.trace).toContain('[truncated:');
  });

  test('keeps the head of an oversized input and its attachment', () => {
    // The case in issue #1598: a very long pasted input.
    const content = MULTI_BYTE.repeat(1_000_000);
    const capped = capMessageToItemLimit(
      message({ content, extraData: [s3Attachment] })
    );
    expect(byteSize(capped)).toBeLessThan(ITEM_LIMIT_BYTES);
    expect(capped.content.startsWith(MULTI_BYTE.repeat(10))).toBe(true);
    expect(capped.content).toContain('[truncated:');
    expect(capped.extraData).toEqual([s3Attachment]);
    expect(capped.messageId).toBe('m1');
    expect(capped.createdDate).toBe('1700000000000#0');
  });

  test('drops the trace when the content alone is too big', () => {
    const capped = capMessageToItemLimit(
      message({ content: 'a'.repeat(500_000), trace: 'step' })
    );
    expect(byteSize(capped)).toBeLessThan(ITEM_LIMIT_BYTES);
    expect('trace' in capped).toBe(false);
  });

  test('fits content that grows when serialized as JSON', () => {
    // Control characters are escaped as \u00XX, six bytes each.
    const capped = capMessageToItemLimit(
      message({ content: '\u0001'.repeat(300_000) })
    );
    expect(byteSize(capped)).toBeLessThan(ITEM_LIMIT_BYTES);
  });

  test('drops extraData that is too big to keep', () => {
    const inline = {
      type: 'image' as const,
      name: 'image.png',
      source: {
        type: 'base64' as const,
        mediaType: 'image/png',
        data: 'A'.repeat(500_000),
      },
    };
    const capped = capMessageToItemLimit(
      message({ content: 'hello', extraData: [inline] })
    );
    expect(byteSize(capped)).toBeLessThan(ITEM_LIMIT_BYTES);
    expect('extraData' in capped).toBe(false);
    expect(capped.content).toBe('hello');
  });
});
