/**
 * Builds the regular expression that finds a review comment's excerpt in the
 * text. Any run of whitespace in the excerpt (spaces, tabs, newlines) matches
 * any run of whitespace in the text, including none.
 *
 * Each run becomes a single `\s*`. Writing one quantifier per newline and per
 * space instead gives adjacent quantifiers. Matching those against a long run
 * of whitespace takes far longer with each extra quantifier and can freeze the
 * page.
 *
 * Returns null when the excerpt has no text. An empty pattern matches the
 * empty string, and the search loop would never advance.
 */
export const buildExcerptRegex = (excerpt: string): RegExp | null => {
  const trimmed = excerpt.trim();
  if (trimmed === '') return null;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped.replace(/\s+/g, '\\s*'), 'g');
};
