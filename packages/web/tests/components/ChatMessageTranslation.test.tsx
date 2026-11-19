import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatMessage from '../../src/components/ChatMessage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en' },
  }),
}));
vi.mock('../../src/hooks/useChat', () => ({
  default: () => ({ sendFeedback: vi.fn() }),
}));
vi.mock('../../src/hooks/useFiles', () => ({
  default: () => ({ getFileDownloadSignedUrl: vi.fn() }),
}));
vi.mock('../../src/hooks/useRagFile', () => ({
  default: () => ({ downloadDoc: vi.fn(), isS3Url: () => false }),
}));
vi.mock('../../src/hooks/useFileApi', () => ({
  default: () => ({ getFileDownloadSignedUrl: vi.fn() }),
}));
vi.mock('../../src/hooks/useUserSetting', () => ({
  default: () => ({ settingTypingAnimation: true }),
}));

const message = (content: string, loading: boolean) => (
  <MemoryRouter>
    <ChatMessage
      chatContent={{ role: 'assistant', content }}
      loading={loading}
      hideFeedback
    />
  </MemoryRouter>
);
const tick = async (milliseconds: number) => {
  // Flush each timer turn so React can schedule the next typing update.
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 10) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(10, milliseconds - elapsed));
    });
  }
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ChatMessage translation during typing', () => {
  it('keeps translation deferred after loading ends until typing finishes', async () => {
    const content =
      'A complete response that still needs time to be displayed. '
        .repeat(3)
        .trim();
    const view = render(message(content, true));
    await tick(10);
    view.rerender(message(content, false));

    expect(view.container.querySelector('[translate="no"]')).toBeTruthy();
    expect(view.container.querySelector('.prose')?.textContent).not.toBe(
      content
    );

    await tick(500);
    expect(view.container.querySelector('[translate="no"]')).toBeNull();
    expect(view.container.querySelector('.prose')?.textContent).toBe(content);
  });

  it('replaces a translated response safely when a second generation starts', async () => {
    const first = 'The first completed response. '.repeat(3).trim();
    const second = 'The second response must remain visible until it finishes. '
      .repeat(3)
      .trim();
    const view = render(message(first, true));
    await tick(10);
    view.rerender(message(first, false));
    await tick(500);

    const paragraph = view.container.querySelector('.prose p')!;
    const translated = document.createElement('font');
    translated.textContent = 'Translated first response';
    paragraph.replaceChild(translated, paragraph.firstChild!);

    view.rerender(message(second, true));
    expect(view.container.querySelector('[translate="no"]')).toBeTruthy();
    // A late translation still holding the old node must not affect the new response.
    translated.textContent = 'Late translation of the first response';
    expect(view.container.textContent).not.toContain(translated.textContent);

    await tick(10);
    view.rerender(message(second, false));
    expect(view.container.querySelector('[translate="no"]')).toBeTruthy();
    await tick(500);
    expect(view.container.querySelector('[translate="no"]')).toBeNull();
    expect(view.container.querySelector('.prose')?.textContent).toBe(second);
  });
});
