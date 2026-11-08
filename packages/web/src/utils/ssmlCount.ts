// Polly limits: 3000 billed characters (tags excluded), 6000 characters in total
export const MAX_BILLED_CHARACTERS = 3000;
export const MAX_REQUEST_CHARACTERS = 6000;

const SPEAK_START = /^\s*<speak[\s>/]/;

/** Wrap the user's SSML with <speak> unless it already starts with it. */
export const wrapSpeak = (ssml: string): string =>
  SPEAK_START.test(ssml) ? ssml : `<speak>${ssml}</speak>`;

const ENTITY = /&(?:[A-Za-z][A-Za-z0-9]*|#\d+|#x[0-9A-Fa-f]+);/g;

/**
 * Number of billed characters of an SSML text: tags and comments are not
 * billed, an entity such as &amp; counts as one character. Counted by code points.
 */
export const countBilledCharacters = (ssml: string): number =>
  Array.from(
    ssml
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(ENTITY, '_')
  ).length;

/** Length of the request text sent to Polly (the <speak> wrapper included). */
export const countRequestCharacters = (ssml: string): number =>
  Array.from(wrapSpeak(ssml)).length;
