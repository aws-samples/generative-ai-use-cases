import { Request, Response } from 'express';
import { idTokenFromRequest, sendJson } from './utils/http';
import { RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { RetrieveKnowledgeBaseRequest } from 'generative-ai-use-cases';
import { initBedrockAgentRuntimeClient } from './utils/bedrockClient';
import { knowledgeBaseRetrievalConfiguration } from './utils/knowledgeBaseRetrieval';
import { callerRetrievalFilters, combineFilters } from './utils/request';

const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const MODEL_REGION = process.env.MODEL_REGION as string;
// Hybrid search needs an OpenSearch Serverless vector store; S3 Vectors
// accepts only semantic search, and a managed knowledge base always runs it.
const HYBRID_SEARCH = process.env.KNOWLEDGE_BASE_HYBRID_SEARCH === 'true';

export const handler = async (
  request: Request,
  response: Response
): Promise<void> => {
  const req = (request.body ?? {}) as RetrieveKnowledgeBaseRequest;
  const query = req.query;

  if (!query) {
    return sendJson(response, 400, { error: 'query is not specified' });
  }

  // The same filters the chat applies; without a verified token the caller
  // cannot be matched against them.
  const filters = await callerRetrievalFilters(idTokenFromRequest(request));
  if (filters === null) {
    return sendJson(response, 401, { message: 'Unauthorized' });
  }

  const client = await initBedrockAgentRuntimeClient({ region: MODEL_REGION });
  const retrieveCommand = new RetrieveCommand({
    knowledgeBaseId: KNOWLEDGE_BASE_ID,
    retrievalQuery: { text: query },
    retrievalConfiguration: knowledgeBaseRetrievalConfiguration({
      numberOfResults: 10,
      hybridSearch: HYBRID_SEARCH,
      filter: combineFilters(filters),
    }),
  });
  const retrieveRes = await client.send(retrieveCommand);

  return sendJson(response, 200, retrieveRes);
};
