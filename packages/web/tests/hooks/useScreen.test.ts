import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { act, render } from '@testing-library/react';
import useScreen, { scrollToEdge } from '../../src/hooks/useScreen';

// jsdom does no layout, so scrollHeight is stubbed per element.
const makeContainer = (scrollHeight: number) => {
  const container = document.createElement('div');
  container.style.overflowY = 'scroll';
  Object.defineProperty(container, 'scrollHeight', { value: scrollHeight });
  const inner = document.createElement('main');
  const anchor = document.createElement('div');
  inner.appendChild(anchor);
  container.appendChild(inner);
  document.body.appendChild(container);
  return { container, anchor };
};

// Renders the hook the way App.tsx does: the scroll container and the anchors
// inside it, so the hook-level functions can be called as the app calls them.
const renderScreen = () => {
  const api: { current?: ReturnType<typeof useScreen> } = {};
  const Harness = () => {
    const value = useScreen();
    api.current = value;
    return createElement(
      'div',
      { ref: value.screen, style: { overflowY: 'scroll' } },
      createElement(
        'main',
        null,
        createElement('div', { ref: value.scrollTopAnchorRef }),
        createElement('div', { ref: value.scrollBottomAnchorRef })
      )
    );
  };
  const { container } = render(createElement(Harness));
  const scroller = container.firstElementChild as HTMLDivElement;
  Object.defineProperty(scroller, 'scrollHeight', { value: 900 });
  return { api, scroller };
};

describe('useScreen', () => {
  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

  it('scrolls its own container without scrollIntoView', () => {
    // scrollIntoView would also scroll a page that embeds GenU in an iframe.
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const { api, scroller } = renderScreen();

    act(() => api.current!.scrollToBottom());
    expect(scroller.scrollTop).toBe(900);
    act(() => api.current!.scrollToTop());
    expect(scroller.scrollTop).toBe(0);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe('scrollToEdge', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('scrolls the nearest scroll container to the bottom', () => {
    const { container, anchor } = makeContainer(1200);
    scrollToEdge(anchor, 'bottom');
    expect(container.scrollTop).toBe(1200);
  });

  it('scrolls the nearest scroll container to the top', () => {
    const { container, anchor } = makeContainer(1200);
    container.scrollTop = 500;
    scrollToEdge(anchor, 'top');
    expect(container.scrollTop).toBe(0);
  });

  it('falls back to the document when no scroll container exists', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const root = document.scrollingElement ?? document.documentElement;
    root.scrollTop = 300;
    scrollToEdge(anchor, 'top');
    expect(root.scrollTop).toBe(0);
  });
});
