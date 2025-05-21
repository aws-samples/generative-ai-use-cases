import {
  DocumentMimeType,
  ImageMimeType,
  VideoMimeType,
  SupportedMimeType,
} from '@generative-ai-use-cases/common';
import { fileTypeFromBuffer, fileTypeFromStream } from 'file-type';

// Map MIME types to their respective formats
const documentMimeTypeToExtensions: Record<DocumentMimeType, string[]> = {
  [DocumentMimeType.PDF]: ['pdf'],
  [DocumentMimeType.CSV]: ['csv'],
  [DocumentMimeType.DOC]: ['doc'],
  [DocumentMimeType.DOCX]: ['docx'],
  [DocumentMimeType.XLS]: ['xls'],
  [DocumentMimeType.XLSX]: ['xlsx'],
  [DocumentMimeType.HTML]: ['html'],
  [DocumentMimeType.TXT]: ['txt'],
  [DocumentMimeType.MD]: ['md'],
};
const imageMimeTypeToExtensions: Record<ImageMimeType, string[]> = {
  [ImageMimeType.PNG]: ['png'],
  [ImageMimeType.JPEG]: ['jpeg', 'jpg'],
  [ImageMimeType.GIF]: ['gif'],
  [ImageMimeType.WEBP]: ['webp'],
};
const videoMimeTypeToExtensions: Record<VideoMimeType, string[]> = {
  [VideoMimeType.MKV]: ['mkv'],
  [VideoMimeType.MOV]: ['mov'],
  [VideoMimeType.MP4]: ['mp4'],
  [VideoMimeType.WEBM]: ['webm'],
  [VideoMimeType.FLV]: ['flv'],
  [VideoMimeType.MPEG]: ['mpeg', 'mpg'],
  [VideoMimeType.WMV]: [], // We don't support WMV as 'file-type' doesn't support it
  [VideoMimeType.THREE_GP]: ['3gp'],
};
const mimeTypeToExtensions: Record<SupportedMimeType, string[]> = {
  ...documentMimeTypeToExtensions,
  ...imageMimeTypeToExtensions,
  ...videoMimeTypeToExtensions,
};

// Sets of supported MIME types
const imageMimeTypeSet = new Set(Object.values(ImageMimeType));
const videoMimeTypeSet = new Set(Object.values(VideoMimeType));

// Some MIME types are not accepted by file-type
const unparsableMimeTypeSet = new Set<SupportedMimeType>([
  'application/msword',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
  'text/html',
  'text/markdown',
]);

// Some MIME types are not normalized, so we need to map them to their normalized types
const mimeTypeAlias: Record<string, SupportedMimeType> = {
  // mpeg
  'video/MP1S': 'video/mpeg',
  'video/MP2P': 'video/mpeg',
};

export const getMimeTypeFromFileHeader = async (file: File) => {
  // Some file types (e.g. mkv) may not be properly detected by the browser,
  // so this function detects the mime type based on the file header
  let mimeType;
  try {
    mimeType = (await fileTypeFromStream(file.stream()))?.mime;
  } catch (error) {
    const arrayBuffer = await file.slice(0, 4096).arrayBuffer(); // Only read the first 4KB
    mimeType = (await fileTypeFromBuffer(arrayBuffer))?.mime;
  }

  // Some file types are not accepted by file-type.
  if (!mimeType || mimeType === 'application/x-cfb') {
    // We accept text, doc, and xls files
    if (unparsableMimeTypeSet.has(file.type as SupportedMimeType)) {
      mimeType = file.type;
    } else {
      return ''; // Failed to detect the mime type
    }
  }
  return (mimeTypeAlias[mimeType] || mimeType) as SupportedMimeType;
};

// Accepted file extensions (preceded by '.')
const addDot = (ext: string) => `.${ext}`;
export const AcceptedDotExtensions = {
  doc: Object.values(documentMimeTypeToExtensions).flat().map(addDot),
  image: Object.values(imageMimeTypeToExtensions).flat().map(addDot),
  video: Object.values(videoMimeTypeToExtensions).flat().map(addDot),
};

// Get file type from MIME type
export const getFileTypeFromMimeType = (mimeType?: string) => {
  if (imageMimeTypeSet.has(mimeType as ImageMimeType)) return 'image';
  if (videoMimeTypeSet.has(mimeType as VideoMimeType)) return 'video';
  return 'file';
};

// Validate if MIME type and extension are compatible
export const validateMimeTypeAndExtension = (
  mimeType: string,
  extension: string
) => {
  if (mimeType in mimeTypeToExtensions) {
    const extensions = mimeTypeToExtensions[mimeType as SupportedMimeType];
    const ext = extension.startsWith('.') ? extension.slice(1) : extension;
    return extensions.includes(ext.toLowerCase()) || false;
  }
  return false; // MIME type is not supported
};
