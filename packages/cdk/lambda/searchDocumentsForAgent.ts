import {
  RetrieveCommand,
  RetrievedReference,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { initBedrockAgentRuntimeClient } from './utils/bedrockClient';
import { callerRetrievalFilters, combineFilters } from './utils/request';
import {
  buildRefUrl,
  resolveDisplayTitle,
  resolveSourceUrl,
} from './utils/bedrockKbApi';

/**
 * The document search of Agent Builder agents (#1870), invoked by the
 * AgentCore runtime when an agent decides to search.
 *
 * The runtime passes the caller's id token, which it has verified too. The
 * search applies the same filters as the RAG chat (hidden static filters and
 * the user's attributes), so an agent finds only the documents its user may
 * see. Without a verified token nothing is searched.
 */

const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const MODEL_REGION = process.env.MODEL_REGION as string;
// Hybrid search needs an OpenSearch Serverless vector store
const HYBRID_SEARCH = process.env.KNOWLEDGE_BASE_HYBRID_SEARCH === 'true';

export const DEFAULT_RESULTS = 5;
export const MAX_RESULTS = 10;
// Each passage is cut to this many characters to keep the agent's context small
export const MAX_PASSAGE_CHARS = 2000;

export type SearchDocumentsEvent = {
  idToken?: string;
  query?: string;
  numberOfResults?: number;
};

export type SearchDocumentsResult =
  | {
      results: {
        title: string;
        url?: string;
        text: string;
        score?: number;
      }[];
    }
  | { error: string };

export const handler = async (
  event: SearchDocumentsEvent
): Promise<SearchDocumentsResult> => {
  const query = event?.query?.trim();
  if (!query) return { error: 'query is required' };

  const filters = await callerRetrievalFilters(event.idToken);
  if (filters === null) return { error: 'Unauthorized' };

  const numberOfResults = Math.min(
    Math.max(Math.trunc(event.numberOfResults ?? DEFAULT_RESULTS), 1),
    MAX_RESULTS
  );

  const client = await initBedrockAgentRuntimeClient({ region: MODEL_REGION });
  const res = await client.send(
    new RetrieveCommand({
      knowledgeBaseId: KNOWLEDGE_BASE_ID,
      retrievalQuery: { text: query },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults,
          ...(HYBRID_SEARCH ? { overrideSearchType: 'HYBRID' } : {}),
          filter: combineFilters(filters),
        },
      },
    })
  );

  return {
    results: (res.retrievalResults ?? []).map((result) => {
      const ref = result as RetrievedReference;
      const url = resolveSourceUrl(ref);
      const page = ref.metadata?.['x-amz-bedrock-kb-document-page-number'] as
        | string
        | number
        | undefined;
      return {
        title: url ? resolveDisplayTitle(ref, url) : 'document',
        ...(url && {
          url: buildRefUrl(
            ref,
            url,
            page === undefined ? undefined : String(page)
          ),
        }),
        text: (result.content?.text ?? '').slice(0, MAX_PASSAGE_CHARS),
        ...(result.score !== undefined && { score: result.score }),
      };
    }),
  };
};
