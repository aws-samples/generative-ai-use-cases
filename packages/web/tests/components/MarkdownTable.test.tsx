import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

const TABLE_MD = '| a | b |\n|---|---|\n| 1 | 2 |';
const PLAIN_MD = 'plain text';

describe('Markdown table', () => {
  it('renders a copy button next to a GFM table', () => {
    render(
      <MemoryRouter>
        <Markdown>{TABLE_MD}</Markdown>
      </MemoryRouter>
    );
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByTitle('common.copy_table')).toBeTruthy();
  });

  it('does not add a button when there is no table', () => {
    render(
      <MemoryRouter>
        <Markdown>{PLAIN_MD}</Markdown>
      </MemoryRouter>
    );
    expect(screen.queryByTitle('common.copy_table')).toBeNull();
  });
});
