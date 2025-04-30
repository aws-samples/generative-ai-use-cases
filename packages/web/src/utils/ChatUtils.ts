/**
 * Extract the xxxx part from usecase#xxxx format
 * @param _usecaseId usecase#xxxx format usecaseId
 * @returns null if it is not usecase#xxxx format
 */
export const decomposeId = (_usecaseId: string): string | null => {
  if (!_usecaseId.includes('#')) {
    return null;
  }
  return _usecaseId.split('#')[1];
};
