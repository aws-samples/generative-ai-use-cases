import {
  DependencyFailedException,
  GuardrailConfiguration,
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
import { classifyStreamingError } from './streamingError';
import { verifyToken } from './auth';
import { initBedrockAgentRuntimeClient } from './bedrockClient';

const MODEL_REGION = process.env.MODEL_REGION as string;

// Build a human-readable short label from a URL
// e.g. "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2036.htm"
//   -> "nta.go.jp/.../shotoku/2036.htm"
const shortenUrl = (rawUrl: string, maxLen = 60): string => {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, '');
    const path = decodeURIComponent(u.pathname).replace(/\/$/, '');
    const full = `${host}${path}`;
    if (full.length <= maxLen) return full;
    const segments = path.split('/').filter(Boolean);
    const tail = segments.slice(-2).join('/');
    const short = `${host}/.../${tail}`;
    return short.length <= maxLen ? short : `${host}/.../${segments.at(-1)}`;
  } catch {
    return rawUrl;
  }
};

// Convert s3://<BUCKET>/<PREFIX> to https://s3.<REGION>.amazonaws.com/<BUCKET>/<PREFIX>
const convertS3UriToUrl = (s3Uri: string, region: string): string => {
  const result = /^s3:\/\/(?<bucketName>.+?)\/(?<prefix>.+)/.exec(s3Uri);
  if (!result) return '';
  const { bucketName, prefix } = result.groups as {
    bucketName: string;
    prefix: string;
  };
  return `https://s3.${region}.amazonaws.com/${bucketName}/${prefix}`;
};

// Resolve source URL from a retrieved reference
const resolveSourceUrl = (ref: RetrievedReference): string | undefined => {
  const region = process.env.MODEL_REGION || '';
  if (ref?.location?.s3Location?.uri) {
    return convertS3UriToUrl(ref.location.s3Location.uri, region);
  }
  if (ref?.location?.webLocation?.url) {
    return ref.location.webLocation.url;
  }
  // Fallback: x-amz-bedrock-kb-source-uri metadata
  const sourceUri = ref?.metadata?.['x-amz-bedrock-kb-source-uri'] as
    | string
    | undefined;
  if (!sourceUri) return undefined;
  return sourceUri.startsWith('s3://')
    ? convertS3UriToUrl(sourceUri, region)
    : sourceUri;
};

// Resolve display title from a retrieved reference
const resolveDisplayTitle = (ref: RetrievedReference, url: string): string => {
  const metadataTitle =
    (ref?.metadata?.['title'] as string | undefined) ||
    (ref?.metadata?.['x-amz-bedrock-kb-document-title'] as string | undefined);
  if (metadataTitle) return metadataTitle;

  const isWebSource = !ref?.location?.s3Location?.uri;
  return isWebSource
    ? shortenUrl(url)
    : url
        .split('/')
        .pop()
        ?.split('?')[0]
        ?.replace(/\.(html?|pdf)$/i, '') || url;
};

// Build reference URL with encoding and page anchor
const buildRefUrl = (
  ref: RetrievedReference,
  url: string,
  pageNumber?: string
): string => {
  const isWebSource = !ref?.location?.s3Location?.uri;
  if (isWebSource) return url;
  const fileName = url.split('/').pop() || '';
  try {
    const encoded = encodeURIComponent(fileName);
    return `${url.replace(fileName, encoded)}${pageNumber ? `#page=${pageNumber}` : ''}`;
  } catch {
    return url;
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
  const payload = await verifyToken(idToken || '');
  if (!payload) return undefined;

  const dynamicFilters: RetrievalFilter[] = getDynamicFilters(payload);

  let userDefinedExplicitFilters: RetrievalFilter[] = [];
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.extraData) {
    userDefinedExplicitFilters = lastMessage.extraData
      .filter((extra) => extra.type === 'json')
      .map((extra) => JSON.parse(extra.source.data) as RetrievalFilter);
  }

  const aggregatedFilters: RetrievalFilter[] = [
    ...hiddenStaticExplicitFilters,
    ...dynamicFilters,
    ...userDefinedExplicitFilters,
  ];
  if (aggregatedFilters.length === 0) return undefined;
  if (aggregatedFilters.length === 1) return aggregatedFilters[0];
  return { andAll: aggregatedFilters };
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

const getGuardrailConfig = (): GuardrailConfiguration | undefined => {
  if (process.env.GUARDRAIL_IDENTIFIER && process.env.GUARDRAIL_VERSION) {
    return {
      guardrailId: process.env.GUARDRAIL_IDENTIFIER,
      guardrailVersion: process.env.GUARDRAIL_VERSION,
    };
  }
  return undefined;
};

const getOrchestrationConfig = (): OrchestrationConfiguration => {
  const config: OrchestrationConfiguration = {
    promptTemplate: {
      textPromptTemplate: `$conversation_history$

$query$

$output_format_instructions$`,
    },
  };

  if (process.env.QUERY_DECOMPOSITION_ENABLED === 'true') {
    config.queryTransformationConfiguration = {
      type: 'QUERY_DECOMPOSITION',
    };
  }

  return config;
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
      const explicitFilters = await getExplicitFilters(messages, idToken);

      const systemMessage = messages.find((msg) => msg.role === 'system');
      const userSystemContext = systemMessage?.content || '';

      const citationSuffix = `

User's question: $query$

The current time is $current_time$.

Here are the search results in numbered order:
$search_results$

$output_format_instructions$`;

      const guardrailConfiguration = getGuardrailConfig();

      const promptBase = userSystemContext
        ? userSystemContext
            .replace(/\$search_results\$/g, '')
            .replace(/\$output_format_instructions\$/g, '')
            .trim()
        : "You are a helpful assistant. Answer the user's question based on the search results.";

      const generationConfiguration = {
        promptTemplate: {
          textPromptTemplate: promptBase + citationSuffix,
        },
        guardrailConfiguration,
      };

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
            generationConfiguration,
            retrievalConfiguration: {
              vectorSearchConfiguration: {
                filter: explicitFilters,
                implicitFilterConfiguration: getImplicitFilters(),
                rerankingConfiguration: getRerankingConfig(),
              },
            },
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

      if (!res.stream) return;

      // Track unique sources for footnote references
      const sources: {
        [key: string]: {
          refId: number;
          ref: RetrievedReference;
          displayTitle: string;
          pageNumber?: string;
        };
      } = {};

      // Buffer to handle citation insertion (citations may arrive slightly after text)
      let buffer = '';
      let currentPosition = 0;

      for await (const streamChunk of res.stream) {
        if (streamChunk.output?.text) {
          buffer += streamChunk.output.text;
          const newPosition = Math.max(0, currentPosition, buffer.length - 10);
          yield streamingChunk({
            text: buffer.slice(currentPosition, newPosition),
          });
          currentPosition = newPosition;
        } else if (streamChunk.citation) {
          const citation = streamChunk.citation;

          // Advance buffer to citation span end
          const spanEnd =
            citation.generatedResponsePart?.textResponsePart?.span?.end ?? 0;
          const newPosition = spanEnd + 1;
          if (newPosition <= buffer.length && newPosition > currentPosition) {
            yield streamingChunk({
              text: buffer.slice(currentPosition, newPosition),
            });
            currentPosition = newPosition;
          }

          // Insert inline reference numbers
          for (const ref of citation.retrievedReferences || []) {
            const url = resolveSourceUrl(ref);
            if (!url) continue;

            const pageNumber = ref?.metadata?.[
              'x-amz-bedrock-kb-document-page-number'
            ] as string | undefined;
            const refUrl = buildRefUrl(ref, url, pageNumber);

            if (sources[refUrl] === undefined) {
              sources[refUrl] = {
                refId: Object.keys(sources).length,
                ref,
                displayTitle: resolveDisplayTitle(ref, url),
                pageNumber,
              };
            }
            yield streamingChunk({ text: `[^${sources[refUrl].refId}]` });
          }
        }
      }

      // Flush remaining buffer
      if (buffer.length > currentPosition) {
        yield streamingChunk({ text: buffer.slice(currentPosition) });
      }

      // Append footnote definitions
      for (const [url, { refId, displayTitle, pageNumber }] of Object.entries(
        sources
      )) {
        yield streamingChunk({
          text: `\n[^${refId}]: [${displayTitle}${pageNumber ? `(${pageNumber} page)` : ''}](${url})`,
        });
      }
    } catch (e) {
      console.error(e);
      if (
        e instanceof ThrottlingException ||
        e instanceof ServiceQuotaExceededException
      ) {
        yield streamingChunk({
          text: '',
          stopReason: 'error',
          errorCode: 'THROTTLING',
        });
      } else if (e instanceof DependencyFailedException) {
        yield streamingChunk({
          text: '',
          stopReason: 'error',
          errorCode: 'ACCESS_DENIED',
        });
      } else {
        yield streamingChunk({
          text: '',
          stopReason: 'error',
          errorCode: classifyStreamingError(e),
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
