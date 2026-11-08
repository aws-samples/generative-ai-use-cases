import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { getSignedUrl } = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// Like the real hooks, return new functions on every render.
vi.mock('../../src/hooks/useRagFile', () => ({
  default: () => ({
    downloadDoc: vi.fn(),
    isS3Url: (url: string) => {
      try {
        return new URL(url).hostname.endsWith('.amazonaws.com');
      } catch {
        return false;
      }
    },
  }),
}));
vi.mock('../../src/hooks/useFileApi', () => ({
  default: () => ({
    getFileDownloadSignedUrl: (url: string) => getSignedUrl(url),
  }),
}));

import Markdown from '../../src/components/Markdown';

const S3_IMAGE = 'https://bucket.s3.us-east-1.amazonaws.com/images/a.png';

const tree = (md: string) => (
  <MemoryRouter>
    <Markdown>{md}</Markdown>
  </MemoryRouter>
);

const renderMarkdown = (md: string) => render(tree(md));

describe('Markdown S3 images', () => {
  beforeEach(() => {
    getSignedUrl.mockReset();
    // Each signed URL differs, as real presigned URLs do.
    let n = 0;
    getSignedUrl.mockImplementation(async () => `https://signed/${++n}`);
  });

  it('fetches the signed URL once per image, not on every render', async () => {
    const { container, rerender } = renderMarkdown(`![a](${S3_IMAGE})`);
    await waitFor(() =>
      expect(container.querySelector('img')?.getAttribute('src')).toBe(
        'https://signed/1'
      )
    );

    // A streamed chunk re-renders the message with more text after the image.
    rerender(tree(`![a](${S3_IMAGE})\n\nmore text`));
    await new Promise((r) => setTimeout(r, 50));

    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://signed/1'
    );
  });

  it('does not fetch a signed URL for a non-S3 image', async () => {
    const { container } = renderMarkdown('![a](https://example.com/a.png)');
    await new Promise((r) => setTimeout(r, 20));
    expect(getSignedUrl).not.toHaveBeenCalled();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/a.png'
    );
  });
});
