import { Request, Response } from 'express';
import { sendJson } from './utils/http';
import { RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { RetrieveKnowledgeBaseRequest } from 'generative-ai-use-cases';
import { initBedrockAgentRuntimeClient } from './utils/bedrockClient';

const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID;
const MODEL_REGION = process.env.MODEL_REGION as string;
// Hybrid search needs an OpenSearch Serverless vector store; other stores
// (S3 Vectors) accept only semantic search.
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

  const client = await initBedrockAgentRuntimeClient({ region: MODEL_REGION });
  const retrieveCommand = new RetrieveCommand({
    knowledgeBaseId: KNOWLEDGE_BASE_ID,
    retrievalQuery: { text: query },
    retrievalConfiguration: {
      vectorSearchConfiguration: {
        numberOfResults: 10,
        ...(HYBRID_SEARCH ? { overrideSearchType: 'HYBRID' } : {}),
      },
    },
  });
  const retrieveRes = await client.send(retrieveCommand);

  return sendJson(response, 200, retrieveRes);
};
