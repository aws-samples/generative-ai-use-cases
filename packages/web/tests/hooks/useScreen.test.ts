import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrollToEdge } from '../../src/hooks/useScreen';

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

  it('does not use scrollIntoView, which also scrolls an embedding page', () => {
    const { anchor } = makeContainer(1200);
    const spy = vi.fn();
    anchor.scrollIntoView = spy;
    scrollToEdge(anchor, 'bottom');
    expect(spy).not.toHaveBeenCalled();
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
