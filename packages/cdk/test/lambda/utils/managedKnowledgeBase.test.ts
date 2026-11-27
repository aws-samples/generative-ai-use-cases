import { ApiInterface, Model } from 'generative-ai-use-cases';

// A managed knowledge base does not take RetrieveAndGenerate, so the RAG chat
// asks it through AgenticRetrieveStream and writes the answer with footnotes.

process.env.KNOWLEDGE_BASE_MANAGED = 'true';
process.env.KNOWLEDGE_BASE_ID = 'KB12345678';
process.env.MODEL_REGION = 'ap-northeast-1';

const URI = 'https://bucket.s3.ap-northeast-1.amazonaws.com/docs/guide.pdf';
const sent: { input: Record<string, unknown> }[] = [];

jest.mock('../../../lambda/utils/bedrockClient', () => ({
  initBedrockAgentRuntimeClient: async () => ({
    send: async (command: { input: Record<string, unknown> }) => {
      sent.push(command);
      return {
        stream: (async function* () {
          yield { traceEvent: { attributes: { step: 'Planning' } } };
          yield {
            result: {
              results: [
                {
                  content: { text: 'Nova Micro is text only.' },
                  metadata: {
                    _source_uri: URI,
                    _document_title: 'Nova Guide',
                    _excerpt_page_number: 8,
                  },
                },
                {
                  content: { text: 'Nova Micro is the fastest.' },
                  metadata: {
                    _source_uri: URI,
                    _document_title: 'Nova Guide',
                    _excerpt_page_number: 8,
                  },
                },
              ],
              generatedResponse: {
                answer: 'Nova Micro handles text. It is fast.',
                citations: [
                  {
                    startIndex: 0,
                    endIndex: 24,
                    references: [{ resultIndex: 0 }, { resultIndex: 1 }],
                  },
                ],
              },
            },
          };
        })(),
      };
    },
  }),
}));

jest.mock('../../../lambda/utils/auth', () => ({
  verifyToken: async () => ({ sub: 'user' }),
}));

let bedrockKbApi: ApiInterface;
beforeAll(async () => {
  bedrockKbApi = (await import('../../../lambda/utils/bedrockKbApi')).default;
});

const model: Model = {
  type: 'bedrockKb',
  modelId: 'jp.anthropic.claude-haiku-5-5',
};

const text = async (stream: AsyncIterable<string>) => {
  let all = '';
  for await (const chunk of stream) all += JSON.parse(chunk).text ?? '';
  return all;
};

describe('RAG chat on a managed knowledge base', () => {
  test('asks through agentic retrieval with the chosen model', async () => {
    await text(
      bedrockKbApi.invokeStream(
        model,
        [
          { role: 'system', content: 'You answer from the documents.' },
          { role: 'user', content: 'What is Nova Micro?' },
        ],
        'id'
      )
    );
    const input = sent[0].input as {
      messages: unknown[];
      retrievers: {
        configuration: { knowledgeBase: { knowledgeBaseId: string } };
      }[];
      agenticRetrieveConfiguration: {
        foundationModelType: string;
        foundationModelConfiguration: {
          bedrockFoundationModelConfiguration: {
            modelConfiguration: { modelArn: string };
          };
        };
      };
    };
    expect(input.messages).toEqual([
      { role: 'user', content: { text: 'What is Nova Micro?' } },
    ]);
    expect(
      input.retrievers[0].configuration.knowledgeBase.knowledgeBaseId
    ).toBe('KB12345678');
    expect(input.agenticRetrieveConfiguration.foundationModelType).toBe(
      'CUSTOM'
    );
    expect(
      input.agenticRetrieveConfiguration.foundationModelConfiguration
        .bedrockFoundationModelConfiguration.modelConfiguration.modelArn
    ).toBe('jp.anthropic.claude-haiku-5-5');
  });

  test('puts a footnote where each source supports the answer', async () => {
    const answer = await text(
      bedrockKbApi.invokeStream(
        model,
        [{ role: 'user', content: 'What is Nova Micro?' }],
        'id'
      )
    );
    expect(answer).toBe(
      'Nova Micro handles text.[^0] It is fast.' +
        `\n[^0]: [Nova Guide(8 page)](${URI}#page=8)`
    );
  });
});
