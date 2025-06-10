import {
  DocumentFormat,
  ImageFormat,
  VideoFormat,
} from '@aws-sdk/client-bedrock-runtime';
import {
  extensionToMimeType,
  SupportedMimeType,
} from '@generative-ai-use-cases/common';

const SupportedFormat = {
  ...DocumentFormat,
  ...ImageFormat,
  ...VideoFormat,
};
type SupportedFormatKey = keyof typeof SupportedFormat;
type SupportedFormat = (typeof SupportedFormat)[SupportedFormatKey];

const mimeTypeToFormat: Record<SupportedMimeType, SupportedFormat> =
  Object.fromEntries(
    Object.entries(SupportedMimeType).map(([key, mimeType]) => [
      mimeType,
      SupportedFormat[key as SupportedFormatKey],
    ])
  ) as Record<SupportedMimeType, SupportedFormat>;

export const getFormatFromMimeType = (mimeType: string) => {
  if (mimeType in mimeTypeToFormat) {
    return mimeTypeToFormat[mimeType as SupportedMimeType];
  }
  throw new Error(`Unsupported MIME type: ${mimeType}`);
};

export const getMimeTypeFromFileName = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (extension in extensionToMimeType) {
    return extensionToMimeType[extension];
  }
  throw new Error(`Unsupported file extension: ${fileName}`);
};
