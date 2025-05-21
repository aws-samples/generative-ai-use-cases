// Document
// https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_DocumentBlock.html
export const DocumentMimeType = {
  PDF: 'application/pdf',
  CSV: 'text/csv',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLS: 'application/vnd.ms-excel',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  HTML: 'text/html',
  TXT: 'text/plain',
  MD: 'text/markdown',
} as const;
export type DocumentMimeType =
  (typeof DocumentMimeType)[keyof typeof DocumentMimeType];

// Image
// https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ImageBlock.html
export const ImageMimeType = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  WEBP: 'image/webp',
} as const;
export type ImageMimeType = (typeof ImageMimeType)[keyof typeof ImageMimeType];

// Video
// https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_VideoBlock.html
export const VideoMimeType = {
  MKV: 'video/x-matroska',
  MOV: 'video/quicktime',
  MP4: 'video/mp4',
  WEBM: 'video/webm',
  FLV: 'video/x-flv',
  MPEG: 'video/mpeg',
  WMV: 'video/x-ms-wmv',
  THREE_GP: 'video/3gpp',
} as const;
export type VideoMimeType = (typeof VideoMimeType)[keyof typeof VideoMimeType];

// Supported MIME types for documents, images, and videos
export const SupportedMimeType = {
  ...DocumentMimeType,
  ...ImageMimeType,
  ...VideoMimeType,
} as const;
export type SupportedMimeType =
  (typeof SupportedMimeType)[keyof typeof SupportedMimeType];
