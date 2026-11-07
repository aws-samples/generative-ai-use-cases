import React, { useEffect, useMemo, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BaseProps } from '../@types/common';
import { default as ReactMarkdown } from 'react-markdown';
import type { ExtraProps } from 'react-markdown';
import type { ComponentProps } from 'react';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkHtmlBreaks from '../utils/remarkHtmlBreaks';
import ButtonCopy from './ButtonCopy';
import useRagFile from '../hooks/useRagFile';
import { PiSpinnerGap } from 'react-icons/pi';
import useFileApi from '../hooks/useFileApi';
import 'katex/dist/katex.min.css';

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

import { MermaidWithToggle } from './Mermaid/MermaidWithToggle';
import { SvgWithToggle } from './Svg/SvgWithToggle';
import { EChartsWithToggle } from './ECharts/EChartsWithToggle';

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

// Re-export MermaidWithToggle for backward compatibility
export { MermaidWithToggle };

type Props = BaseProps & {
  children: string;
  prefix?: string;
};

const LinkRenderer = ({
  href,
  children,
  id,
}: ComponentProps<'a'> & ExtraProps) => {
  // Currently, the file download function from S3 is only used in RAG chat
  const { downloadDoc, isS3Url, downloading } = useRagFile();
  const isS3 = useMemo(() => {
    return isS3Url(href ?? '');
  }, [isS3Url, href]);

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
          id={id}
          onClick={() => {
            if (!downloading) {
              downloadDoc(
                href ?? '',
                isKnowledgeBase ? 'knowledgeBase' : 'default'
              );
            }
          }}
          className={`cursor-pointer ${downloading ? 'text-gray-400' : ''}`}>
          {children}
          {downloading && (
            <PiSpinnerGap className="mx-2 inline-block animate-spin" />
          )}
        </a>
      ) : (
        <a
          id={id}
          href={href}
          target={href?.startsWith('#') ? '_self' : '_blank'}
          rel="noreferrer">
          {children}
        </a>
      )}
    </>
  );
};

const ImageRenderer = ({
  src: srcProp,
  id,
}: ComponentProps<'img'> & ExtraProps) => {
  const { t } = useTranslation();
  const { isS3Url } = useRagFile();
  const { getFileDownloadSignedUrl } = useFileApi();
  const [src, setSrc] = useState(srcProp);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isS3Url(srcProp ?? '')) {
      getFileDownloadSignedUrl(srcProp ?? '')
        .then((url) => setSrc(url))
        .catch((e: Error) => setError(e.message));
    }
  }, [getFileDownloadSignedUrl, isS3Url, srcProp]);

  if (error) {
    return (
      <span className="text-red-500">{t('image.load_error', { error })}</span>
    );
  }
  return <img id={id} src={src} />;
};

// PreRenderer to skip <pre> tag for mermaid and SVG code blocks
// This prevents the dark prose background from appearing around these diagrams
const PreRenderer = ({
  children,
  ...rest
}: ComponentProps<'pre'> & ExtraProps) => {
  // Check if children is a code element with 'language-mermaid' or SVG-related class
  if (React.isValidElement(children)) {
    const childProps = children.props as {
      className?: string;
      children?: string;
    };
    const className = childProps?.className || '';
    const codeContent = String(childProps?.children || '').trim();

    // Skip <pre> tag for mermaid
    if (className.includes('language-mermaid')) {
      return <>{children}</>;
    }

    // Skip <pre> tag for chart (ECharts)
    if (className.includes('language-chart')) {
      return <>{children}</>;
    }

    // Skip <pre> tag for SVG (when language is svg, or xml/html with SVG content)
    if (
      className.includes('language-svg') ||
      ((className.includes('language-xml') ||
        className.includes('language-html')) &&
        (codeContent.startsWith('<svg') || codeContent.startsWith('<?xml')))
    ) {
      return <>{children}</>;
    }
  }

  // For other code blocks, render normal <pre> tag
  return <pre {...rest}>{children}</pre>;
};

// Helper function to check if code is SVG
const isSvgCode = (code: string): boolean => {
  const trimmed = code.trim();
  return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml');
};

const CodeRenderer = memo(
  ({
    className,
    children,
  }: React.ComponentPropsWithoutRef<'code'> & ExtraProps) => {
    const language = /language-(\w+)/.exec(className || '')?.[1];
    const codeText = String(children).replace(/\n$/, '');
    const isCodeBlock = codeText.includes('\n');

    // Render Mermaid diagrams with toggle
    // Use not-prose to prevent prose styles from affecting the diagram container
    if (language === 'mermaid') {
      return <MermaidWithToggle code={codeText} />;
    }

    // Render SVG code with toggle (when language is svg, xml, or html and content is SVG)
    const isSvgLanguage =
      language === 'svg' ||
      ((language === 'xml' || language === 'html') && isSvgCode(codeText));
    if (isSvgLanguage) {
      return <SvgWithToggle code={codeText} />;
    }

    // Render ECharts charts with toggle
    if (language === 'chart') {
      return <EChartsWithToggle code={codeText} />;
    }

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
      remarkPlugins={[remarkGfm, remarkBreaks, remarkMath, remarkHtmlBreaks]}
      rehypePlugins={[rehypeKatex]}
      remarkRehypeOptions={{ clobberPrefix: prefix }}
      components={{
        a: LinkRenderer,
        img: ImageRenderer,
        sup: ({ children }) => (
          <sup className="m-0.5 rounded-full bg-gray-200 px-1">{children}</sup>
        ),
        pre: PreRenderer,
        code: CodeRenderer,
      }}
    />
  );
});

export default Markdown;
