import { Amplify } from 'aws-amplify';
import { events, EventsChannel } from 'aws-amplify/data';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { randomUUID } from 'crypto';
import {
  InvokeModelWithBidirectionalStreamCommand,
  InvokeModelWithBidirectionalStreamInput,
  InvokeModelWithBidirectionalStreamCommandOutput,
  ModelStreamErrorException,
} from '@aws-sdk/client-bedrock-runtime';
import { NodeHttp2Handler } from '@smithy/node-http-handler';
import {
  SpeechToSpeechEventType,
  SpeechToSpeechEvent,
  Model,
} from 'generative-ai-use-cases';
import { initBedrockRuntimeClient } from './utils/bedrockClient';

Object.assign(global, { WebSocket: require('ws') });

const MODEL_REGION = process.env.MODEL_REGION as string;

const MAX_AUDIO_INPUT_QUEUE_SIZE = 200;
const MIN_AUDIO_OUTPUT_QUEUE_SIZE = 10;
const MAX_AUDIO_OUTPUT_PER_BATCH = 20;

// Flags
let isActive = false;
let isProcessingAudio = false;
let isAudioStarted = false;

// Queues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let eventQueue: Array<any> = [];
let audioInputQueue: string[] = [];
let audioOutputQueue: string[] = [];

// IDs
let promptName = randomUUID();
let audioContentId = randomUUID();

const clearQueue = () => {
  eventQueue = [];
  audioInputQueue = [];
  audioOutputQueue = [];
};

const initialize = () => {
  isActive = false;
  isProcessingAudio = false;
  isAudioStarted = false;

  clearQueue();
};

const dispatchEvent = async (
  channel: EventsChannel,
  event: SpeechToSpeechEventType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any = undefined
) => {
  try {
    await channel.publish({
      direction: 'btoc',
      event,
      data,
    } as SpeechToSpeechEvent);
  } catch (e) {
    console.error(
      'Failed to publish the event via channel. The channel might be closed',
      event,
      data
    );
  }
};

const enqueueSessionStart = () => {
  eventQueue.push({
    event: {
      sessionStart: {
        inferenceConfiguration: {
          maxTokens: 1024,
          topP: 0.9,
          temperature: 0.7,
        },
      },
    },
  });
};

const enqueuePromptStart = () => {
  eventQueue.push({
    event: {
      promptStart: {
        promptName,
        textOutputConfiguration: {
          mediaType: 'text/plain',
        },
        audioOutputConfiguration: {
          audioType: 'SPEECH',
          encoding: 'base64',
          mediaType: 'audio/lpcm',
          sampleRateHertz: 24000,
          sampleSizeBits: 16,
          channelCount: 1,
          // TODO: avoid hardcoding
          voiceId: 'tiffany',
        },
      },
    },
  });
};

const enqueueSystemPrompt = (prompt: string) => {
  const contentName = randomUUID();

  eventQueue.push({
    event: {
      contentStart: {
        promptName,
        contentName,
        type: 'TEXT',
        interactive: true,
        role: 'SYSTEM',
        textInputConfiguration: {
          mediaType: 'text/plain',
        },
      },
    },
  });

  eventQueue.push({
    event: {
      textInput: {
        promptName,
        contentName,
        content: prompt,
      },
    },
  });

  eventQueue.push({
    event: {
      contentEnd: {
        promptName,
        contentName,
      },
    },
  });
};

const enqueueAudioStart = () => {
  audioContentId = randomUUID();

  eventQueue.push({
    event: {
      contentStart: {
        promptName,
        contentName: audioContentId,
        type: 'AUDIO',
        interactive: true,
        role: 'USER',
        audioInputConfiguration: {
          audioType: 'SPEECH',
          encoding: 'base64',
          mediaType: 'audio/lpcm',
          sampleRateHertz: 16000,
          sampleSizeBits: 16,
          channelCount: 1,
        },
      },
    },
  });

  isAudioStarted = true;
};

const enqueuePromptEnd = () => {
  eventQueue.push({
    event: {
      promptEnd: {
        promptName,
      },
    },
  });
};

const enqueueSessionEnd = () => {
  eventQueue.push({
    event: {
      sessionEnd: {},
    },
  });
};

const enqueueAudioStop = () => {
  isAudioStarted = false;

  clearQueue();

  eventQueue.push({
    event: {
      contentEnd: {
        promptName,
        contentName: audioContentId,
      },
    },
  });
};

const enqueueAudioInput = (audioInputBase64Array: string[]) => {
  if (!isAudioStarted || !isActive) {
    return;
  }

  for (const audioInput of audioInputBase64Array) {
    audioInputQueue.push(audioInput);
  }

  // Audio input queue full, dropping oldest chunk
  while (audioInputQueue.length - MAX_AUDIO_INPUT_QUEUE_SIZE > 0) {
    audioInputQueue.shift();
  }

  if (!isProcessingAudio) {
    isProcessingAudio = true;
    // Start audio event loop
    processAudioQueue();
  }
};

const enqueueAudioOutput = async (
  channel: EventsChannel,
  audioOutput: string
) => {
  audioOutputQueue.push(audioOutput);

  if (audioOutputQueue.length > MIN_AUDIO_OUTPUT_QUEUE_SIZE) {
    const chunksToProcess: string[] = [];

    let processedChunks = 0;

    while (
      audioOutputQueue.length > 0 &&
      processedChunks < MAX_AUDIO_OUTPUT_PER_BATCH
    ) {
      const chunk = audioOutputQueue.shift();

      if (chunk) {
        chunksToProcess.push(chunk);
        processedChunks += 1;
      }
    }

    await dispatchEvent(channel, 'audioOutput', chunksToProcess);
  }
};

const forcePublishAudioOutput = async (channel: EventsChannel) => {
  const chunksToProcess = [];

  while (audioOutputQueue.length > 0) {
    const chunk = audioOutputQueue.shift();
    if (chunk) {
      chunksToProcess.push(chunk);
    }
  }

  await dispatchEvent(channel, 'audioOutput', chunksToProcess);
};

const createAsyncIterator = () => {
  return {
    [Symbol.asyncIterator]: () => {
      return {
        next: async (): Promise<
          IteratorResult<InvokeModelWithBidirectionalStreamInput>
        > => {
          try {
            while (eventQueue.length === 0 && isActive) {
              await new Promise((s) => setTimeout(s, 100));
            }

            const nextEvent = eventQueue.shift();

            if (!nextEvent) {
              return { value: undefined, done: true };
            }

            if (nextEvent.event.sessionEnd) {
              isActive = false;
            }

            return {
              value: {
                chunk: {
                  bytes: new TextEncoder().encode(JSON.stringify(nextEvent)),
                },
              },
              done: false,
            };
          } catch (e) {
            console.error('Error in asyncIterator', e);
            return { value: undefined, done: true };
          }
        },
      };
    },
    return: async () => {
      return { value: undefined, done: true };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw: async (error: any) => {
      console.error(error);
      throw error;
    },
  };
};

const processAudioQueue = async () => {
  while (audioInputQueue.length > 0 && isAudioStarted && isActive) {
    const audioChunk = audioInputQueue.shift();

    eventQueue.push({
      event: {
        audioInput: {
          promptName,
          contentName: audioContentId,
          content: audioChunk,
        },
      },
    });
  }

  if (isAudioStarted && isActive) {
    setTimeout(() => processAudioQueue(), 0);
  } else {
    console.log('Processing audio is ended.');
    isProcessingAudio = false;
  }
};

const processResponseStream = async (
  channel: EventsChannel,
  response: InvokeModelWithBidirectionalStreamCommandOutput
) => {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  for await (const event of response.body) {
    try {
      if (event.chunk?.bytes) {
        const textResponse = new TextDecoder().decode(event.chunk.bytes);
        const jsonResponse = JSON.parse(textResponse);

        if (jsonResponse.event?.audioOutput) {
          await enqueueAudioOutput(
            channel,
            jsonResponse.event.audioOutput.content
          );
        } else if (
          jsonResponse.event?.contentEnd &&
          jsonResponse.event?.contentEnd?.type === 'AUDIO'
        ) {
          await forcePublishAudioOutput(channel);
        } else if (
          jsonResponse.event?.contentStart &&
          jsonResponse.event?.contentStart?.type === 'TEXT'
        ) {
          let generationStage = null;

          if (jsonResponse.event?.contentStart?.additionalModelFields) {
            generationStage = JSON.parse(
              jsonResponse.event?.contentStart?.additionalModelFields
            ).generationStage;
          }

          await dispatchEvent(channel, 'textStart', {
            id: jsonResponse.event?.contentStart?.contentId,
            role: jsonResponse.event?.contentStart?.role?.toLowerCase(),
            generationStage,
          });
        } else if (jsonResponse.event?.textOutput) {
          await dispatchEvent(channel, 'textOutput', {
            id: jsonResponse.event?.textOutput?.contentId,
            role: jsonResponse.event?.textOutput?.role?.toLowerCase(),
            content: jsonResponse.event?.textOutput?.content,
          });
        } else if (
          jsonResponse.event?.contentEnd &&
          jsonResponse.event?.contentEnd?.type === 'TEXT'
        ) {
          await dispatchEvent(channel, 'textStop', {
            id: jsonResponse.event?.contentEnd?.contentId,
            role: jsonResponse.event?.contentEnd?.role?.toLowerCase(),
            stopReason: jsonResponse.event?.contentEnd?.stopReason,
          });
        }
      }
    } catch (e) {
      console.error('Error in processResponseStream', e);

      if (e instanceof ModelStreamErrorException) {
        console.log('Retrying...');
      } else {
        break;
      }
    }
  }
};

export const handler = async (event: { channelId: string; model: Model }) => {
  let channel: EventsChannel | null = null;

  try {
    console.log('event', event);

    initialize();

    isActive = true;

    promptName = randomUUID();

    console.log('promptName', promptName);

    const bedrockRuntimeClient = await initBedrockRuntimeClient({
      region: event.model.region ?? MODEL_REGION,
      requestHandler: new NodeHttp2Handler({
        requestTimeout: 300000,
        sessionTimeout: 300000,
        disableConcurrentStreams: false,
        maxConcurrentStreams: 1,
      }),
    });

    console.log('Bedrock client initialized');

    Amplify.configure(
      {
        API: {
          Events: {
            endpoint: process.env.EVENT_API_ENDPOINT!,
            region: process.env.AWS_DEFAULT_REGION!,
            defaultAuthMode: 'iam',
          },
        },
      },
      {
        Auth: {
          credentialsProvider: {
            getCredentialsAndIdentityId: async () => {
              const provider = fromNodeProviderChain();
              const credentials = await provider();
              return {
                credentials,
              };
            },
            clearCredentialsAndIdentityId: async () => {},
          },
        },
      }
    );

    console.log('Amplify configured');
    console.log(
      `Connect to the channel /${process.env.NAMESPACE}/${event.channelId}`
    );

    channel = await events.connect(
      `/${process.env.NAMESPACE}/${event.channelId}`
    );

    console.log('Connected!');

    channel.subscribe({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: async (data: any) => {
        const event = data?.event;
        if (event && event.direction === 'ctob') {
          if (event.event === 'promptStart') {
            enqueuePromptStart();
          } else if (event.event === 'systemPrompt') {
            enqueueSystemPrompt(event.data);
          } else if (event.event === 'audioStart') {
            enqueueAudioStart();
          } else if (event.event === 'audioInput') {
            enqueueAudioInput(event.data);
          } else if (event.event === 'audioStop') {
            // Currently we accept only one turn audio session
            // Receiving 'audioStop' event means closing the session.
            enqueueAudioStop();
            enqueuePromptEnd();
            enqueueSessionEnd();
          }
        }
      },
      error: console.error,
    });

    console.log('Subscribed to the channel');

    enqueueSessionStart();

    // Without this sleep, the error below is raised
    // "Subscription has not been initialized"
    console.log('Sleep...');
    await new Promise((s) => setTimeout(s, 1000));

    // Notify the status to the client
    await dispatchEvent(channel, 'ready');

    console.log("I'm ready");

    const asyncIterator = createAsyncIterator();

    console.log('Async iterator created');

    const response = await bedrockRuntimeClient.send(
      new InvokeModelWithBidirectionalStreamCommand({
        modelId: event.model.modelId,
        body: asyncIterator,
      })
    );

    console.log('Bidirectional stream command sent');

    // Start response stream
    await processResponseStream(channel, response);
  } catch (e) {
    console.error('Error in main process', e);
  } finally {
    try {
      if (channel) {
        console.log('Sending "end" event...');
        await dispatchEvent(channel, 'end');

        console.log('Close the channel');
        channel.close();
      }

      initialize();
      console.log('Session ended. Every parameters are initialized.');
    } catch (e) {
      console.error('Error during finalization', e);
    }
  }
};
