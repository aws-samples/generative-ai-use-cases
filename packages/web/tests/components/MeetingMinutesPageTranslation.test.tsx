import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock(
  '../../src/components/MeetingMinutes/MeetingMinutesTranscription',
  () => ({ default: () => null })
);
vi.mock(
  '../../src/components/MeetingMinutes/MeetingMinutesRealtimeTranslation',
  () => ({ default: () => null })
);
vi.mock('../../src/components/MeetingMinutes/MeetingMinutesDirect', () => ({
  default: () => null,
}));
vi.mock('../../src/components/MeetingMinutes/MeetingMinutesFile', () => ({
  default: () => null,
}));
vi.mock('../../src/components/MeetingMinutes/MeetingMinutesGeneration', () => ({
  default: () => null,
}));
vi.mock('../../src/components/NavigationBlockDialog', () => ({
  default: () => null,
}));
vi.mock('../../src/hooks/usePreventNavigation', () => ({
  default: () => ({}),
}));
vi.mock('../../src/hooks/useWakeLock', () => ({
  default: () => ({ requestWakeLock: vi.fn(), releaseWakeLock: vi.fn() }),
}));

import MeetingMinutesPage from '../../src/pages/MeetingMinutesPage';

// Browser translation can replace a Text node without informing React.
const translate = (container: HTMLElement) => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (!node.textContent?.trim()) continue;
    const font = document.createElement('font');
    font.textContent = 'Translated ' + node.textContent;
    node.parentNode!.replaceChild(font, node);
  }
};

afterEach(cleanup);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

describe('MeetingMinutesPage tab switch after browser translation', () => {
  it.each([
    ['transcribe.direct_input'],
    ['transcribe.file_upload'],
    ['translate.realtime_translation'],
  ])('switches to %s', (label) => {
    const view = render(
      <MemoryRouter>
        <MeetingMinutesPage />
      </MemoryRouter>
    );
    translate(view.container);
    const button = Array.from(view.container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(label)
    )!;
    expect(button).toBeTruthy();
    expect(() => fireEvent.click(button)).not.toThrow();
  });
});
