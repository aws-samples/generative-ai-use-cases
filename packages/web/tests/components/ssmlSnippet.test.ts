import { describe, expect, it } from 'vitest';
import { insertAtCursor, wrapSelection } from '../../src/utils/ssmlSnippet';

describe('wrapSelection', () => {
  it('wraps the selected text and selects it', () => {
    const r = wrapSelection('say Hello now', 4, 9, '<p>', '</p>', 'text');
    expect(r.value).toBe('say <p>Hello</p> now');
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe('Hello');
  });

  it('works with a reversed selection range', () => {
    const r = wrapSelection('say Hello now', 9, 4, '<s>', '</s>', 'text');
    expect(r.value).toBe('say <s>Hello</s> now');
  });

  it('uses the placeholder when the selection is empty', () => {
    const r = wrapSelection('ab', 1, 1, '<p>', '</p>', 'text');
    expect(r.value).toBe('a<p>text</p>b');
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe('text');
  });

  it('handles empty text', () => {
    const r = wrapSelection('', 0, 0, '<p>', '</p>', 'text');
    expect(r.value).toBe('<p>text</p>');
  });

  it('selects a part of the opening tag when asked', () => {
    const r = wrapSelection(
      'GenU',
      0,
      4,
      '<sub alias="reading">',
      '</sub>',
      'text',
      'reading'
    );
    expect(r.value).toBe('<sub alias="reading">GenU</sub>');
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe('reading');
  });

  it('clamps out of range positions', () => {
    const r = wrapSelection('ab', 10, 20, '<p>', '</p>', 'x');
    expect(r.value).toBe('ab<p>x</p>');
  });
});

describe('insertAtCursor', () => {
  it('inserts at the cursor and puts the caret after it', () => {
    const r = insertAtCursor('ab', 1, 1, '<break time="500ms"/>');
    expect(r.value).toBe('a<break time="500ms"/>b');
    expect(r.selectionStart).toBe(r.selectionEnd);
    expect(r.value.slice(0, r.selectionStart)).toBe('a<break time="500ms"/>');
  });

  it('keeps the selected text and inserts after it', () => {
    const r = insertAtCursor('abcd', 1, 3, '|');
    expect(r.value).toBe('abc|d');
    expect(r.selectionStart).toBe(4);
  });

  it('inserts into empty text', () => {
    const r = insertAtCursor('', 0, 0, '<p>x</p>');
    expect(r.value).toBe('<p>x</p>');
    expect(r.selectionStart).toBe(8);
  });
});
