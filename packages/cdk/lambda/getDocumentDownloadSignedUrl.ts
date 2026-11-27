import { Request, Response } from 'express';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';
import {
  DocumentSource,
  METADATA_SUFFIX,
  S3ObjectLocation,
  UnsupportedFilterError,
  evaluateFilters,
  findDocumentSource,
  parseDocumentMetadata,
  unsupportedFilterOperators,
} from '@generative-ai-use-cases/common';
import { initKnowledgeBaseS3Client } from './utils/bedrockClient';
import { callerRetrievalFilters } from './utils/request';
import { idTokenFromRequest, sendJson, sendText } from './utils/http';

const MODEL_REGION = process.env.MODEL_REGION as string;
const UNSUPPORTED_OPERATORS = unsupportedFilterOperators(
  process.env.KNOWLEDGE_BASE_STORAGE_TYPE
);
const DOWNLOAD_URL_TTL_SECONDS = 60;

/**
 * Download URLs for documents cited in an answer (a Knowledge Base or Kendra
 * source), served by `GET /file/url` for locations outside the file bucket.
 *
 * The location must be in one of the sources GenU created (bucket + prefix,
 * `DOCUMENT_SOURCES` from CDK). Documents of a Knowledge Base or Kendra index
 * GenU did not create are not served. For a Knowledge Base document the retrieval
 * filters that apply to the caller must also hold for the document's
 * metadata, the same check retrieval applies. When filters apply and the
 * document has no readable metadata file, or a filter cannot be evaluated,
 * the answer is 403.
 */

const configuredSources = (): DocumentSource[] => {
  try {
    const parsed = JSON.parse(process.env.DOCUMENT_SOURCES || '[]');
    return Array.isArray(parsed) ? (parsed as DocumentSource[]) : [];
  } catch {
    return [];
  }
};

const readMetadata = async (
  client: S3Client,
  location: S3ObjectLocation
): Promise<unknown | null> => {
  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: location.bucket,
        Key: `${location.key}${METADATA_SUFFIX}`,
      })
    );
    return JSON.parse(await res.Body!.transformToString());
  } catch (error) {
    if (error instanceof NoSuchKey || error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
};

/** True when the caller's Knowledge Base filters allow the document. */
const knowledgeBaseAllows = async (
  request: Request,
  client: S3Client,
  location: S3ObjectLocation
): Promise<boolean> => {
  const filters = await callerRetrievalFilters(idTokenFromRequest(request));
  if (filters === null) return false;
  if (filters.length === 0) return true;

  const raw = await readMetadata(client, location);
  if (raw === null) return false;
  try {
    return evaluateFilters(filters, parseDocumentMetadata(raw), {
      unsupportedOperators: UNSUPPORTED_OPERATORS,
    });
  } catch (error) {
    if (error instanceof UnsupportedFilterError) {
      console.error('Knowledge Base filter cannot be evaluated:', error);
      return false;
    }
    throw error;
  }
};

/** The `GET /file/url` answer for a location outside the file bucket. */
export const sendDocumentDownloadUrl = async (
  request: Request,
  response: Response,
  location: S3ObjectLocation
): Promise<void> => {
  const source = findDocumentSource(configuredSources(), location);
  if (source === null) {
    return sendJson(response, 403, { message: 'Forbidden' });
  }

  let client: S3Client;
  if (source.kind === 'knowledgeBase') {
    // The Knowledge Base may keep its documents in a different account.
    client = await initKnowledgeBaseS3Client({
      region: location.region ?? MODEL_REGION,
    });
    if (!(await knowledgeBaseAllows(request, client, location))) {
      return sendJson(response, 403, { message: 'Forbidden' });
    }
  } else {
    client = new S3Client({ region: location.region });
  }

  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: location.bucket, Key: location.key }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
  );
  return sendText(response, 200, signedUrl);
};
