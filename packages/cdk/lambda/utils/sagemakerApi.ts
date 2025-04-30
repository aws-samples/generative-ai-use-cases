import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
  InvokeEndpointWithResponseStreamCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import { generatePrompt } from './prompter';
import { ApiInterface, UnrecordedMessage } from 'generative-ai-use-cases';
import { getSageMakerModelTemplate } from './models';
import { streamingChunk } from './streamingChunk';

const client = new SageMakerRuntimeClient({
  region: process.env.MODEL_REGION,
});

const TGI_DEFAULT_PARAMS = {
  max_new_tokens: 512,
  return_full_text: false,
  do_sample: true,
  temperature: 0.3,
};

const createBodyText = (
  model: string,
  messages: UnrecordedMessage[],
  stream: boolean
): string => {
  return JSON.stringify({
    inputs: generatePrompt(getSageMakerModelTemplate(model), messages),
    parameters: TGI_DEFAULT_PARAMS,
    stream: stream,
  });
};

const sagemakerApi: ApiInterface = {
  invoke: async (model, messages) => {
    const command = new InvokeEndpointCommand({
      EndpointName: model.modelId,
      Body: createBodyText(model.modelId, messages, false),
      ContentType: 'application/json',
      Accept: 'application/json',
    });
    const data = await client.send(command);
    return JSON.parse(new TextDecoder().decode(data.Body))[0].generated_text;
  },
  invokeStream: async function* (model, messages) {
    const command = new InvokeEndpointWithResponseStreamCommand({
      EndpointName: model.modelId,
      Body: createBodyText(model.modelId, messages, true),
      ContentType: 'application/json',
      Accept: 'application/json',
    });
    const stream = (await client.send(command)).Body;
    if (!stream) return;

    // https://aws.amazon.com/blogs/machine-learning/elevating-the-generative-ai-experience-introducing-streaming-support-in-amazon-sagemaker-hosting/
    // The output of the model will be in the following format:
    // b'data:{"token": {"text": " a"}}\n\n'
    // b'data:{"token": {"text": " challenging"}}\n\n'
    // b'data:{"token": {"text": " problem"
    // b'}}'
    //
    // While usually each PayloadPart event from the event stream will contain a byte array
    // with a full json, this is not guaranteed and some of the json objects may be split across
    // PayloadPart events. For example:
    // {'PayloadPart': {'Bytes': b'{"outputs": '}}
    // {'PayloadPart': {'Bytes': b'[" problem"]}\n'}}
    //
    // This logic accounts for this by concatenating bytes and
    // return lines (ending with a '\n' character) within the buffer.
    // It will also save any pending lines that doe not end with a '\n'
    // to make sure truncations are concatenated.

    let buffer = '';
    const pt = getSageMakerModelTemplate(model.modelId);
    for await (const chunk of stream) {
      buffer += new TextDecoder().decode(chunk.PayloadPart?.Bytes);
      if (!buffer.endsWith('\n')) continue;

      // When buffer end with \n it can be parsed
      const lines: string[] =
        buffer
          .split('\n')
          .filter((line: string) => line.trim().startsWith('data:')) || [];
      for (const line of lines) {
        const message = line.replace(/^data:/, '');
        const token: string = JSON.parse(message).token.text || '';
        if (!token.includes(pt.eosToken)) yield streamingChunk({ text: token });
      }
      buffer = '';
    }
  },
  generateImage: async () => {
    throw new Error('Not Implemented');
  },
  generateVideo: async () => {
    throw new Error('Not Implemented');
  },
};

export default sagemakerApi;
