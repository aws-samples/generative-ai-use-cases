import {
  DocumentFormat,
  ImageFormat,
  VideoFormat,
} from '@aws-sdk/client-bedrock-runtime';
import { SupportedMimeType } from '@generative-ai-use-cases/common';

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
