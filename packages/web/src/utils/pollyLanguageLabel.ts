/**
 * Build the label of a Polly language option, e.g. "Japanese (ja-JP)".
 * Polly codes such as "en-GB-WLS" are not well-formed BCP 47 tags, so
 * Intl.DisplayNames#of can throw a RangeError. In that case (or when it
 * returns nothing) the name returned by the API is used instead.
 */
export const getLanguageLabel = (
  displayNames: Pick<Intl.DisplayNames, 'of'> | null | undefined,
  code: string,
  name: string
): string => {
  let displayName: string | undefined;
  try {
    displayName = displayNames?.of(code);
  } catch {
    displayName = undefined;
  }
  return `${displayName || name || code} (${code})`;
};
