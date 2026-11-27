import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { UploadedFileType } from 'generative-ai-use-cases';
import useFiles from '../../src/hooks/useFiles';

vi.mock('../../src/hooks/useFileApi', () => ({ default: () => ({}) }));
vi.mock('i18next', () => ({ default: { t: (key: string) => key } }));

const uploaded = (name: string): UploadedFileType => ({
  id: name,
  file: new File(['x'], name, { type: 'application/pdf' }),
  name,
  type: 'file',
  mimeType: 'application/pdf',
  s3Url: `https://bucket.s3.amazonaws.com/${name}`,
  base64EncodedData: 'data:application/pdf;base64,eA==',
  uploading: false,
  deleting: false,
  errorMessages: [],
});

describe('useFiles restore', () => {
  it('puts files cleared from the input back, as they were', () => {
    const { result } = renderHook(() => useFiles('/chat'));
    const files = [uploaded('a.pdf'), uploaded('b.pdf')];

    act(() => result.current.restore(files));
    const saved = result.current.uploadedFiles;

    // ChatPage clears the input before sending and restores it on failure
    act(() => result.current.clear());
    expect(result.current.uploadedFiles).toEqual([]);

    act(() => result.current.restore(saved));
    expect(result.current.uploadedFiles).toEqual(files);
  });

  it('only changes the input of its own page', () => {
    const chat = renderHook(() => useFiles('/chat'));
    const other = renderHook(() => useFiles('/agent'));

    act(() => other.result.current.restore([uploaded('other.pdf')]));
    act(() => chat.result.current.restore([uploaded('chat.pdf')]));

    expect(other.result.current.uploadedFiles.map((f) => f.name)).toEqual([
      'other.pdf',
    ]);
    expect(chat.result.current.uploadedFiles.map((f) => f.name)).toEqual([
      'chat.pdf',
    ]);
  });
});

describe('useFiles document count across a conversation (#1685)', () => {
  const fileLimit = {
    accept: { doc: ['.pdf'], image: ['.png'], video: [] },
    maxFileCount: 5,
    maxFileSizeMB: 4.5,
    maxImageFileCount: 20,
    maxImageFileSizeMB: 3.75,
    maxVideoFileCount: 1,
    maxVideoFileSizeMB: 1000,
  };
  const accept = ['.pdf', '.png'];
  const image = (name: string): UploadedFileType => ({
    ...uploaded(name),
    file: new File(['x'], name, { type: 'image/png' }),
    type: 'image',
    mimeType: 'image/png',
  });

  // checkFiles validates what is in the input against the given limit
  const check = async (
    files: UploadedFileType[],
    previousFileCount?: number
  ) => {
    const { result } = renderHook(() => useFiles('/chat/count'));
    act(() => result.current.restore(files));
    await act(() =>
      result.current.checkFiles({ ...fileLimit, previousFileCount }, accept)
    );
    return result.current;
  };

  it('allows 5 documents in a new chat', async () => {
    const files = ['1', '2', '3', '4', '5'].map((n) => uploaded(`${n}.pdf`));
    expect((await check(files)).errorMessages).toEqual([]);
  });

  it('counts the documents attached earlier in the chat', async () => {
    const files = ['1', '2', '3'].map((n) => uploaded(`${n}.pdf`));

    expect((await check(files, 2)).errorMessages).toEqual([]);

    const over = await check(files, 3);
    expect(over.errorMessages).toEqual(['files.error.fileCountExceededInChat']);
    // Only the documents past the limit are marked
    expect(over.uploadedFiles.map((f) => f.errorMessages.length)).toEqual([
      0, 0, 1,
    ]);
  });

  it('keeps the usual message when nothing was attached before', async () => {
    const files = ['1', '2', '3', '4', '5', '6'].map((n) =>
      uploaded(`${n}.pdf`)
    );
    expect((await check(files, 0)).errorMessages).toEqual([
      'files.error.fileCountExceeded',
    ]);
  });

  it('does not count earlier documents against images', async () => {
    expect((await check([image('a.png')], 5)).errorMessages).toEqual([]);
  });
});

describe('useFiles PDF size limit (#1334)', () => {
  const fileLimit = {
    accept: { doc: ['.pdf', '.docx'], image: ['.png'], video: [] },
    maxFileCount: 5,
    maxFileSizeMB: 4.5,
    maxPdfFileSizeMB: 20,
    maxImageFileCount: 20,
    maxImageFileSizeMB: 3.75,
    maxVideoFileCount: 1,
    maxVideoFileSizeMB: 1000,
  };
  const accept = ['.pdf', '.docx', '.png'];
  const DOCX =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const sized = (name: string, mimeType: string, mb: number) => {
    const file = new File(['x'], name, { type: mimeType });
    Object.defineProperty(file, 'size', { value: mb * 1e6 });
    return { ...uploaded(name), file, mimeType };
  };
  const check = async (
    file: UploadedFileType,
    limit: Omit<typeof fileLimit, 'maxPdfFileSizeMB'> & {
      maxPdfFileSizeMB?: number;
    }
  ) => {
    const { result } = renderHook(() => useFiles('/chat/pdf-size'));
    act(() => result.current.restore([file]));
    await act(() => result.current.checkFiles(limit, accept));
    return result.current.errorMessages;
  };

  it('allows a PDF up to its own limit', async () => {
    expect(
      await check(sized('big.pdf', 'application/pdf', 20), fileLimit)
    ).toEqual([]);
    expect(
      await check(sized('bigger.pdf', 'application/pdf', 20.1), fileLimit)
    ).toEqual(['files.error.fileSizeExceeded']);
  });

  it('keeps other documents at the document limit', async () => {
    expect(await check(sized('a.docx', DOCX, 4.5), fileLimit)).toEqual([]);
    expect(await check(sized('b.docx', DOCX, 4.6), fileLimit)).toEqual([
      'files.error.fileSizeExceeded',
    ]);
  });

  it('uses the document limit for PDFs when no PDF limit is set', async () => {
    const withoutPdfLimit = { ...fileLimit, maxPdfFileSizeMB: undefined };
    expect(
      await check(sized('c.pdf', 'application/pdf', 4.6), withoutPdfLimit)
    ).toEqual(['files.error.fileSizeExceeded']);
  });
});
