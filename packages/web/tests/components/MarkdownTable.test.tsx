import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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

// Capture what the copy button puts on the clipboard.
const { copyMock } = vi.hoisted(() => ({ copyMock: vi.fn() }));
vi.mock('copy-to-clipboard', () => ({ default: copyMock }));

import Markdown from '../../src/components/Markdown';

const TABLE_MD = '| Name | Qty |\n|---|---|\n| Apple | 3 |';
const PLAIN_MD = 'plain text';

const renderMarkdown = (md: string) =>
  render(
    <MemoryRouter>
      <Markdown>{md}</Markdown>
    </MemoryRouter>
  );

describe('Markdown table', () => {
  beforeEach(() => {
    copyMock.mockReset();
  });

  it('renders a copy button next to a GFM table', () => {
    renderMarkdown(TABLE_MD);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByTitle('common.copy_table')).toBeTruthy();
  });

  it('copies the table as TSV and as HTML', async () => {
    const setData = vi.fn();
    copyMock.mockImplementation(
      (_text: string, options: { onCopy: (d: unknown) => void }) => {
        options.onCopy({ setData });
        return true;
      }
    );
    renderMarkdown(TABLE_MD);
    await act(async () => {
      screen.getByTitle('common.copy_table').click();
    });

    expect(copyMock).toHaveBeenCalledTimes(1);
    const [text, options] = copyMock.mock.calls[0];
    expect(text).toBe('Name\tQty\nApple\t3');
    expect(options.format).toBe('text/plain');
    expect(setData).toHaveBeenCalledWith(
      'text/html',
      expect.stringMatching(/^<table><thead><tr><th>Name<\/th>/)
    );
  });

  it('does not add a button when there is no table', () => {
    renderMarkdown(PLAIN_MD);
    expect(screen.queryByTitle('common.copy_table')).toBeNull();
  });
});
