import {
  GetAgentAliasCommand,
  ListAgentActionGroupsCommand,
} from '@aws-sdk/client-bedrock-agent';
import {
  DependencyFailedException,
  InvokeAgentCommand,
  Parameter,
  ServiceQuotaExceededException,
  ThrottlingException,
} from '@aws-sdk/client-bedrock-agent-runtime';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiInterface,
  AgentMap,
  Model,
  UnrecordedMessage,
  BraveSearchResult,
} from 'generative-ai-use-cases';
import { streamingChunk } from './streamingChunk';
import {
  initBedrockAgentClient,
  initBedrockAgentRuntimeClient,
} from './bedrockClient';

const MODEL_REGION = process.env.MODEL_REGION as string;
const s3Client = new S3Client({});

// Agent information
const agentMap: AgentMap = JSON.parse(process.env.AGENT_MAP || '{}');
type AgentInfo = {
  codeInterpreterEnabled: boolean;
};
const agentInfoMap: { [aliasId: string]: AgentInfo } = {};

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

const getAgentInfo = async (agentId: string, agentAliasId: string) => {
  // Get Agent Info if not cached
  if (!agentInfoMap[agentAliasId]) {
    const bedrockAgentClient = await initBedrockAgentClient({
      region: MODEL_REGION,
    });
    // Get Agent Version
    const agentAliasInfoRes = await bedrockAgentClient.send(
      new GetAgentAliasCommand({
        agentId: agentId,
        agentAliasId: agentAliasId,
      })
    );
    const agentVersion =
      agentAliasInfoRes.agentAlias?.routingConfiguration?.pop()?.agentVersion ??
      '1';
    // List Action Group
    const actionGroups = await bedrockAgentClient.send(
      new ListAgentActionGroupsCommand({
        agentId: agentId,
        agentVersion: agentVersion,
      })
    );
    // Cache Agent Info
    agentInfoMap[agentAliasId] = {
      codeInterpreterEnabled: !!actionGroups.actionGroupSummaries?.find(
        (actionGroup) => actionGroup.actionGroupName === 'CodeInterpreterAction'
      ),
    };
  }
  return agentInfoMap[agentAliasId];
};

const bedrockAgentApi: ApiInterface = {
  invoke: async () => {
    throw new Error('Not Implemented');
  },
  invokeStream: async function* (model: Model, messages: UnrecordedMessage[]) {
    try {
      // Get Agent
      if (!agentMap[model.modelId]) {
        throw new Error('Agent not found');
      }
      const agentId = agentMap[model.modelId].agentId;
      const agentAliasId = agentMap[model.modelId].aliasId;
      const agentInfo = await getAgentInfo(agentId, agentAliasId);

      // Invoke Agent
      const command = new InvokeAgentCommand({
        sessionState: {
          files:
            messages[messages.length - 1].extraData?.map((file) => ({
              name: file.name.replace(/[^a-zA-Z0-9\s\-()[\].]/g, 'X'), // If the file name contains Japanese, it is not recognized, so replace it
              source: {
                sourceType: 'BYTE_CONTENT',
                byteContent: {
                  mediaType: file.source.mediaType,
                  data: Buffer.from(file.source.data, 'base64'),
                },
              },
              useCase: agentInfo.codeInterpreterEnabled
                ? 'CODE_INTERPRETER'
                : 'CHAT',
            })) || [],
        },
        agentId: agentId,
        agentAliasId: agentAliasId,
        sessionId: model.sessionId,
        enableTrace: true,
        inputText: messages[messages.length - 1].content,
      });

      const bedrockAgentRuntimeClient = await initBedrockAgentRuntimeClient({
        region: MODEL_REGION,
      });
      const res = await bedrockAgentRuntimeClient.send(command);

      if (!res.completion) {
        return;
      }

      const existingFiles = new Set<string>();

      for await (const streamChunk of res.completion) {
        // Chunk
        if (streamChunk.chunk) {
          let body = new TextDecoder('utf-8').decode(streamChunk.chunk?.bytes);

          // Add Attribution
          const sources: { [key: string]: number } = {};
          let offset = 0;
          for (const citation of streamChunk.chunk?.attribution?.citations ||
            []) {
            for (const ref of citation.retrievedReferences || []) {
              // Convert S3 URI to URL
              const s3Uri = ref?.location?.s3Location?.uri || '';
              if (!s3Uri) continue;
              const url = convertS3UriToUrl(
                s3Uri,
                process.env.MODEL_REGION || ''
              );

              // Get the page number
              const pageNumber =
                ref?.metadata?.['x-amz-bedrock-kb-document-page-number'];

              // Get the file name and encode it
              const fileName = url.split('/').pop() || '';
              const encodedFileName = encodeUrlString(fileName);

              // If the data source is unique, add Reference to the end
              if (sources[url] === undefined) {
                sources[url] = Object.keys(sources).length;
                body += `\n[^${sources[url]}]: [${fileName}${
                  pageNumber ? `(p.${pageNumber})` : ''
                }](${url.replace(fileName, encodedFileName)}${pageNumber ? `#page=${pageNumber}` : ''})`;
              }
              const referenceId = sources[url];

              // Add Reference to the middle of the text
              const position =
                (citation.generatedResponsePart?.textResponsePart?.span?.end ||
                  0) +
                offset +
                1;
              const referenceText = `[^${referenceId}]`;
              offset += referenceText.length;
              body =
                body.slice(0, position) + referenceText + body.slice(position);
            }
          }

          if (body) {
            yield streamingChunk({ text: body });
          }
        }

        // File
        // Images are uploaded to S3 and displayed as images
        // Files are uploaded to S3 and displayed as links
        if (streamChunk.files) {
          for (const file of streamChunk.files.files || []) {
            // The same file may appear multiple times, so only display the first occurrence
            if (existingFiles.has(file.name || '')) {
              continue;
            }
            existingFiles.add(file.name || '');

            // Upload the file to S3
            const uuid = uuidv4();
            const bucket = process.env.BUCKET_NAME;
            const key = `${uuid}/${file.name}`;
            const command = new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: file.bytes,
            });
            await s3Client.send(command);
            const url = `https://${bucket}.s3.amazonaws.com/${encodeUrlString(key)}`;

            // Yield file path
            if (file.type?.split('/')[0] === 'image') {
              yield streamingChunk({ text: `\n![${file.name}](${url})` });
            } else {
              yield streamingChunk({ text: `\n[${file.name}](${url})` });
            }
          }
        }

        // Trace
        if (streamChunk.trace && streamChunk.trace.trace?.orchestrationTrace) {
          let trace: string = '';
          const rationale =
            streamChunk.trace.trace?.orchestrationTrace.rationale;
          const invocationInput =
            streamChunk.trace.trace?.orchestrationTrace.invocationInput;
          const observation =
            streamChunk.trace.trace?.orchestrationTrace.observation;

          if (rationale?.text) {
            // The thought process is displayed as is
            trace = rationale.text;
          } else if (invocationInput) {
            // Action input
            if (invocationInput.codeInterpreterInvocationInput?.code) {
              // The input to CodeInterpreter is displayed as a block of Python code
              trace =
                '```python' +
                invocationInput.codeInterpreterInvocationInput.code +
                '\n```';
            } else if (
              invocationInput.actionGroupInvocationInput?.actionGroupName
            ) {
              // Custom Action
              // Edit this if you are calling your own action
              if (
                invocationInput.actionGroupInvocationInput.actionGroupName ===
                'Search'
              ) {
                // The search agent displays the search keyword
                const content =
                  invocationInput.actionGroupInvocationInput.requestBody
                    ?.content || {};
                const parameters: Parameter[] | undefined =
                  content['application/json'];
                trace =
                  invocationInput.actionGroupInvocationInput.actionGroupName +
                  ': ' +
                  parameters?.map((item) => item.value).join(' ');
              } else {
                // Display only the Action Group name otherwise
                trace =
                  invocationInput.actionGroupInvocationInput.actionGroupName;
              }
            } else if (invocationInput.knowledgeBaseLookupInput?.text) {
              // Knowledge Base displays the search keyword
              trace =
                'Search: ' + invocationInput.knowledgeBaseLookupInput.text;
            }
          } else if (observation) {
            // Action output
            if (observation.codeInterpreterInvocationOutput?.executionOutput) {
              // The output of CodeInterpreter (Python stdout) is displayed as is
              trace =
                observation.codeInterpreterInvocationOutput.executionOutput;
            } else if (observation.actionGroupInvocationOutput?.text) {
              // Custom Action
              // Edit this if you are calling your own action
              const output = observation.actionGroupInvocationOutput.text;
              if (output.startsWith('<search_results>')) {
                // The search agent displays the title and URL
                const searchResult: BraveSearchResult[] = JSON.parse(
                  output
                    .replace('<search_results>', '')
                    .replace('</search_results>', '')
                );
                trace = searchResult
                  .map((item) => `- [${item.title}](${item.url})`)
                  .join('\n');
              } else {
                // Display the first 1000 characters of the output otherwise
                trace =
                  output.length > 1000 ? output.slice(0, 1000) + '...' : output;
              }
            } else if (
              observation.knowledgeBaseLookupOutput?.retrievedReferences
            ) {
              // Knowledge Base displays the source URL
              const refs =
                observation.knowledgeBaseLookupOutput.retrievedReferences?.flatMap(
                  (ref) => {
                    const location = Object.values(ref.location || {}).find(
                      (loc) => loc?.uri || loc?.url
                    );
                    if (location) {
                      const url = location.uri
                        ? convertS3UriToUrl(
                            location.uri,
                            process.env.MODEL_REGION || ''
                          )
                        : location.url;
                      const fileName = url.split('/').pop() || '';
                      const encodedFileName = encodeUrlString(fileName);
                      const pageNumber =
                        ref?.metadata?.[
                          'x-amz-bedrock-kb-document-page-number'
                        ];

                      return `- [${fileName}${
                        pageNumber ? `(p.${pageNumber})` : ''
                      }](${url.replace(fileName, encodedFileName)}${pageNumber ? `#page=${pageNumber}` : ''})`;
                    }
                    return [];
                  }
                );
              trace = Array.from(new Set(refs)).join('\n');
            }
          }
          // Add a newline to ensure Markdown works correctly
          yield streamingChunk({ text: '', trace: trace + '\n' });
        }
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

export default bedrockAgentApi;
