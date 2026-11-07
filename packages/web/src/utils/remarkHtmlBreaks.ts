// Minimal mdast shape; only `type`, `value` and `children` are read.
type MdastNode = {
  type: string;
  value?: string;
  children?: MdastNode[];
};

const BR_TAG = /^<br\s*\/?>$/i;

const replaceBreaks = (node: MdastNode): void => {
  if (!node.children) return;
  node.children = node.children.map((child) =>
    child.type === 'html' && BR_TAG.test((child.value ?? '').trim())
      ? { type: 'break' }
      : child
  );
  node.children.forEach(replaceBreaks);
};

/**
 * Turn `<br>` tags in Markdown into line breaks.
 *
 * Models put `<br>` inside table cells because a GFM table row cannot contain
 * a newline. Raw HTML is not rendered (there is deliberately no rehype-raw),
 * so the tag used to show up as literal text. Only a bare `<br>`, `<br/>` or
 * `<br />` is converted, into a Markdown `break` node; every other HTML tag is
 * left as before.
 */
const remarkHtmlBreaks = () => (tree: MdastNode) => {
  replaceBreaks(tree);
};

export default remarkHtmlBreaks;
