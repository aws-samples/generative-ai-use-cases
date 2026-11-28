import { Request, Response } from 'express';
import { idTokenFromRequest, sendJson } from './utils/http';
import {
  RetrievalFilter,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { RetrieveKnowledgeBaseRequest } from 'generative-ai-use-cases';
import { initBedrockAgentRuntimeClient } from './utils/bedrockClient';
import { callerRetrievalFilters, combineFilters } from './utils/request';
import {
  KnowledgeBaseFilterSpecError,
  knowledgeBaseFiltersFromSpec,
  unsupportedFilterOperators,
} from '@generative-ai-use-cases/common';

const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const MODEL_REGION = process.env.MODEL_REGION as string;
// Hybrid search needs an OpenSearch Serverless vector store; other stores
// (S3 Vectors) accept only semantic search.
const HYBRID_SEARCH = process.env.KNOWLEDGE_BASE_HYBRID_SEARCH === 'true';
const UNSUPPORTED_OPERATORS = unsupportedFilterOperators(
  process.env.KNOWLEDGE_BASE_STORAGE_TYPE
);

// The filter the use case asked for, or the message to answer 400 with
const requestedFilters = (
  filter: unknown
): { filters: RetrievalFilter[] } | { error: string } => {
  if (filter === undefined) return { filters: [] };
  try {
    const filters = knowledgeBaseFiltersFromSpec(filter);
    const unsupported = filters
      .flatMap((f) => Object.keys(f))
      .find((op) => UNSUPPORTED_OPERATORS.includes(op));
    if (unsupported) {
      return {
        error: `${unsupported} is not supported by this Knowledge Base`,
      };
    }
    return { filters };
  } catch (e) {
    if (e instanceof KnowledgeBaseFilterSpecError) return { error: e.message };
    throw e;
  }
};

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const req = (request.body ?? {}) as RetrieveKnowledgeBaseRequest;
  const query = req.query;

  if (!query) {
    return sendJson(response, 400, { error: 'query is not specified' });
  }

  const requested = requestedFilters(req.filter);
  if ('error' in requested) {
    return sendJson(response, 400, { error: requested.error });
  }

  // The same filters the chat applies; without a verified token the caller
  // cannot be matched against them. The requested filter only narrows them.
  const filters = await callerRetrievalFilters(idTokenFromRequest(request));
  if (filters === null) {
    return sendJson(response, 401, { message: 'Unauthorized' });
  }

  const client = await initBedrockAgentRuntimeClient({ region: MODEL_REGION });
  const retrieveCommand = new RetrieveCommand({
    knowledgeBaseId: KNOWLEDGE_BASE_ID,
    retrievalQuery: { text: query },
    retrievalConfiguration: {
      vectorSearchConfiguration: {
        numberOfResults: 10,
        ...(HYBRID_SEARCH ? { overrideSearchType: 'HYBRID' } : {}),
        filter: combineFilters([...filters, ...requested.filters]),
      },
    },
  });
  const retrieveRes = await client.send(retrieveCommand);

  return sendJson(response, 200, retrieveRes);
};
