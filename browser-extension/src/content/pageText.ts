// Upper limit of the page text handed to the chat, so that a long page does
// not exceed the model's input or make the request slow
export const MAX_PAGE_TEXT_LENGTH = 30000;

const MAIN_SELECTORS = ['article', 'main', '[role="main"]'];

// Menus and side panels that some sites put inside the main content
const NOISE_SELECTORS = 'nav, aside, footer, [role="navigation"], [role="complementary"]';

/**
 * The text of the page the user is reading, for "use this page" in the
 * context menu. Prefers the main content (main / article) over the whole
 * body, and starts with the title and URL so the model knows the source.
 */
export const extractPageText = (
  doc: Document = document,
  maxLength: number = MAX_PAGE_TEXT_LENGTH,
): string => {
  const main = MAIN_SELECTORS.map((s) => doc.querySelector<HTMLElement>(s)).find(
    (el) => el && el.innerText.trim().length > 0,
  );
  const root = main ?? doc.body;
  // Remove their text from the result; the page itself is not changed
  let raw = root?.innerText ?? '';
  root?.querySelectorAll<HTMLElement>(NOISE_SELECTORS).forEach((el) => {
    const noise = el.innerText.trim();
    if (noise) raw = raw.replace(noise, '');
  });
  const text = raw
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const body =
    text.length > maxLength
      ? `${text.slice(0, maxLength)}\n\n（長いため、ここから先は省略しました）`
      : text;
  return `# ${doc.title}\n${doc.location.href}\n\n${body}`;
};
