import { describe, it, expect } from 'vitest';
import {
  tableToClipboardHtml,
  tableToTsv,
} from '../../src/utils/tableClipboard';

const makeTable = (html: string): HTMLTableElement => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper.querySelector('table')!;
};

describe('tableToTsv', () => {
  it('joins cells with tabs and rows with newlines, header included', () => {
    const table = makeTable(
      '<table><thead><tr><th>Name</th><th>Qty</th></tr></thead>' +
        '<tbody><tr><td>Apple</td><td>3</td></tr><tr><td>Pear</td><td>5</td></tr></tbody></table>'
    );
    expect(tableToTsv(table)).toBe('Name\tQty\nApple\t3\nPear\t5');
  });

  it('keeps a multi-line or tabbed cell in one spreadsheet cell', () => {
    const table = makeTable(
      '<table><tbody><tr><td>step 1<br>step 2\nstep 3</td><td>a\tb</td></tr></tbody></table>'
    );
    expect(tableToTsv(table)).toBe('step 1 step 2 step 3\ta b');
  });

  it('uses the text of formatted cells', () => {
    const table = makeTable(
      '<table><tbody><tr><td><strong>bold</strong> and <code>code</code></td></tr></tbody></table>'
    );
    expect(tableToTsv(table)).toBe('bold and code');
  });
});

describe('tableToClipboardHtml', () => {
  it('returns the table markup without CSS classes', () => {
    const table = makeTable(
      '<table class="x"><tbody><tr><td class="y"><strong class="z">1</strong></td></tr></tbody></table>'
    );
    const html = tableToClipboardHtml(table);
    expect(html).toBe(
      '<table><tbody><tr><td><strong>1</strong></td></tr></tbody></table>'
    );
    // The rendered table is left untouched.
    expect(table.className).toBe('x');
  });
});
