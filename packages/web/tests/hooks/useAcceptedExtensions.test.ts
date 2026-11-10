import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { FileLimit } from 'generative-ai-use-cases';
import useAcceptedExtensions from '../../src/hooks/useAcceptedExtensions';

vi.mock('../../src/hooks/useModel', () => ({
  MODELS: {
    getModelMetadata: (modelId: string) =>
      ({
        'all-model': { flags: { doc: true, image: true, video: true } },
        'doc-model': { flags: { doc: true } },
        'image-model': { flags: { image: true } },
      })[modelId] ?? { flags: {} },
  },
}));

const fileLimit: FileLimit = {
  accept: { doc: ['.pdf'], image: ['.png'], video: ['.mp4'] },
  maxFileCount: 5,
  maxFileSizeMB: 4.5,
  maxImageFileCount: 20,
  maxImageFileSizeMB: 3.75,
  maxVideoFileCount: 1,
  maxVideoFileSizeMB: 25,
};

const accepted = (modelId: string | undefined, limit = fileLimit) =>
  renderHook(() => useAcceptedExtensions(limit, modelId)).result.current;

describe('useAcceptedExtensions', () => {
  it('returns no extensions without a model', () => {
    expect(accepted(undefined)).toEqual([]);
  });

  it('returns the extensions of every file type the model supports', () => {
    expect(accepted('all-model')).toEqual(['.pdf', '.png', '.mp4']);
  });

  it('returns only the file types the model supports', () => {
    expect(accepted('doc-model')).toEqual(['.pdf']);
    expect(accepted('image-model')).toEqual(['.png']);
  });

  it('returns no extensions for an unknown model', () => {
    expect(accepted('unknown-model')).toEqual([]);
  });

  it('skips file types that fileLimit does not accept', () => {
    const noVideo = {
      ...fileLimit,
      accept: { ...fileLimit.accept, video: [] },
    };
    expect(accepted('all-model', noVideo)).toEqual(['.pdf', '.png']);
  });
});
