import {
  DependencyFailedException,
  ImplicitFilterConfiguration,
  OrchestrationConfiguration,
  RetrievalFilter,
  RetrieveAndGenerateStreamCommand,
  RetrievedReference,
  ServiceQuotaExceededException,
  ThrottlingException,
  VectorSearchRerankingConfiguration,
} from '@aws-sdk/client-bedrock-agent-runtime';

import {
  ApiInterface,
  Model,
  UnrecordedMessage,
} from 'generative-ai-use-cases';
import {
  implicitFilters,
  hiddenStaticExplicitFilters,
  getDynamicFilters,
} from '@generative-ai-use-cases/common';
import { streamingChunk } from './streamingChunk';
import { verifyToken } from './auth';
import { initBedrockAgentRuntimeClient } from './bedrockClient';

const MODEL_REGION = process.env.MODEL_REGION as string;

// Convert s3://<BUCKET>/<PREFIX> to https://s3.<REGION>.amazonaws.com/<BUCKET>/<PREFIX>
const convertS3UriToUrl = (s3Uri: string, region: string): string => {
  const result = /^s3:\/\/(?<bucketName>.+?)\/(?<prefix>.+)/.exec(s3Uri);
  if (result) {
    const groups = result?.groups as {
      bucketName: string;
      prefix: string;
    };
    return `https://s3.${region}.amazonaws.com/${groups.bucketName}/${groups.prefix}`;
  }
  return '';
};

// Encode a string to URL
const encodeUrlString = (str: string): string => {
  try {
    return encodeURIComponent(str);
  } catch (e) {
    console.error('Failed to URL-encode string:', e);
    return str;
  }
};

const getImplicitFilters = (): ImplicitFilterConfiguration | undefined => {
  // Currently only supports Claude 3.5 Sonnet
  const modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';

  if (implicitFilters.length === 0) {
    return undefined;
  } else {
    return {
      metadataAttributes: implicitFilters,
      modelArn: `arn:aws:bedrock:${process.env.MODEL_REGION}::foundation-model/${modelId}`,
    };
  }
};

const getExplicitFilters = async (
  messages: UnrecordedMessage[],
  idToken?: string
): Promise<RetrievalFilter | undefined> => {
  // Check id token valid
  const payload = await verifyToken(idToken || '');
  if (!payload) {
    return undefined;
  }

  // ===== Dynamic Filter =====
  const dynamicFilters: RetrievalFilter[] = getDynamicFilters(payload);

  // ===== Get User Defined Explicit Filters =====
  let userDefinedExplicitFilters: RetrievalFilter[] = [];
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.extraData) {
    userDefinedExplicitFilters = lastMessage.extraData
      .filter((extra) => extra.type === 'json')
      .map((extra) => JSON.parse(extra.source.data) as RetrievalFilter);
  }

  // Return aggregated filters
  const aggregatedFilters: RetrievalFilter[] = [
    ...hiddenStaticExplicitFilters,
    ...dynamicFilters,
    ...userDefinedExplicitFilters,
  ];
  if (aggregatedFilters.length === 0) {
    return undefined;
  } else if (aggregatedFilters.length === 1) {
    return aggregatedFilters[0];
  } else {
    return {
      andAll: aggregatedFilters,
    };
  }
};

const getRerankingConfig = ():
  | VectorSearchRerankingConfiguration
  | undefined => {
  if (!process.env.RERANKING_MODEL_ID) return undefined;
  return {
    type: 'BEDROCK_RERANKING_MODEL',
    bedrockRerankingConfiguration: {
      modelConfiguration: {
        modelArn: `arn:aws:bedrock:${process.env.MODEL_REGION}::foundation-model/${process.env.RERANKING_MODEL_ID}`,
      },
    },
  };
};

const getOrchestrationConfig = (): OrchestrationConfiguration | undefined => {
  if (!process.env.QUERY_DECOMPOSITION_ENABLED) return undefined;
  return {
    queryTransformationConfiguration: {
      type: 'QUERY_DECOMPOSITION',
    },
  };
};

const bedrockKbApi: ApiInterface = {
  invoke: async () => {
    throw new Error('Not Implemented');
  },
  invokeStream: async function* (
    model: Model,
    messages: UnrecordedMessage[],
    id: string,
    idToken?: string
  ) {
    try {
      // Get explicit filters (async since it may require idToken verification)
      const explicitFilters = await getExplicitFilters(messages, idToken);

      // Invoke
      const command = new RetrieveAndGenerateStreamCommand({
        input: {
          text: messages[messages.length - 1].content,
        },
        sessionId: model.sessionId,
        retrieveAndGenerateConfiguration: {
          type: 'KNOWLEDGE_BASE',
          knowledgeBaseConfiguration: {
            knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
            modelArn: model.modelId,
            retrievalConfiguration: {
              vectorSearchConfiguration: {
                // Filter
                filter: explicitFilters,
                // Implicit Filter
                implicitFilterConfiguration: getImplicitFilters(),
                // Rerank
                rerankingConfiguration: getRerankingConfig(),
              },
            },
            // Query Splitting
            orchestrationConfiguration: getOrchestrationConfig(),
          },
        },
      });

      const client = await initBedrockAgentRuntimeClient({
        region: MODEL_REGION,
      });
      const res = await client.send(command);

      if (res.sessionId) {
        yield streamingChunk({ text: '', sessionId: res.sessionId });
      }

      if (!res.stream) {
        return;
      }

      // Store Reference
      const sources: {
        [key: string]: {
          refId: number;
          ref: RetrievedReference;
          fileName: string;
          pageNumber?: string;
        };
      } = {};

      // Citation may be passed a few characters after, so provide a buffer of 10 characters to insert Citation.
      let buffer = '';
      let currentPosition = 0;

      for await (const streamChunk of res.stream) {
        // Chunk
        if (streamChunk.output?.text) {
          const body = streamChunk.output?.text;
          buffer += body;
          const newPosition = Math.max(0, currentPosition, buffer.length - 10);
          yield streamingChunk({
            text: buffer.slice(currentPosition, newPosition),
          });
          currentPosition = newPosition;
        } else if (streamChunk.citation?.citation) {
          // Move the buffer to the Citation end
          const newPosition =
            (streamChunk.citation.citation.generatedResponsePart
              ?.textResponsePart?.span?.end || 0) + 1;
          if (newPosition <= buffer.length) {
            yield streamingChunk({
              text: buffer.slice(currentPosition, newPosition),
            });
            currentPosition = newPosition;
          }

          // Insert Reference
          for (const ref of streamChunk.citation.citation.retrievedReferences ||
            []) {
            // Get S3 URI and convert to URL
            const s3Uri = ref?.location?.s3Location?.uri || '';
            if (!s3Uri) continue;
            const url = convertS3UriToUrl(
              s3Uri,
              process.env.MODEL_REGION || ''
            );

            // Get page number
            const pageNumber = ref?.metadata?.[
              'x-amz-bedrock-kb-document-page-number'
            ] as string | undefined;

            // Get File name
            const fileName = url.split('/').pop() || '';
            const encodedFileName = encodeUrlString(fileName);

            // Build URL including page number for PDF
            const refUrl = `${url.replace(fileName, encodedFileName)}${pageNumber ? `#page=${pageNumber}` : ''}`;

            // If the data source is unique, add Reference
            if (sources[refUrl] === undefined) {
              sources[refUrl] = {
                refId: Object.keys(sources).length,
                ref: ref,
                fileName: fileName,
                pageNumber: pageNumber,
              };
            }
            // Add Reference number
            const body = `[^${sources[refUrl].refId}]`;
            yield streamingChunk({ text: body });
          }
        }
      }
      // Output to the end
      if (buffer.length > currentPosition) {
        yield streamingChunk({ text: buffer.slice(currentPosition) });
        currentPosition = buffer.length;
      }
      // Add Reference at the end
      for (const [url, { refId, ref, fileName, pageNumber }] of Object.entries(
        sources
      )) {
        const referenceText = `\n[^${refId}]: [${ref.metadata?.['title'] || fileName}${
          pageNumber ? `(${pageNumber} page)` : ''
        }](${url})`;

        yield streamingChunk({ text: referenceText });
      }
    } catch (e) {
      if (
        e instanceof ThrottlingException ||
        e instanceof ServiceQuotaExceededException
      ) {
        yield streamingChunk({
          text: 'The server is currently experiencing high access. Please try again later.',
          stopReason: 'error',
        });
      } else if (e instanceof DependencyFailedException) {
        const modelAccessURL = `https://${process.env.MODEL_REGION}.console.aws.amazon.com/bedrock/home?region=${process.env.MODEL_REGION}#/modelaccess`;
        yield streamingChunk({
          text: `The selected model is not enabled. Please enable the model in the [Bedrock console Model Access screen](${modelAccessURL}).`,
          stopReason: 'error',
        });
      } else {
        console.error(e);
        yield streamingChunk({
          text:
            'An error occurred. Please report the following error to the administrator.\n' +
            e,
          stopReason: 'error',
        });
      }
    }
  },
  generateImage: async () => {
    throw new Error('Not Implemented');
  },
  generateVideo: async () => {
    throw new Error('Not Implemented');
  },
};

export default bedrockKbApi;
