import { Amplify } from 'aws-amplify';
import { events } from 'aws-amplify/data';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { randomUUID } from "crypto";
import {
  BedrockRuntimeClient,
  InvokeModelWithBidirectionalStreamCommand,
  // InvokeModelWithBidirectionalStreamInput,
} from "@aws-sdk/client-bedrock-runtime";
import { NodeHttp2Handler } from '@smithy/node-http-handler';

Object.assign(global, { WebSocket: require('ws') });

// Event queue
const queue: Array<any> = [];

// Array of base64 input data
const audioInputQueue: string[] = [];

const promptName = randomUUID();
let audioContentId = randomUUID();
let audioStarted = false;

const enqueueSessionStart = () => {
  queue.push({
    event: {
      sessionStart: {
        inferenceConfiguration: {
          maxTokens: 1024,
          topP: 0.9,
          temperature: 0.7,
        }
      }
    }
  })
};

const enqueuePromptStart = () => {
  queue.push({
    event: {
      promptStart: {
        promptName,
        textOutputConfiguration: {
          mediaType: "text/plain",
        },
        audioOutputConfiguration: {
          audioType: "SPEECH",
          encoding: "base64",
          mediaType: "audio/lpcm",
          sampleRateHertz: 24000,
          sampleSizeBits: 16,
          channelCount: 1,
          voiceId: "tiffany",
        }
      }
    }
  });
};

const enqueueSystemPrompt = () => {
  const contentName = randomUUID();

  queue.push({
    event: {
      contentStart: {
        promptName,
        contentName,
        type: "TEXT",
        interactive: true,
        role: "SYSTEM",
        textInputConfiguration: {
          mediaType: "text/plain",
        },
      },
    },
  });

  queue.push({
    event: {
      textInput: {
        promptName,
        contentName,
        content: 'You are the AI assistant',
      },
    }
  });

  queue.push({
    event: {
      contentEnd: {
        promptName,
        contentName,
      },
    }
  })
};

const enqueueAudioStart = () => {
  audioContentId = randomUUID();

  queue.push({
    event: {
      contentStart: {
        promptName,
        contentName: audioContentId,
        type: 'AUDIO',
        interactive: true,
        role: 'USER',
        audioInputConfiguration: {
          audioType: "SPEECH",
          encoding: "base64",
          mediaType: "audio/lpcm",
          sampleRateHertz: 16000,
          sampleSizeBits: 16,
          channelCount: 1,
        },
      },
    },
  });

  audioStarted = true;
};

const enqueueAudioStop = () => {
  queue.push({
    event: {
      contentEnd: {
        promptName,
        contentName: audioContentId,
      },
    },
  });

  audioStarted = false;
};

const enqueueAudioInput = (audioInput: string) => {
  audioInputQueue.push(audioInput);
};

const createAsyncIterator = () => {
  return {
    [Symbol.asyncIterator]: () => {
      return {
        next: async () => {
          while (queue.length === 0) {
            // TODO: close signal
            await new Promise(s => setTimeout(s, 100));
          }

          const nextEvent = queue.shift();
          console.log(`Consume event ${JSON.stringify(nextEvent)}`);
          return {
            value: {
              chunk: {
                bytes: new TextEncoder().encode(JSON.stringify(nextEvent)),
              },
            },
            done: false,
          };
        },
      };
    },
    return: async () => {
      return { value: undefined, done: true}
    },
    throw: async (error: any) => {
      console.error(error)
      throw error;
    },
  }
}

const processAudioQueue = async () => {
  while (audioInputQueue.length > 0 && audioStarted) {
    const audioChunk = audioInputQueue.shift();

    queue.push({
      event: {
        audioInput: {
          promptName,
          contentName: audioContentId,
          content: audioChunk,
        },
      },
    });
  }

  setTimeout(() => processAudioQueue(), 0);
};

const processResponseStream = async (channel: any, response: any) => {
  try {
    for await (const event of response.body) {
      const textResponse = new TextDecoder().decode(event.chunk.bytes);

      if (event.chunk?.bytes) {
        const jsonResponse = JSON.parse(textResponse);
        console.log('JSON Response', jsonResponse);

        if (jsonResponse.event?.audioOutput) {
          await channel.publish({
            direction: 'btoc',
            event: 'audioOutput',
            data: jsonResponse.event.audioOutput,
          });
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
};

export const handler = async (event: any) => {
  try {
    console.log('event', event);

    const bedrock = new BedrockRuntimeClient({
      region: 'us-east-1', // TODO
      requestHandler: new NodeHttp2Handler({
        requestTimeout: 300000,
        sessionTimeout: 300000,
        disableConcurrentStreams: false,
        maxConcurrentStreams: 1,
      }),
    });

    Amplify.configure(
      {
        API: {
          Events: {
            endpoint: `${process.env.EVENT_API_ENDPOINT!}/event`,
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

    const channel = await events.connect('/default/dummy-session'); // TODO

    channel.subscribe({
      next: async (data: any) => {
        const event = data?.event;
        if (event && event.direction === 'ctob') {
          if (event.event === 'audioStart') {
            enqueueAudioStart();
          } else if (event.event === 'audioStop') {
            enqueueAudioStop();
          } else if (event.event === 'audioInput') {
            enqueueAudioInput(event.data);
          }
        }
      },
      error: console.error,
    });

    enqueueSessionStart();
    enqueuePromptStart();
    enqueueSystemPrompt();

    const asyncIterator = createAsyncIterator();

    const response = await bedrock.send(
      new InvokeModelWithBidirectionalStreamCommand({
        modelId: 'amazon.nova-sonic-v1:0',
        body: asyncIterator,
      }),
    );

    // Start audio event loop
    processAudioQueue();

    // Start response stream
    await processResponseStream(channel, response);
  } catch (e) {
    console.error(e);
  }
};
