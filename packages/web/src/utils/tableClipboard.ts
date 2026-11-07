/**
 * Convert a rendered table to tab-separated text, one row per line.
 *
 * Spreadsheets split pasted plain text on tabs and newlines, so whitespace and
 * line breaks inside a cell are collapsed to single spaces to keep each cell in
 * one cell. This is the fallback for targets that ignore the HTML flavor.
 */
export const tableToTsv = (table: HTMLTableElement): string =>
  Array.from(table.rows)
    .map((row) => Array.from(row.cells).map(cellText).join('\t'))
    .join('\n');

const cellText = (cell: HTMLTableCellElement): string => {
  // <br> has no text content; without this "a<br>b" would paste as "ab".
  const clone = cell.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
};

/**
 * HTML for the clipboard. Excel, Google Sheets and Word all read a bare
 * `<table>` and keep the cell structure; the page's CSS classes are dropped so
 * the paste takes the target's own styling.
 */
export const tableToClipboardHtml = (table: HTMLTableElement): string => {
  const clone = table.cloneNode(true) as HTMLTableElement;
  clone
    .querySelectorAll('[class]')
    .forEach((el) => el.removeAttribute('class'));
  clone.removeAttribute('class');
  return clone.outerHTML;
};
