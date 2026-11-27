import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRender, mockInitialize } = vi.hoisted(() => ({
  mockRender: vi.fn(),
  mockInitialize: vi.fn(),
}));

vi.mock('mermaid', () => ({
  default: { initialize: mockInitialize, render: mockRender },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('copy-to-clipboard', () => ({
  default: () => true,
  __esModule: true,
}));

import { MermaidWithToggle } from '../../../src/components/Mermaid/MermaidWithToggle';
import { svgToDataUrl } from '../../../src/utils/svgDataUrl';

// The config the component initializes mermaid with, read before any test
// clears the mock
const initConfig = mockInitialize.mock.calls[0]?.[0];

// What a diagram whose label carries HTML renders to
const SVG_WITH_FORM =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">' +
  '<foreignObject width="100" height="50">' +
  '<div xmlns="http://www.w3.org/1999/xhtml">' +
  '<form id="f" action="https://example.com/collect" method="post">' +
  '<input id="p" type="password" /></form></div></foreignObject></svg>';

describe('svgToDataUrl', () => {
  it('returns an SVG data URL sized to its box', () => {
    const url = svgToDataUrl(SVG_WITH_FORM);
    expect(url?.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    const markup = decodeURIComponent(url!.split(',').slice(1).join(','));
    expect(markup).toContain('width="100%"');
    expect(markup).toContain('height="100%"');
  });

  it('keeps everything after an HTML label that is not well-formed XML', () => {
    // Mermaid writes `<br>` in HTML labels without closing it
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<g class="node" id="B"><foreignObject width="50" height="20">' +
      '<div xmlns="http://www.w3.org/1999/xhtml">line 1<br>line 2</div>' +
      '</foreignObject></g>' +
      '<g class="node" id="C"><rect width="10" height="10"></rect></g></svg>';
    const url = svgToDataUrl(svg);
    const markup = decodeURIComponent(url!.split(',').slice(1).join(','));
    const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');

    expect(parsed.querySelector('parsererror')).toBeNull();
    expect(parsed.getElementById('C')).not.toBeNull();
    expect(markup).toContain('line 2');
  });

  it('returns null when there is no svg element', () => {
    expect(svgToDataUrl('<div>not svg</div>')).toBeNull();
  });
});

describe('MermaidWithToggle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockRender.mockResolvedValue({ svg: SVG_WITH_FORM });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('keeps diagrams from changing their own stylesheet', () => {
    const config = initConfig;
    expect(config.securityLevel).toBe('strict');
    expect(config.secure).toContain('themeCSS');
    expect(config.secure).toContain('securityLevel');
  });

  it('shows the diagram as an image, not as page markup', async () => {
    const { container } = render(
      <MemoryRouter>
        <MermaidWithToggle code={'flowchart TD\n  A["x"]'} />
      </MemoryRouter>
    );
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.querySelector('foreignObject')).toBeNull();
  });

  it('shows a message for a diagram that cannot be rendered', async () => {
    mockRender.mockRejectedValue(new Error('Parse error'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(
      <MemoryRouter>
        <MermaidWithToggle code={'not mermaid'} />
      </MemoryRouter>
    );
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(container.textContent).toContain('diagram.invalid_syntax');
    expect(container.querySelector('img')).toBeNull();
  });
});
