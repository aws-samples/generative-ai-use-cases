import { useEffect, useMemo, useState, memo } from 'react';
import { BaseProps } from '../@types/common';
import { default as ReactMarkdown } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import ButtonCopy from './ButtonCopy';
import useRagFile from '../hooks/useRagFile';
import { PiSpinnerGap } from 'react-icons/pi';
import useFileApi from '../hooks/useFileApi';

// Reduce bundle size by registering only the languages used in the project
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import graphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql';
import ini from 'react-syntax-highlighter/dist/esm/languages/prism/ini';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import perl from 'react-syntax-highlighter/dist/esm/languages/prism/perl';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import xmlDoc from 'react-syntax-highlighter/dist/esm/languages/prism/xml-doc';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { useLocation } from 'react-router-dom';

SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('diff', diff);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('graphql', graphql);
SyntaxHighlighter.registerLanguage('ini', ini);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('markdown', markdown);
SyntaxHighlighter.registerLanguage('perl', perl);
SyntaxHighlighter.registerLanguage('php', php);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('xml-doc', xmlDoc);
SyntaxHighlighter.registerLanguage('yaml', yaml);

type Props = BaseProps & {
  children: string;
  prefix?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LinkRenderer = (props: any) => {
  // Currently, the file download function from S3 is only used in RAG chat
  const { downloadDoc, isS3Url, downloading } = useRagFile();
  const isS3 = useMemo(() => {
    return isS3Url(props.href);
  }, [isS3Url, props.href]);

  // For Knowledge Base, we pass s3Type as a parameter
  // since it may need to reference S3 from a different account
  const location = useLocation();
  const isKnowledgeBase = useMemo(() => {
    return location.pathname.includes('/rag-knowledge-base');
  }, [location.pathname]);

  return (
    <>
      {isS3 ? (
        <a
          id={props.id}
          onClick={() => {
            if (!downloading) {
              downloadDoc(
                props.href,
                isKnowledgeBase ? 'knowledgeBase' : 'default'
              );
            }
          }}
          className={`cursor-pointer ${downloading ? 'text-gray-400' : ''}`}>
          {props.children}
          {downloading && (
            <PiSpinnerGap className="mx-2 inline-block animate-spin" />
          )}
        </a>
      ) : (
        <a
          id={props.id}
          href={props.href}
          target={props.href.startsWith('#') ? '_self' : '_blank'}
          rel="noreferrer">
          {props.children}
        </a>
      )}
    </>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ImageRenderer = (props: any) => {
  const { isS3Url } = useRagFile();
  const { getFileDownloadSignedUrl } = useFileApi();
  const [src, setSrc] = useState(props.src);

  useEffect(() => {
    if (isS3Url(props.src)) {
      getFileDownloadSignedUrl(props.src).then((url) => setSrc(url));
    }
  }, [getFileDownloadSignedUrl, isS3Url, props.src]);

  return <img id={props.id} src={src} />;
};

const CodeRenderer = memo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (props: any) => {
    const language = /language-(\w+)/.exec(props.className || '')?.[1];
    const codeText = String(props.children).replace(/\n$/, '');
    const isCodeBlock = codeText.includes('\n');
    return (
      <>
        {language ? (
          // Code block with language
          <>
            <div className="flex">
              <span className="flex-auto">{language}</span>
              <ButtonCopy
                className="mr-2 justify-end text-gray-400"
                text={codeText}
              />
            </div>
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={language || 'plaintext'}>
              {codeText}
            </SyntaxHighlighter>
          </>
        ) : isCodeBlock ? (
          // Code block without language
          <code className="block rounded-md py-1">
            {codeText.split('\n').map((line, index) => (
              <span key={`line-${index}`} className="block px-1 py-0">
                {line}
              </span>
            ))}
          </code>
        ) : (
          // Inline code
          <span className="bg-aws-squid-ink/10 border-aws-squid-ink/30 inline rounded-md border px-1 py-0.5">
            {codeText}
          </span>
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if the code content or language changes
    return (
      String(prevProps.children) === String(nextProps.children) &&
      prevProps.className === nextProps.className
    );
  }
);

const Markdown = memo(({ className, prefix, children }: Props) => {
  return (
    <ReactMarkdown
      className={`${className ?? ''} prose max-w-full`}
      children={children}
      remarkPlugins={[remarkGfm, remarkBreaks]}
      remarkRehypeOptions={{ clobberPrefix: prefix }}
      components={{
        a: LinkRenderer,
        img: ImageRenderer,
        sup: ({ children }) => (
          <sup className="m-0.5 rounded-full bg-gray-200 px-1">{children}</sup>
        ),
        code: CodeRenderer,
      }}
    />
  );
});

export default Markdown;
