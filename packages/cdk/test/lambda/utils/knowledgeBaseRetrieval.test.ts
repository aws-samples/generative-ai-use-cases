import { knowledgeBaseRetrievalConfiguration } from '../../../lambda/utils/knowledgeBaseRetrieval';

const filter = { equals: { key: 'category', value: 'manual' } };
const implicitFilterConfiguration = {
  metadataAttributes: [
    { key: 'category', type: 'STRING' as const, description: 'kind' },
  ],
  modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/m',
};
const rerankingModelArn =
  'arn:aws:bedrock:us-east-1::foundation-model/cohere.rerank-v3-5:0';

describe('knowledgeBaseRetrievalConfiguration', () => {
  test('keeps the vector search settings for a customer-managed knowledge base', () => {
    expect(
      knowledgeBaseRetrievalConfiguration(
        {
          numberOfResults: 10,
          filter,
          implicitFilterConfiguration,
          rerankingModelArn,
          hybridSearch: true,
        },
        false
      )
    ).toEqual({
      vectorSearchConfiguration: {
        numberOfResults: 10,
        overrideSearchType: 'HYBRID',
        filter,
        implicitFilterConfiguration,
        rerankingConfiguration: {
          type: 'BEDROCK_RERANKING_MODEL',
          bedrockRerankingConfiguration: {
            modelConfiguration: { modelArn: rerankingModelArn },
          },
        },
      },
    });
  });

  test('uses the managed search settings for a managed knowledge base', () => {
    expect(
      knowledgeBaseRetrievalConfiguration(
        { filter, rerankingModelArn, hybridSearch: true },
        true
      )
    ).toEqual({
      managedSearchConfiguration: {
        filter,
        rerankingModelType: 'CUSTOM',
        rerankingConfiguration: {
          type: 'BEDROCK_RERANKING_MODEL',
          bedrockRerankingConfiguration: {
            modelConfiguration: { modelArn: rerankingModelArn },
          },
        },
      },
    });
  });

  // Implicit filters and the search type have no managed counterpart
  test('leaves out what a managed knowledge base does not take', () => {
    const config = knowledgeBaseRetrievalConfiguration(
      { implicitFilterConfiguration, hybridSearch: true },
      true
    );
    expect(config).toEqual({ managedSearchConfiguration: {} });
  });
});
