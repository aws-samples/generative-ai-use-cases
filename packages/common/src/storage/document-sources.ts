import { S3ObjectLocation, isNormalizedKey } from './file-keys';

/**
 * Buckets that hold documents shown to every signed-in user, as opposed to
 * per-user files:
 * - `knowledgeBase`: a Knowledge Base data source. Retrieval filters may hide
 *   documents from some users, so the caller must also evaluate them.
 * - `kendra`: the Kendra data source. Every user can search every document.
 *
 * Files agents write for their answers are per-user files
 * (`users/<sub>/agent-outputs/...`), not documents.
 *
 * `prefix` limits the source to keys under it (`''` is the whole bucket).
 */
export type DocumentSourceKind = 'knowledgeBase' | 'kendra';

export type DocumentSource = {
  kind: DocumentSourceKind;
  bucket: string;
  prefix: string;
};

/** Metadata sidecar of a Knowledge Base document (`<key>.metadata.json`). */
export const METADATA_SUFFIX = '.metadata.json';

/**
 * The source a location belongs to, or null when it is in none of them.
 * Metadata sidecars are never a document: they describe who may read one.
 */
export const findDocumentSource = (
  sources: DocumentSource[],
  location: S3ObjectLocation
): DocumentSource | null => {
  if (
    !isNormalizedKey(location.key) ||
    location.key.toLowerCase().endsWith(METADATA_SUFFIX)
  ) {
    return null;
  }
  const matches = sources.filter(
    (source) =>
      source.bucket === location.bucket &&
      location.key.startsWith(source.prefix)
  );
  // When sources overlap, the Knowledge Base one wins: its filters must be
  // checked, and a Kendra source covering the same keys must not skip them.
  return (
    matches.find((source) => source.kind === 'knowledgeBase') ??
    matches[0] ??
    null
  );
};
