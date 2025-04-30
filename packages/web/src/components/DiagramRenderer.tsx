import React, { useEffect, useState, useCallback } from 'react';
import { IoIosClose, IoMdDownload } from 'react-icons/io';
import { VscCode } from 'react-icons/vsc';
import { LuNetwork } from 'react-icons/lu';
import EditableMarkdown from './EditableMarkdown';
import Button from './Button';
import mermaid, { MermaidConfig } from 'mermaid';
import { TbSvg, TbPng } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';

const defaultConfig: MermaidConfig = {
  // Prevent syntax error from being added to the dom node
  // https://github.com/mermaid-js/mermaid/pull/4359
  suppressErrorRendering: true,
  securityLevel: 'loose', // Allow SVG rendering
  fontFamily: 'monospace', // Specify the font family
  fontSize: 16, // Specify the font size
  htmlLabels: true, // Allow HTML labels
};
mermaid.initialize(defaultConfig);
interface MermaidProps {
  code: string;
  handler?: () => void;
}

export const Mermaid: React.FC<MermaidProps> = (props) => {
  const { t } = useTranslation();
  const { code } = props;
  const [svgContent, setSvgContent] = useState<string>('');

  const render = useCallback(async () => {
    if (code) {
      try {
        // It is necessary to specify a unique ID
        const { svg } = await mermaid.render(`m${crypto.randomUUID()}`, code);
        // Parse the SVG string to convert it to a DOM object
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const svgElement = doc.querySelector('svg');

        if (svgElement) {
          // Set the necessary attributes to the SVG element
          svgElement.setAttribute('width', '100%');
          svgElement.setAttribute('height', '100%');
          setSvgContent(svgElement.outerHTML);
        }
      } catch (error) {
        console.error(error);
        setSvgContent(`<div>${t('diagram.invalid_syntax')}</div>`);
      }
    }
  }, [code, t]);

  useEffect(() => {
    render();
  }, [code, render]);

  return code ? (
    <div
      onClick={props.handler}
      className="flex h-full w-full cursor-pointer content-center items-center justify-center rounded-lg bg-white p-8 duration-700 hover:shadow-lg">
      <div
        className="flex h-full w-full items-center justify-center"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  ) : null;
};

interface DiagramRendererProps {
  code: string;
  handleMarkdownChange: (markdown: string) => void;
}

const DiagramRenderer: React.FC<DiagramRendererProps> = ({
  code,
  handleMarkdownChange,
}) => {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'diagram' | 'code'>('diagram');

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setZoom(false);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const downloadAsSVG = async () => {
    try {
      const { svg } = await mermaid.render('download-svg', code);
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
  };

  const downloadAsPNG = async () => {
    try {
      const { svg } = await mermaid.render('download-png', code);
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
      const height = Math.max(svgElement.height.baseVal.value || 0, viewBox[3]);

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
  };

  const DownloadButton: React.FC<{ type: 'SVG' | 'PNG' }> = ({ type }) => {
    return (
      <Button
        outlined
        onClick={type === 'SVG' ? downloadAsSVG : downloadAsPNG}
        title={
          type === 'SVG'
            ? t('diagram.download_as_svg')
            : t('diagram.download_as_png')
        }
        className="cursor-pointer">
        <IoMdDownload className="text-base" />
        {type === 'SVG' ? (
          <TbSvg className="text-2xl" />
        ) : (
          <TbPng className="text-2xl" />
        )}
      </Button>
    );
  };

  return (
    <div className="relative flex flex-col">
      {/* The header above the diagram */}
      <div className="mb-[12px] flex flex-row justify-between gap-1">
        <div className="flex gap-1">
          <DownloadButton type="SVG" />
          <DownloadButton type="PNG" />
        </div>
        <div className="flex cursor-pointer rounded border bg-white text-xs font-bold">
          <div
            className={`m-1 mr-0 flex items-center rounded p-1
              ${viewMode === 'diagram' ? 'bg-gray-600 text-white' : 'text-gray-600'}`}
            onClick={() => setViewMode('diagram')}>
            <LuNetwork className="mr-1 text-lg" />
            {t('diagram.show_diagram')}
          </div>
          <div
            className={`m-1 ml-0 flex items-center rounded p-1
              ${viewMode === 'code' ? 'bg-gray-600 text-white' : 'text-gray-600'}`}
            onClick={() => setViewMode('code')}>
            <VscCode className="mr-1 text-lg" />
            {t('diagram.show_code')}
          </div>
        </div>
      </div>

      {/* The drawing part of the diagram */}
      <div className="relative">
        <div
          className={`${viewMode === 'diagram' ? 'visible opacity-100' : 'invisible absolute left-0 top-0 opacity-0'}`}>
          <Mermaid code={code} handler={() => setZoom(true)} />
        </div>
        <div
          className={`${viewMode === 'code' ? 'visible opacity-100' : 'invisible absolute left-0 top-0 opacity-0'}`}>
          <EditableMarkdown
            code={code}
            handleMarkdownChange={handleMarkdownChange}
          />
        </div>
      </div>

      {/* When zooming */}
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
              <Mermaid code={code} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DiagramRenderer;
