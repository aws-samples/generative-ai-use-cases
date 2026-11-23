/**
 * Copy of the table prepared for the clipboard.
 *
 * - KaTeX output holds the formula three times (MathML, the TeX source in an
 *   <annotation>, and the visual HTML). Without CSS, a paste would show all of
 *   them, so each formula is replaced by its TeX source.
 * - Images are replaced by their alt text. In chat their src is often a
 *   presigned S3 URL, which must not travel into a pasted document.
 */
const cloneForClipboard = <T extends HTMLElement>(el: T): T => {
  const clone = el.cloneNode(true) as T;
  clone.querySelectorAll('.katex').forEach((katex) => {
    const tex = katex.querySelector(
      'annotation[encoding="application/x-tex"]'
    )?.textContent;
    katex.replaceWith(tex ?? katex.textContent ?? '');
  });
  clone
    .querySelectorAll('img')
    .forEach((img) => img.replaceWith(img.getAttribute('alt') ?? ''));
  return clone;
};

/**
 * Convert a rendered table to tab-separated text, one row per line.
 *
 * Spreadsheets split pasted plain text on tabs and newlines, so whitespace and
 * line breaks inside a cell are collapsed to single spaces to keep each cell in
 * one cell. This is the fallback for targets that ignore the HTML flavor.
 */
export const tableToTsv = (table: HTMLTableElement): string =>
  Array.from(cloneForClipboard(table).rows)
    .map((row) => Array.from(row.cells).map(cellText).join('\t'))
    .join('\n');

const cellText = (cell: HTMLTableCellElement): string => {
  // <br> has no text content; without this "a<br>b" would paste as "ab".
  cell.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  return (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
};

/**
 * HTML for the clipboard. Excel, Google Sheets and Word all read a bare
 * `<table>` and keep the cell structure; the page's CSS classes are dropped so
 * the paste takes the target's own styling.
 */
export const tableToClipboardHtml = (table: HTMLTableElement): string => {
  const clone = cloneForClipboard(table);
  clone
    .querySelectorAll('[class]')
    .forEach((el) => el.removeAttribute('class'));
  clone.removeAttribute('class');
  return clone.outerHTML;
};
