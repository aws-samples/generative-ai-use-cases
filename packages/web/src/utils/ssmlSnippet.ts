// Pure helpers that edit the text of the SSML textarea.

export type TextEdit = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

/**
 * Wrap the selected text with `open` and `close`. With an empty selection,
 * `placeholder` is used as the content. The selection afterwards is the
 * content, or the first occurrence of `focusText` inside `open`.
 */
export const wrapSelection = (
  value: string,
  start: number,
  end: number,
  open: string,
  close: string,
  placeholder = '',
  focusText?: string
): TextEdit => {
  const from = Math.max(0, Math.min(start, end, value.length));
  const to = Math.min(value.length, Math.max(start, end));
  const inner = from === to ? placeholder : value.slice(from, to);
  const next = value.slice(0, from) + open + inner + close + value.slice(to);
  const focusAt = focusText ? open.indexOf(focusText) : -1;
  if (focusText && focusAt >= 0) {
    return {
      value: next,
      selectionStart: from + focusAt,
      selectionEnd: from + focusAt + focusText.length,
    };
  }
  return {
    value: next,
    selectionStart: from + open.length,
    selectionEnd: from + open.length + inner.length,
  };
};

/**
 * Insert `snippet` after the selection (the selected text is kept) and put
 * the caret after the inserted text.
 */
export const insertAtCursor = (
  value: string,
  start: number,
  end: number,
  snippet: string
): TextEdit => {
  const at = Math.min(value.length, Math.max(0, Math.max(start, end)));
  const next = value.slice(0, at) + snippet + value.slice(at);
  const caret = at + snippet.length;
  return { value: next, selectionStart: caret, selectionEnd: caret };
};
