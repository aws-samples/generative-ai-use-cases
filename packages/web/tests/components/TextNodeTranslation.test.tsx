import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { FilterSelect } from '../../src/components/FilterSelect';
import FileCard from '../../src/components/FileCard';
import Button from '../../src/components/Button';

// Browser translation can replace a Text node without informing React.
const translate = (container: HTMLElement) => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (!node.textContent?.trim()) continue;
    const font = document.createElement('font');
    font.textContent = 'Translated ' + node.textContent;
    node.parentNode!.replaceChild(font, node);
  }
};

afterEach(cleanup);

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('FilterSelect (multiple) after browser translation', () => {
  it('selects the first item while the placeholder is translated', () => {
    const view = render(
      <FilterSelect
        isMultiple
        options={options}
        value={null}
        onChange={vi.fn()}
      />
    );
    translate(view.container);
    expect(() =>
      view.rerender(
        <FilterSelect
          isMultiple
          options={options}
          value={[options[0]]}
          onChange={vi.fn()}
        />
      )
    ).not.toThrow();
  });

  it('clears back to the placeholder after translation', () => {
    const view = render(
      <FilterSelect
        isMultiple
        options={options}
        value={[options[0]]}
        onChange={vi.fn()}
      />
    );
    translate(view.container);
    expect(() =>
      view.rerender(
        <FilterSelect
          isMultiple
          options={options}
          value={null}
          onChange={vi.fn()}
        />
      )
    ).not.toThrow();
  });
});

describe('FileCard after browser translation', () => {
  it('gets its signed URL after the file name was translated', () => {
    const view = render(<FileCard filename="report.pdf" size="m" />);
    translate(view.container);
    expect(() =>
      view.rerender(
        <FileCard filename="report.pdf" url="https://example.com/r" size="m" />
      )
    ).not.toThrow();
  });

  it('loses and regains its URL after translation (ChatMessage refetch)', () => {
    const view = render(
      <FileCard filename="report.pdf" url="https://example.com/r" size="m" />
    );
    view.rerender(<FileCard filename="report.pdf" size="m" />);
    translate(view.container);
    expect(() =>
      view.rerender(
        <FileCard filename="report.pdf" url="https://example.com/r" size="m" />
      )
    ).not.toThrow();
  });
});

describe('Button after browser translation', () => {
  const label = 'Generate';
  it('shows the loading spinner while its label is translated', () => {
    const view = render(<Button onClick={vi.fn()}>{label}</Button>);
    translate(view.container);
    expect(() =>
      view.rerender(
        <Button onClick={vi.fn()} loading>
          {label}
        </Button>
      )
    ).not.toThrow();
    expect(() =>
      view.rerender(<Button onClick={vi.fn()}>{label}</Button>)
    ).not.toThrow();
  });
});
