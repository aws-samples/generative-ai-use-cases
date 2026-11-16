import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  DetectDocumentTextCommand,
  TextractClient,
} from '@aws-sdk/client-textract';
import {
  DetectDocumentTextRequest,
  DetectDocumentTextResponse,
} from 'generative-ai-use-cases';
import {
  MAX_FILE_SIZE_BYTES,
  isValidUploadedFileKey,
  mapBlocksToPages,
  validateDocument,
} from './utils/textractUtils';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const errorResponse = (
  statusCode: number,
  message: string
): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify({ message }),
});

// Map Textract errors to client-facing errors
const handleTextractError = (error: unknown): APIGatewayProxyResult => {
  const name = (error as { name?: string })?.name;
  switch (name) {
    case 'UnsupportedDocumentException':
      return errorResponse(
        400,
        'Textract could not process this document. Only JPEG, PNG, and one-page PDF/TIFF are supported (multi-page PDF/TIFF is not supported).'
      );
    case 'BadDocumentException':
      return errorResponse(
        400,
        'Textract could not read this document. The file may be corrupted or password protected.'
      );
    case 'DocumentTooLargeException':
      return errorResponse(400, 'The document is too large for Textract.');
    case 'InvalidParameterException':
      return errorResponse(400, 'The document is not valid for Textract.');
    case 'ProvisionedThroughputExceededException':
    case 'ThrottlingException':
      return errorResponse(429, 'Textract is busy. Please try again later.');
    default:
      console.log(error);
      return errorResponse(500, 'Internal Server Error');
  }
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const bucket = process.env.BUCKET_NAME;
  const region = process.env.TEXTRACT_REGION;
  const s3 = new S3Client({});
  let key: string | undefined;

  try {
    let req: Partial<DetectDocumentTextRequest>;
    try {
      req = JSON.parse(event.body ?? '{}');
    } catch {
      return errorResponse(400, 'Invalid request body.');
    }
    if (!isValidUploadedFileKey(req.fileName)) {
      return errorResponse(400, 'Invalid fileName.');
    }
    key = req.fileName;

    let bytes: Uint8Array;
    try {
      const object = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      if ((object.ContentLength ?? 0) > MAX_FILE_SIZE_BYTES) {
        return errorResponse(
          400,
          `The file is too large. The maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`
        );
      }
      bytes = (await object.Body?.transformToByteArray()) ?? new Uint8Array();
    } catch (e) {
      if ((e as { name?: string })?.name === 'NoSuchKey') {
        key = undefined; // nothing to delete
        return errorResponse(404, 'The uploaded file was not found.');
      }
      throw e;
    }

    const validation = validateDocument(key, bytes);
    if (!validation.ok) {
      return errorResponse(400, validation.message);
    }

    // Pass the document as Bytes: the S3 bucket may be in a different region from Textract
    const textract = new TextractClient({ region });
    let blocks;
    try {
      const res = await textract.send(
        new DetectDocumentTextCommand({ Document: { Bytes: bytes } })
      );
      blocks = res.Blocks ?? [];
    } catch (e) {
      return handleTextractError(e);
    }

    const body: DetectDocumentTextResponse = {
      region: region ?? '',
      pages: mapBlocksToPages(blocks),
      blockCount: blocks.length,
    };
    return { statusCode: 200, headers, body: JSON.stringify(body) };
  } catch (error) {
    console.log(error);
    return errorResponse(500, 'Internal Server Error');
  } finally {
    // The uploaded object is a temporary input: always delete it
    if (key) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch (e) {
        console.log('Failed to delete uploaded file', e);
      }
    }
  }
};
