import React, { ComponentProps, JSX } from 'react';
import ReactMarkdown, { Components, ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

// An element with fixed classes. react-markdown also passes the syntax tree
// node as a prop, which is left off the DOM element.
const styled = <T extends keyof JSX.IntrinsicElements>(
  tag: T,
  className: string,
  extra: Partial<ComponentProps<T>> = {},
) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const Styled = ({ node, ...props }: ComponentProps<T> & ExtraProps) =>
    React.createElement(tag, { className, ...extra, ...props });
  Styled.displayName = `Markdown(${tag})`;
  return Styled;
};

// Styles for each element: the chat page and the content script share the
// Tailwind config, so the typography plugin is not used.
const components: Components = {
  p: styled('p', 'my-1'),
  a: styled('a', 'text-aws-sky underline break-all', {
    target: '_blank',
    rel: 'noopener noreferrer',
  }),
  h1: styled('h1', 'text-lg font-bold mt-3 mb-1'),
  h2: styled('h2', 'text-base font-bold mt-3 mb-1'),
  h3: styled('h3', 'font-bold mt-2 mb-1'),
  h4: styled('h4', 'font-bold mt-2 mb-1'),
  ul: styled('ul', 'list-disc pl-5 my-1'),
  ol: styled('ol', 'list-decimal pl-5 my-1'),
  blockquote: styled('blockquote', 'border-l-4 border-white/30 pl-3 my-2 opacity-80'),
  hr: styled('hr', 'border-white/30 my-2'),
  // Inline code. A code block resets these styles inside pre.
  code: styled('code', 'bg-white/10 rounded px-1 font-mono text-sm'),
  pre: styled(
    'pre',
    'bg-black/30 rounded p-2 my-2 overflow-x-auto text-sm [&>code]:bg-transparent [&>code]:p-0',
  ),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-2">
      <table className="border-collapse text-sm" {...props} />
    </div>
  ),
  th: styled('th', 'border border-white/30 px-2 py-1 bg-white/10 text-left'),
  td: styled('td', 'border border-white/30 px-2 py-1 align-top'),
};

type Props = {
  children: string;
};

/**
 * Show a model's response as Markdown (tables, code, lists, links).
 * Raw HTML in the response is not rendered.
 */
const MarkdownContent: React.FC<Props> = ({ children }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
    {children}
  </ReactMarkdown>
);

export default MarkdownContent;
