import React, { useEffect, useState, memo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { VscCode } from 'react-icons/vsc';
import { LuNetwork } from 'react-icons/lu';
import { IoIosClose, IoMdDownload } from 'react-icons/io';
import { TbSvg, TbPng } from 'react-icons/tb';
import mermaid, { MermaidConfig } from 'mermaid';
import { v4 as uuidv4 } from 'uuid';

import ButtonCopy from '../ButtonCopy';
import Button from '../Button';
import Textarea from '../Textarea';
import { svgToDataUrl } from '../../utils/svgDataUrl';

import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Initialize mermaid with default config
const defaultMermaidConfig: MermaidConfig = {
  suppressErrorRendering: true,
  // Diagrams come from model output, which other content can steer: HTML in
  // labels is encoded and click handlers are disabled.
  securityLevel: 'strict',
  // Settings a diagram's own frontmatter or %%{init}%% may not change. The
  // first six are mermaid's defaults; themeCSS would let a diagram bring its
  // own stylesheet.
  secure: [
    'secure',
    'securityLevel',
    'startOnLoad',
    'maxTextSize',
    'suppressErrorRendering',
    'maxEdges',
    'themeCSS',
  ],
  fontFamily: 'monospace',
  fontSize: 16,
  htmlLabels: true,
};
mermaid.initialize(defaultMermaidConfig);

// Mermaid SVG renderer component
interface MermaidProps {
  code: string;
  handler?: () => void;
}

const Mermaid: React.FC<MermaidProps> = (props) => {
  const { t } = useTranslation();
  const { code } = props;
  const [src, setSrc] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const render = useCallback(async () => {
    if (code) {
      try {
        const { svg } = await mermaid.render(`m${uuidv4()}`, code);
        // Shown as an image, not inserted into the page (see svgToDataUrl)
        const dataUrl = svgToDataUrl(svg);
        if (dataUrl) {
          setSrc(dataUrl);
          setInvalid(false);
        }
      } catch (error) {
        console.error(error);
        setSrc(null);
        setInvalid(true);
      }
    }
  }, [code]);

  useEffect(() => {
    render();
  }, [code, render]);

  return code ? (
    <div
      onClick={props.handler}
      className="flex h-full w-full cursor-pointer content-center items-center justify-center rounded-lg bg-white p-8 duration-700">
      <div className="flex h-full w-full items-center justify-center">
        {invalid ? (
          <div>{t('diagram.invalid_syntax')}</div>
        ) : (
          src && <img src={src} alt="" className="h-full w-full" />
        )}
      </div>
    </div>
  ) : null;
};

// Mermaid with toggle component (diagram/code view with download, zoom, and optional edit)
interface MermaidWithToggleProps {
  code: string;
  editable?: boolean;
  onCodeChange?: (code: string) => void;
}

export const MermaidWithToggle = memo(
  ({ code, editable = false, onCodeChange }: MermaidWithToggleProps) => {
    const { t } = useTranslation();
    // Start with 'code' view during streaming, auto-switch to 'diagram' when stable
    const [viewMode, setViewMode] = useState<'diagram' | 'code'>('code');
    const [zoom, setZoom] = useState(false);
    const [editedCode, setEditedCode] = useState(code);
    const prevCodeRef = useRef(code);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Sync editedCode when code prop changes
    useEffect(() => {
      setEditedCode(code);
    }, [code]);

    // Auto-switch to diagram view when code becomes stable (no changes for 500ms)
    useEffect(() => {
      // If code has changed
      if (code !== prevCodeRef.current) {
        prevCodeRef.current = code;

        // Clear existing timer
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        // If no changes for 500ms, consider it stable and switch to diagram
        timerRef.current = setTimeout(() => {
          setViewMode('diagram');
        }, 500);
      }

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }, [code]);

    // Handle escape key for zoom
    useEffect(() => {
      const handleEsc = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setZoom(false);
        }
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    // Download as SVG
    const downloadAsSVG = useCallback(async () => {
      try {
        const { svg } = await mermaid.render('download-svg', editedCode);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `diagram_${new Date().getTime()}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error(t('diagram.svg_error'), error);
      }
    }, [editedCode, t]);

    // Download as PNG
    const downloadAsPNG = useCallback(async () => {
      try {
        const { svg } = await mermaid.render('download-png', editedCode);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (!(svgElement instanceof SVGSVGElement)) return;

        const viewBox = svgElement
          .getAttribute('viewBox')
          ?.split(' ')
          .map(Number) || [0, 0, 0, 0];
        const width = Math.max(svgElement.width.baseVal.value || 0, viewBox[2]);
        const height = Math.max(
          svgElement.height.baseVal.value || 0,
          viewBox[3]
        );

        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;

        const wrappedSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <rect width="100%" height="100%" fill="white"/>
          ${svg}
        </svg>
      `;

        const svgBase64 = btoa(unescape(encodeURIComponent(wrappedSvg)));
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + svgBase64;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);

        const link = document.createElement('a');
        link.download = `diagram_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      } catch (error) {
        console.error(t('diagram.png_error'), error);
      }
    }, [editedCode, t]);

    // Handle code edit
    const handleCodeChange = useCallback(
      (newCode: string) => {
        setEditedCode(newCode);
        onCodeChange?.(newCode);
      },
      [onCodeChange]
    );

    return (
      <>
        <div className="my-4 rounded-lg border border-gray-200 bg-white">
          {/* Toggle header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex cursor-pointer rounded border bg-gray-50 text-xs font-bold">
                <div
                  className={`m-0.5 flex items-center rounded px-2 py-1 transition-colors
                  ${viewMode === 'diagram' ? 'bg-gray-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  onClick={() => setViewMode('diagram')}>
                  <LuNetwork className="mr-1 text-sm" />
                  {t('diagram.show_diagram')}
                </div>
                <div
                  className={`m-0.5 flex items-center rounded px-2 py-1 transition-colors
                  ${viewMode === 'code' ? 'bg-gray-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  onClick={() => setViewMode('code')}>
                  <VscCode className="mr-1 text-sm" />
                  {t('diagram.show_code')}
                </div>
              </div>

              {/* Download buttons */}
              <div className="flex gap-1">
                <Button
                  outlined
                  onClick={downloadAsSVG}
                  title={t('diagram.download_as_svg')}
                  className="cursor-pointer px-2 py-1 text-xs">
                  <IoMdDownload className="text-sm" />
                  <TbSvg className="text-lg" />
                </Button>
                <Button
                  outlined
                  onClick={downloadAsPNG}
                  title={t('diagram.download_as_png')}
                  className="cursor-pointer px-2 py-1 text-xs">
                  <IoMdDownload className="text-sm" />
                  <TbPng className="text-lg" />
                </Button>
              </div>
            </div>

            <ButtonCopy className="text-gray-400" text={editedCode} />
          </div>

          {/* Content area */}
          <div className="relative overflow-hidden">
            <div
              className={`transition-all duration-200 ${
                viewMode === 'diagram'
                  ? 'visible opacity-100'
                  : 'invisible absolute left-0 top-0 h-0 opacity-0'
              }`}>
              <Mermaid code={editedCode} handler={() => setZoom(true)} />
            </div>
            <div
              className={`transition-all duration-200 ${
                viewMode === 'code'
                  ? 'visible opacity-100'
                  : 'invisible absolute left-0 top-0 h-0 opacity-0'
              }`}>
              {editable ? (
                <div className="p-3">
                  <Textarea
                    value={editedCode}
                    onChange={handleCodeChange}
                    className="text-sm"
                    maxHeight={400}
                  />
                </div>
              ) : (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language="mermaid"
                  customStyle={{
                    margin: 0,
                    borderRadius: '0 0 0.5rem 0.5rem',
                  }}>
                  {editedCode}
                </SyntaxHighlighter>
              )}
            </div>
          </div>
        </div>

        {/* Zoom modal */}
        {zoom && (
          <>
            <div
              className="fixed inset-0 z-[100] bg-black/50"
              onClick={() => setZoom(false)}
            />
            <div
              className="fixed left-1/2 top-1/2 z-[110] flex h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex h-[40px] justify-end px-2">
                <button onClick={() => setZoom(false)}>
                  <IoIosClose className="flex h-8 w-8 cursor-pointer content-center justify-center rounded text-lg hover:bg-gray-200" />
                </button>
              </div>
              <div className="flex-1 overflow-auto px-8 pb-8">
                <Mermaid code={editedCode} />
              </div>
            </div>
          </>
        )}
      </>
    );
  }
);
