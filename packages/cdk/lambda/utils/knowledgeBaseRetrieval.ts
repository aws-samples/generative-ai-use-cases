import {
  ImplicitFilterConfiguration,
  KnowledgeBaseRetrievalConfiguration,
  RetrievalFilter,
} from '@aws-sdk/client-bedrock-agent-runtime';

type RetrievalOptions = {
  numberOfResults?: number;
  filter?: RetrievalFilter;
  implicitFilterConfiguration?: ImplicitFilterConfiguration;
  // A Bedrock reranking model to use instead of the default ranking
  rerankingModelArn?: string;
  // Combine semantic and keyword search (OpenSearch Serverless only)
  hybridSearch?: boolean;
};

/**
 * The retrieval settings for the knowledge base of this deployment.
 *
 * A managed knowledge base takes managedSearchConfiguration: it always runs
 * hybrid search and reranks with a service-managed model, and has no implicit
 * filters. A customer-managed one takes vectorSearchConfiguration.
 */
export const knowledgeBaseRetrievalConfiguration = (
  options: RetrievalOptions,
  managed: boolean = process.env.KNOWLEDGE_BASE_MANAGED === 'true'
): KnowledgeBaseRetrievalConfiguration => {
  const { numberOfResults, filter, rerankingModelArn } = options;

  if (managed) {
    return {
      managedSearchConfiguration: {
        ...(numberOfResults !== undefined && { numberOfResults }),
        ...(filter && { filter }),
        ...(rerankingModelArn && {
          rerankingModelType: 'CUSTOM',
          rerankingConfiguration: {
            type: 'BEDROCK_RERANKING_MODEL',
            bedrockRerankingConfiguration: {
              modelConfiguration: { modelArn: rerankingModelArn },
            },
          },
        }),
      },
    };
  }

  return {
    vectorSearchConfiguration: {
      ...(numberOfResults !== undefined && { numberOfResults }),
      ...(options.hybridSearch && { overrideSearchType: 'HYBRID' }),
      filter,
      implicitFilterConfiguration: options.implicitFilterConfiguration,
      ...(rerankingModelArn && {
        rerankingConfiguration: {
          type: 'BEDROCK_RERANKING_MODEL',
          bedrockRerankingConfiguration: {
            modelConfiguration: { modelArn: rerankingModelArn },
          },
        },
      }),
    },
  };
};
