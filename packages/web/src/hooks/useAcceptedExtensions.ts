import { useMemo } from 'react';
import { FileLimit } from 'generative-ai-use-cases';
import { MODELS } from './useModel';

// File extensions the model accepts, limited to the file types in fileLimit.
// An empty list means the model accepts no files.
const useAcceptedExtensions = (
  fileLimit: FileLimit,
  modelId: string | undefined
): string[] => {
  return useMemo(() => {
    if (!modelId) return [];
    const { flags } = MODELS.getModelMetadata(modelId);
    return [
      ...(flags.doc ? fileLimit.accept.doc : []),
      ...(flags.image ? fileLimit.accept.image : []),
      ...(flags.video ? fileLimit.accept.video : []),
    ];
  }, [fileLimit, modelId]);
};

export default useAcceptedExtensions;
