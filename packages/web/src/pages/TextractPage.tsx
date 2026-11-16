import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import copy from 'copy-to-clipboard';
import axios from 'axios';
import { DetectDocumentTextResponse } from 'generative-ai-use-cases';
import {
  PiClipboard,
  PiCheck,
  PiDownloadSimple,
  PiFileArrowUp,
} from 'react-icons/pi';
import Card from '../components/Card';
import Button from '../components/Button';
import Alert from '../components/Alert';
import useFileApi from '../hooks/useFileApi';
import useTextractApi from '../hooks/useTextractApi';
import {
  TEXTRACT_ACCEPT,
  TEXTRACT_MAX_FILE_SIZE,
  TextractView,
  getKeyFromSignedUrl,
  isPreviewableImage,
  isSupportedExtension,
  toCsv,
  toFullText,
  toPixelBox,
  toRows,
} from '../utils/TextractUtils';

type Status = 'idle' | 'uploading' | 'detecting' | 'done' | 'error';

const downloadFile = (fileName: string, mimeType: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

const formatRatio = (n: number) => n.toFixed(4);

const TextractPage: React.FC = () => {
  const { t } = useTranslation();
  const { getSignedUrl, uploadFile } = useFileApi();
  const { detectDocumentText } = useTextractApi();

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<DetectDocumentTextResponse | null>(null);
  const [view, setView] = useState<TextractView>('lines');
  const [minConfidence, setMinConfidence] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  // The preview is only available for images (JPEG / PNG)
  const hasPreview = !!file && !!previewUrl;
  const loading = status === 'uploading' || status === 'detecting';

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectFile = useCallback(
    (f: File | null) => {
      setResult(null);
      setNaturalSize(null);
      setHoveredId(null);
      setPreviewUrl(null);
      if (!f) {
        setFile(null);
        setStatus('idle');
        setErrorMessage('');
        return;
      }
      if (!isSupportedExtension(f.name)) {
        setFile(null);
        setStatus('error');
        setErrorMessage(t('textract.error_unsupported_type'));
        return;
      }
      if (f.size > TEXTRACT_MAX_FILE_SIZE) {
        setFile(null);
        setStatus('error');
        setErrorMessage(
          t('textract.error_too_large', {
            size: TEXTRACT_MAX_FILE_SIZE / 1024 / 1024,
          })
        );
        return;
      }
      setFile(f);
      setStatus('idle');
      setErrorMessage('');
      if (isPreviewableImage(f.name)) {
        setPreviewUrl(URL.createObjectURL(f));
      }
    },
    [t]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      selectFile(e.dataTransfer.files?.[0] ?? null);
    },
    [selectFile]
  );

  const run = useCallback(async () => {
    if (!file) return;
    setResult(null);
    setErrorMessage('');
    setStatus('uploading');
    try {
      // Upload with the shared presigned URL flow. The Lambda deletes the object after detection.
      const signedUrl = (
        await getSignedUrl({
          filename: file.name,
          mediaFormat: file.name.split('.').pop() ?? '',
        })
      ).data;
      await uploadFile(signedUrl, { file });
      setStatus('detecting');
      const res = await detectDocumentText({
        fileName: getKeyFromSignedUrl(signedUrl),
      });
      setResult(res);
      setStatus('done');
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? (e.response?.data as { message?: string } | undefined)?.message
        : undefined;
      setErrorMessage(message ?? t('textract.error_failed'));
      setStatus('error');
    }
  }, [file, getSignedUrl, uploadFile, detectDocumentText, t]);

  const clear = useCallback(() => {
    selectFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }, [selectFile]);

  const rows = useMemo(
    () => (result ? toRows(result, view, minConfidence) : []),
    [result, view, minConfidence]
  );
  const fullText = useMemo(
    () => (result ? toFullText(result, minConfidence) : ''),
    [result, minConfidence]
  );
  const pixelSize = hasPreview ? naturalSize : null;

  const baseName = file?.name.replace(/\.[^.]+$/, '') ?? 'textract';

  return (
    <div className="grid grid-cols-12">
      <div className="invisible col-span-12 my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('textract.title')}
      </div>
      <div className="col-span-12 col-start-1 mx-2 lg:col-span-10 lg:col-start-2 xl:col-span-10 xl:col-start-2">
        <Card>
          <div className="mb-2 text-sm text-gray-500">
            {t('textract.description')}
          </div>
          <div
            className={`rounded-lg border-2 border-dashed p-4 ${
              dragging ? 'border-aws-smile bg-gray-50' : 'border-gray-300'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}>
            <div className="flex items-center">
              <PiFileArrowUp className="mr-2 text-2xl" aria-hidden="true" />
              <label className="font-bold" htmlFor="textract_file_input">
                {t('textract.file_upload')}
              </label>
            </div>
            <input
              ref={inputRef}
              id="textract_file_input"
              type="file"
              accept={TEXTRACT_ACCEPT}
              className="mt-2 block w-full cursor-pointer rounded-lg border border-gray-300 text-sm text-gray-900 file:mr-4 file:cursor-pointer file:border-0 file:bg-gray-500 file:px-4 file:py-2.5 file:text-white focus:outline-none"
              aria-describedby="textract_file_help"
              onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
            />
            <p id="textract_file_help" className="mt-1 text-sm text-gray-500">
              {t('textract.supported_files', {
                size: TEXTRACT_MAX_FILE_SIZE / 1024 / 1024,
              })}
            </p>
            <p className="text-sm text-gray-500">{t('textract.drop_hint')}</p>
            {file && (
              <p className="mt-2 text-sm">
                {t('textract.selected_file', { name: file.name })}
              </p>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button disabled={!file} loading={loading} onClick={run}>
              {status === 'uploading'
                ? t('textract.uploading')
                : status === 'detecting'
                  ? t('textract.detecting')
                  : t('textract.run')}
            </Button>
            <Button outlined disabled={loading || !file} onClick={clear}>
              {t('textract.clear')}
            </Button>
          </div>

          <div aria-live="polite">
            {status === 'error' && errorMessage && (
              <Alert
                className="mt-3"
                severity="error"
                title={t('textract.error_title')}>
                {errorMessage}
              </Alert>
            )}
          </div>
        </Card>

        {(file || result) && (
          <div className="mt-4 flex flex-col gap-4 lg:flex-row">
            {file && (
              <Card
                className="min-w-0 lg:basis-2/5"
                label={t('textract.preview_title')}>
                {hasPreview ? (
                  <div className="relative mt-2 inline-block max-w-full">
                    <img
                      src={previewUrl ?? undefined}
                      alt={t('textract.preview_alt', { name: file.name })}
                      className="block max-h-[70vh] max-w-full"
                      onLoad={(e) =>
                        setNaturalSize({
                          width: e.currentTarget.naturalWidth,
                          height: e.currentTarget.naturalHeight,
                        })
                      }
                    />
                    {result && (
                      // Decorative: the same information is available in the table
                      <svg
                        className="absolute inset-0 h-full w-full"
                        viewBox="0 0 1 1"
                        preserveAspectRatio="none"
                        aria-hidden="true">
                        {rows
                          .filter((row) => row.page === 1)
                          .map((row) => {
                            const active = hoveredId === row.id;
                            return (
                              <rect
                                key={row.id}
                                x={row.boundingBox.left}
                                y={row.boundingBox.top}
                                width={row.boundingBox.width}
                                height={row.boundingBox.height}
                                fill={
                                  active
                                    ? 'rgba(255, 153, 0, 0.35)'
                                    : 'rgba(37, 99, 235, 0.08)'
                                }
                                stroke={active ? '#ff9900' : '#2563eb'}
                                strokeWidth={active ? 3 : 1.5}
                                vectorEffect="non-scaling-stroke"
                                onMouseEnter={() => setHoveredId(row.id)}
                                onMouseLeave={() => setHoveredId(null)}
                              />
                            );
                          })}
                      </svg>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">
                    {t('textract.overlay_unavailable')}
                  </p>
                )}
              </Card>
            )}

            {result && (
              <Card
                className={file ? 'min-w-0 lg:basis-3/5' : 'w-full'}
                label={t('textract.results_title')}>
                <p className="mt-1 text-sm text-gray-500">
                  {t('textract.region_used', { region: result.region })}
                </p>

                <div className="mt-3 flex flex-wrap items-end gap-4">
                  <div>
                    <label
                      className="block text-sm"
                      htmlFor="textract_view_select">
                      {t('textract.view_label')}
                    </label>
                    <select
                      id="textract_view_select"
                      className="min-w-32 rounded border border-black/30 bg-white py-1.5 pl-2 pr-10 focus:outline-none"
                      value={view}
                      onChange={(e) => {
                        setView(e.target.value as TextractView);
                        setHoveredId(null);
                      }}>
                      <option value="lines">{t('textract.view_lines')}</option>
                      <option value="words">{t('textract.view_words')}</option>
                    </select>
                  </div>
                  <div className="w-56 max-w-full">
                    <label
                      className="block whitespace-nowrap text-sm"
                      htmlFor="textract_min_confidence">
                      {t('textract.min_confidence', { value: minConfidence })}
                    </label>
                    <input
                      id="textract_min_confidence"
                      type="range"
                      className="h-1 w-full cursor-pointer"
                      min={0}
                      max={100}
                      step={1}
                      value={minConfidence}
                      onChange={(e) =>
                        setMinConfidence(Number.parseInt(e.target.value, 10))
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    outlined
                    disabled={!fullText}
                    onClick={() => {
                      copy(fullText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 3000);
                    }}>
                    {copied ? (
                      <PiCheck className="mr-1" aria-hidden="true" />
                    ) : (
                      <PiClipboard className="mr-1" aria-hidden="true" />
                    )}
                    {t('textract.copy_text')}
                  </Button>
                  <Button
                    outlined
                    onClick={() =>
                      downloadFile(
                        `${baseName}.json`,
                        'application/json',
                        JSON.stringify(result, null, 2)
                      )
                    }>
                    <PiDownloadSimple className="mr-1" aria-hidden="true" />
                    {t('textract.download_json')}
                  </Button>
                  <Button
                    outlined
                    onClick={() =>
                      downloadFile(
                        `${baseName}.csv`,
                        'text/csv;charset=utf-8',
                        toCsv(rows, pixelSize)
                      )
                    }>
                    <PiDownloadSimple className="mr-1" aria-hidden="true" />
                    {t('textract.download_csv')}
                  </Button>
                </div>

                <div className="mt-4">
                  <label
                    className="block text-sm font-semibold"
                    htmlFor="textract_full_text">
                    {t('textract.full_text')}
                  </label>
                  <textarea
                    id="textract_full_text"
                    readOnly
                    className="mt-1 h-32 w-full rounded border border-black/30 p-2 text-sm"
                    value={fullText}
                  />
                </div>

                {rows.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">
                    {t('textract.no_results')}
                  </p>
                ) : (
                  <div className="mt-4 max-h-[60vh] overflow-auto">
                    <table className="w-max min-w-full text-left text-sm">
                      <caption className="mb-1 text-left text-sm text-gray-500">
                        {t('textract.table_caption', { count: rows.length })}
                      </caption>
                      <thead className="sticky top-0 bg-gray-100">
                        <tr>
                          <th scope="col" className="p-1">
                            <div className="min-w-64 max-w-sm">
                              {t('textract.col_text')}
                            </div>
                          </th>
                          <th
                            scope="col"
                            className="whitespace-nowrap p-1 text-xs">
                            {t('textract.col_confidence')}
                          </th>
                          <th
                            scope="col"
                            className="whitespace-nowrap p-1 text-xs">
                            {t('textract.col_box')}
                          </th>
                          {pixelSize && (
                            <th
                              scope="col"
                              className="whitespace-nowrap p-1 text-xs">
                              {t('textract.col_box_px')}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const b = row.boundingBox;
                          const px = pixelSize
                            ? toPixelBox(b, pixelSize.width, pixelSize.height)
                            : null;
                          return (
                            <tr
                              key={row.id}
                              className={`border-t ${
                                hoveredId === row.id ? 'bg-orange-100' : ''
                              }`}
                              onMouseEnter={() => setHoveredId(row.id)}
                              onMouseLeave={() => setHoveredId(null)}>
                              <td className="p-1">
                                <div className="min-w-64 max-w-sm break-words">
                                  {row.text}
                                </div>
                              </td>
                              <td className="whitespace-nowrap p-1 text-xs tabular-nums">
                                {row.confidence.toFixed(2)}
                              </td>
                              <td className="whitespace-nowrap p-1 text-xs tabular-nums">
                                {[b.left, b.top, b.width, b.height]
                                  .map(formatRatio)
                                  .join(', ')}
                              </td>
                              {px && (
                                <td className="whitespace-nowrap p-1 text-xs tabular-nums">
                                  {[px.left, px.top, px.width, px.height].join(
                                    ', '
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TextractPage;
