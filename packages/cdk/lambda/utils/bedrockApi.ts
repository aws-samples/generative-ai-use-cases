import {
  InvokeModelCommand,
  ConverseCommand,
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommand,
  ConverseStreamCommandInput,
  ConverseStreamOutput,
  ServiceQuotaExceededException,
  ThrottlingException,
  AccessDeniedException,
  StartAsyncInvokeCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  ApiInterface,
  BedrockImageGenerationResponse,
  GenerateImageParams,
  GenerateVideoParams,
  Model,
  StreamingChunk,
  UnrecordedMessage,
} from 'generative-ai-use-cases';
import {
  BEDROCK_TEXT_GEN_MODELS,
  BEDROCK_IMAGE_GEN_MODELS,
  BEDROCK_VIDEO_GEN_MODELS,
} from './models';
import { streamingChunk } from './streamingChunk';
import { initBedrockRuntimeClient } from './bedrockClient';

const MODEL_REGION = process.env.MODEL_REGION as string;

const createConverseCommandInput = (
  model: Model,
  messages: UnrecordedMessage[],
  id: string
): ConverseCommandInput => {
  const modelConfig = BEDROCK_TEXT_GEN_MODELS[model.modelId];
  return modelConfig.createConverseCommandInput(
    messages,
    id,
    model,
    modelConfig.defaultParams,
    modelConfig.usecaseParams
  );
};

const createConverseStreamCommandInput = (
  model: Model,
  messages: UnrecordedMessage[],
  id: string
): ConverseStreamCommandInput => {
  const modelConfig = BEDROCK_TEXT_GEN_MODELS[model.modelId];
  return modelConfig.createConverseStreamCommandInput(
    messages,
    id,
    model,
    modelConfig.defaultParams,
    modelConfig.usecaseParams
  );
};

const extractConverseOutput = (
  model: Model,
  output: ConverseCommandOutput
): StreamingChunk => {
  const modelConfig = BEDROCK_TEXT_GEN_MODELS[model.modelId];
  return modelConfig.extractConverseOutput(output);
};

const extractConverseStreamOutput = (
  model: Model,
  output: ConverseStreamOutput
): StreamingChunk => {
  const modelConfig = BEDROCK_TEXT_GEN_MODELS[model.modelId];
  return modelConfig.extractConverseStreamOutput(output);
};

const createBodyImage = (model: Model, params: GenerateImageParams): string => {
  const modelConfig = BEDROCK_IMAGE_GEN_MODELS[model.modelId];
  return modelConfig.createBodyImage(params);
};

const extractOutputImage = (
  model: Model,
  response: BedrockImageGenerationResponse
): string => {
  const modelConfig = BEDROCK_IMAGE_GEN_MODELS[model.modelId];
  return modelConfig.extractOutputImage(response);
};

const createBodyVideo = (model: Model, params: GenerateVideoParams) => {
  const modelConfig = BEDROCK_VIDEO_GEN_MODELS[model.modelId];
  return modelConfig.createBodyVideo(params);
};

const bedrockApi: Omit<ApiInterface, 'invokeFlow'> = {
  invoke: async (model, messages, id) => {
    const region = model.region || MODEL_REGION;
    const client = await initBedrockRuntimeClient({ region });

    const converseCommandInput = createConverseCommandInput(
      model,
      messages,
      id
    );
    const command = new ConverseCommand(converseCommandInput);
    const output = await client.send(command);

    return extractConverseOutput(model, output).text;
  },
  invokeStream: async function* (model, messages, id) {
    const region = model.region || MODEL_REGION;
    const client = await initBedrockRuntimeClient({ region });
    try {
      const converseStreamCommandInput = createConverseStreamCommandInput(
        model,
        messages,
        id
      );

      const command = new ConverseStreamCommand(converseStreamCommandInput);

      const responseStream = await client.send(command);

      if (!responseStream.stream) {
        return;
      }

      for await (const response of responseStream.stream) {
        if (!response) {
          break;
        }

        const output = extractConverseStreamOutput(model, response);

        if (output.text || output.trace) {
          yield streamingChunk({ text: output.text, trace: output.trace });
        }

        if (response.messageStop) {
          yield streamingChunk({
            text: '',
            stopReason: response.messageStop.stopReason,
          });
          break;
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
      } else if (e instanceof AccessDeniedException) {
        const modelAccessURL = `https://${region}.console.aws.amazon.com/bedrock/home?region=${region}#/modelaccess`;
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
  generateImage: async (model, params) => {
    const region = model.region || MODEL_REGION;
    const client = await initBedrockRuntimeClient({ region });

    // Image generation using Stable Diffusion or Titan Image Generator is not supported for the Converse API, so InvokeModelCommand is used.
    const command = new InvokeModelCommand({
      modelId: model.modelId,
      body: createBodyImage(model, params),
      contentType: 'application/json',
    });
    const res = await client.send(command);
    const body = JSON.parse(Buffer.from(res.body).toString('utf-8'));

    return extractOutputImage(model, body);
  },
  generateVideo: async (model, params: GenerateVideoParams) => {
    const videoBucketRegionMap = JSON.parse(
      process.env.VIDEO_BUCKET_REGION_MAP ?? '{}'
    );
    const region = model.region || MODEL_REGION;
    const client = await initBedrockRuntimeClient({ region });
    const tmpOutputBucket = videoBucketRegionMap[region];

    if (!tmpOutputBucket || tmpOutputBucket.length === 0) {
      throw new Error('Video tmp buket is not defined');
    }

    const command = new StartAsyncInvokeCommand({
      modelId: model.modelId,
      modelInput: createBodyVideo(model, params),
      outputDataConfig: {
        s3OutputDataConfig: {
          s3Uri: `s3://${tmpOutputBucket}`,
          bucketOwner: process.env.VIDEO_BUCKET_OWNER, // Required for cross-account access
        },
      },
    });
    const res = await client.send(command);
    return res.invocationArn!;
  },
};

export default bedrockApi;
