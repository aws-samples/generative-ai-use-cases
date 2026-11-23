import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Select from '../../src/components/Select';

const options = [
  { value: 'a', label: 'Model Alpha', tags: ['Tag Alpha'] },
  { value: 'b', label: 'Model Beta', tags: ['Tag Beta'] },
];

// Browser translation can replace a Text node without informing React.
const translateText = (container: HTMLElement) => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.textContent === 'Model Alpha') nodes.push(node);
  }
  for (const node of nodes) {
    const translated = document.createElement('font');
    translated.textContent = 'Translated Alpha';
    node.parentNode!.replaceChild(translated, node);
  }
  expect(nodes).toHaveLength(1);
};

afterEach(cleanup);
describe('Select after browser translation', () => {
  it.each([false, true])(
    'updates a translated selection (showTags=%s)',
    (showTags) => {
      const onChange = vi.fn();
      const view = render(
        <Select
          value="a"
          options={options}
          onChange={onChange}
          showTags={showTags}
        />
      );
      translateText(view.container);
      expect(() =>
        view.rerender(
          <Select
            value="b"
            options={options}
            onChange={onChange}
            showTags={showTags}
          />
        )
      ).not.toThrow();
      expect(screen.getByRole('button').textContent).toContain('Model Beta');
      if (showTags)
        expect(screen.getByRole('button').textContent).toContain('Tag Beta');
    }
  );

  it('survives an unrelated rerender with the same selected value', () => {
    const onChange = vi.fn();
    const view = render(
      <Select value="a" options={options} onChange={onChange} />
    );
    translateText(view.container);
    expect(() =>
      view.rerender(
        <Select value="a" options={[...options]} onChange={onChange} />
      )
    ).not.toThrow();
    expect(screen.getByRole('button').textContent).toContain('Model Alpha');
  });

  it('can clear a translated selection and show the placeholder', () => {
    const onChange = vi.fn();
    const props = {
      options,
      onChange,
      clearable: true,
      placeholder: 'Choose a model',
    };
    const view = render(<Select {...props} value="a" />);
    translateText(view.container);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(onChange).toHaveBeenCalledWith('');
    expect(() => view.rerender(<Select {...props} value="" />)).not.toThrow();
    expect(screen.getByRole('button').textContent).toContain('Choose a model');
  });

  it('preserves color chip rendering', () => {
    const view = render(
      <Select
        value="#ffffff"
        options={[{ value: '#ffffff', label: 'White' }]}
        onChange={vi.fn()}
        showColorChips
      />
    );
    expect(
      view.container.querySelector('[style]')?.getAttribute('style')
    ).toContain('background-color');
    expect(screen.getByRole('button').textContent).toContain('White');
  });
});
