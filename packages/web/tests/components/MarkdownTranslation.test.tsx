import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../src/hooks/useRagFile', () => ({
  default: () => ({ downloadDoc: vi.fn(), isS3Url: () => false }),
}));
vi.mock('../../src/hooks/useFileApi', () => ({
  default: () => ({ getFileDownloadSignedUrl: vi.fn() }),
}));

import Markdown from '../../src/components/Markdown';

const translate = (container: HTMLElement) => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (!node.textContent?.trim()) continue;
    const font = document.createElement('font');
    font.textContent = 'Translated';
    node.parentNode!.replaceChild(font, node);
  }
};

describe('Markdown after browser translation', () => {
  it.each([
    ['First chunk', 'First chunk and final response'],
    ['First **bold** chunk', 'First **bold** chunk and final response'],
    ['- First chunk', '- First chunk and final response'],
    [
      '[First chunk](https://example.com)',
      '[Final response](https://example.com)',
    ],
    ['| Text |\n|---|\n| First chunk |', '| Text |\n|---|\n| Final response |'],
  ])(
    'replaces translated streaming text with the final response: %s',
    (before, after) => {
      const view = render(
        <MemoryRouter>
          <Markdown generating>{before}</Markdown>
        </MemoryRouter>
      );
      translate(view.container);
      view.rerender(
        <MemoryRouter>
          <Markdown>{after}</Markdown>
        </MemoryRouter>
      );
      expect(view.container.textContent).toContain(
        after.includes('final response') ? 'final response' : 'Final response'
      );
    }
  );
  it('defers translation until streaming and typing have finished', () => {
    const firstChunk = 'First chunk';
    const finalResponse = 'Final response';
    const view = render(
      <MemoryRouter>
        <Markdown generating>{firstChunk}</Markdown>
      </MemoryRouter>
    );
    expect(view.container.querySelector('[translate="no"]')).toBeTruthy();
    translate(view.container);
    view.rerender(
      <MemoryRouter>
        <Markdown>{finalResponse}</Markdown>
      </MemoryRouter>
    );
    expect(view.container.querySelector('[translate="no"]')).toBeNull();
    expect(view.container.textContent).toBe('Final response');
  });
});
