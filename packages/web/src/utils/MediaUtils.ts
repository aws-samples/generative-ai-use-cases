import {
  ImageMimeType,
  VideoMimeType,
  SupportedMimeType,
  documentMimeTypeToExtensions,
  imageMimeTypeToExtensions,
  videoMimeTypeToExtensions,
  mimeTypeToExtensions,
} from '@generative-ai-use-cases/common';
import { fileTypeFromBuffer, fileTypeFromStream } from 'file-type';

// Sets of supported MIME types
const imageMimeTypeSet = new Set(Object.values(ImageMimeType));
const videoMimeTypeSet = new Set(Object.values(VideoMimeType));

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
    console.error('Error reading MIME type from stream:', error);
    try {
      const arrayBuffer = await file.slice(0, 4096).arrayBuffer(); // Only read the first 4KB
      mimeType = (await fileTypeFromBuffer(arrayBuffer))?.mime;
    } catch (error) {
      console.error('Error reading MIME type from buffer:', error);
      throw new Error('Error reading MIME type from file');
    }
  }
  // Some file types are not supported by the file-type library.
  // In this case, we fall back to using 'file.type' for the MIME type, since the file-type library covers most binary file types.
  // https://github.com/sindresorhus/file-type/tree/main?tab=readme-ov-file#supported-file-types
  if (!mimeType || mimeType === 'application/x-cfb') {
    mimeType = file.type;
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
export const getFileTypeFromMimeType = (mimeType: SupportedMimeType) => {
  if (imageMimeTypeSet.has(mimeType as ImageMimeType)) return 'image';
  if (videoMimeTypeSet.has(mimeType as VideoMimeType)) return 'video';
  return 'file';
};

// Validate if MIME type and extension are compatible
export const validateMimeTypeAndExtension = (
  mimeType: SupportedMimeType,
  extension: string
) => {
  if (mimeType in mimeTypeToExtensions) {
    const extensions = mimeTypeToExtensions[mimeType as SupportedMimeType];
    const ext = extension.startsWith('.') ? extension.slice(1) : extension;
    return extensions.includes(ext.toLowerCase()) || false;
  }
  return false; // MIME type is not supported
};
