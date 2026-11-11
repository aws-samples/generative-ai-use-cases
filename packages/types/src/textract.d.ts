// Normalized (0-1) bounding box ratios relative to the page, as returned by Textract
export type TextractBoundingBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type TextractWord = {
  id: string;
  text: string;
  confidence: number;
  boundingBox: TextractBoundingBox;
};

export type TextractLine = {
  id: string;
  text: string;
  confidence: number;
  boundingBox: TextractBoundingBox;
  words: TextractWord[];
};

export type TextractPage = {
  page: number;
  lines: TextractLine[];
};

export type DetectDocumentTextRequest = {
  // S3 object key returned by the file upload flow (`<uuid>/<filename>`)
  fileName: string;
};

export type DetectDocumentTextResponse = {
  region: string;
  pages: TextractPage[];
  blockCount: number;
};
