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

const renderMarkdown = (md: string) =>
  render(
    <MemoryRouter>
      <Markdown>{md}</Markdown>
    </MemoryRouter>
  ).container;

const TABLE_WITH_BR =
  '| item | steps |\n|---|---|\n| setup | step 1<br>step 2<br/>step 3<br />done |';

const OTHER_HTML = 'a <b>bold</b> and <br class="x"> stay as text';
const BR_IN_CODE = '| x | `a<br>b` |\n|---|---|\n\n```\nx<br>y\n```';

describe('Markdown <br> handling', () => {
  it('renders <br> in a table cell as a line break, not as text', () => {
    const container = renderMarkdown(TABLE_WITH_BR);
    const cell = container.querySelectorAll('td')[1];
    // react-markdown emits a newline text node after each <br>.
    expect(cell.textContent).toBe('step 1\nstep 2\nstep 3\ndone');
    expect(cell.querySelectorAll('br')).toHaveLength(3);
    expect(container.textContent).not.toContain('<br');
  });

  it('leaves other HTML tags as literal text', () => {
    const container = renderMarkdown(OTHER_HTML);
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('br')).toBeNull();
    expect(container.textContent).toContain('<b>bold</b>');
    expect(container.textContent).toContain('<br class="x">');
  });

  it('does not convert <br> inside inline code or a code block', () => {
    const container = renderMarkdown(BR_IN_CODE);
    expect(container.querySelectorAll('br')).toHaveLength(0);
    expect(container.textContent).toContain('a<br>b');
    expect(container.textContent).toContain('x<br>y');
  });
});
