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

export const documentMimeTypeToExtensions: Record<DocumentMimeType, string[]> =
  {
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

// Image
// https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ImageBlock.html
export const ImageMimeType = {
  PNG: 'image/png',
  JPEG: 'image/jpeg',
  GIF: 'image/gif',
  WEBP: 'image/webp',
} as const;
export type ImageMimeType = (typeof ImageMimeType)[keyof typeof ImageMimeType];

export const imageMimeTypeToExtensions: Record<ImageMimeType, string[]> = {
  [ImageMimeType.PNG]: ['png'],
  [ImageMimeType.JPEG]: ['jpeg', 'jpg'],
  [ImageMimeType.GIF]: ['gif'],
  [ImageMimeType.WEBP]: ['webp'],
};

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

export const videoMimeTypeToExtensions: Record<VideoMimeType, string[]> = {
  [VideoMimeType.MKV]: ['mkv'],
  [VideoMimeType.MOV]: ['mov'],
  [VideoMimeType.MP4]: ['mp4'],
  [VideoMimeType.WEBM]: ['webm'],
  [VideoMimeType.FLV]: ['flv'],
  [VideoMimeType.MPEG]: ['mpeg', 'mpg'],
  [VideoMimeType.WMV]: [], // We don't support WMV as 'file-type' doesn't support it
  [VideoMimeType.THREE_GP]: ['3gp'],
};

// Supported MIME types for documents, images, and videos
export const SupportedMimeType = {
  ...DocumentMimeType,
  ...ImageMimeType,
  ...VideoMimeType,
} as const;
export type SupportedMimeType =
  (typeof SupportedMimeType)[keyof typeof SupportedMimeType];

export const mimeTypeToExtensions: Record<SupportedMimeType, string[]> = {
  ...documentMimeTypeToExtensions,
  ...imageMimeTypeToExtensions,
  ...videoMimeTypeToExtensions,
};
