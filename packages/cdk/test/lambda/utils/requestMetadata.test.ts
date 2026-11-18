import { bedrockRequestMetadata } from '../../../lambda/utils/requestMetadata';

describe('bedrockRequestMetadata', () => {
  test('tags the user and the use case from the page path', () => {
    expect(
      bedrockRequestMetadata({
        userSub: '0b7e5a1c-1234-4abc-9def-0123456789ab',
        id: '/use-case-builder/execute/abc',
      })
    ).toEqual({
      genu: 'genu',
      genu_user: '0b7e5a1c-1234-4abc-9def-0123456789ab',
      genu_usecase: 'use-case-builder',
    });
  });

  test('leaves out what it does not know', () => {
    expect(bedrockRequestMetadata({})).toEqual({ genu: 'genu' });
    expect(bedrockRequestMetadata({ id: '/' })).toEqual({ genu: 'genu' });
  });

  test('keeps only characters Bedrock accepts and at most 256 of them', () => {
    const metadata = bedrockRequestMetadata({
      userSub: 'a b<c>' + 'x'.repeat(300),
      id: '/chat?x=1',
    });
    expect(metadata.genu_user).toMatch(/^[A-Za-z0-9_-]{1,256}$/);
    expect(metadata.genu_user).toHaveLength(256);
    expect(metadata.genu_usecase).toBe('chatx1');
  });
});
