import { stackInputSchema } from '../lib/stack-input';

describe('transcribeLanguageOptions', () => {
  it('defaults to Japanese and English', () => {
    expect(stackInputSchema.parse({}).transcribeLanguageOptions).toEqual([
      'ja-JP',
      'en-US',
    ]);
  });

  it('accepts a custom list of languages', () => {
    const options = ['ja-JP', 'en-US', 'zh-CN', 'ko-KR'];
    expect(
      stackInputSchema.parse({ transcribeLanguageOptions: options })
        .transcribeLanguageOptions
    ).toEqual(options);
  });

  it('rejects fewer than two languages', () => {
    expect(
      stackInputSchema.safeParse({ transcribeLanguageOptions: ['ja-JP'] })
        .success
    ).toBe(false);
  });

  it('rejects two dialects of the same language', () => {
    expect(
      stackInputSchema.safeParse({
        transcribeLanguageOptions: ['ja-JP', 'en-US', 'en-GB'],
      }).success
    ).toBe(false);
  });
});
