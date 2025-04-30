import { StreamingChunk } from 'generative-ai-use-cases';
import useChatApi from './useChatApi';
import { create } from 'zustand';
import { MODELS } from './useModel';
import { generateWriterPrompt, WriterOption } from '../prompts/writer';

const useWriterState = create<{
  modelId: string;
  setModelId: (modelId: string) => void;
}>((set) => ({
  modelId: MODELS.textModels[0].modelId,
  setModelId: (modelId: string) => set({ modelId }),
}));

export const useWriter = () => {
  const { predictStream } = useChatApi();
  const { modelId, setModelId } = useWriterState();

  const write = async function* (
    prompt: string,
    option: string,
    command?: string
  ): AsyncGenerator<{ text?: string; trace?: string }> {
    const { messages, overrideModel } = generateWriterPrompt(
      prompt,
      option as WriterOption,
      command
    );

    const stream = await predictStream({
      id: '1',
      messages,
      model: overrideModel || {
        type: 'bedrock',
        modelId: modelId,
      },
    });
    let tmpChunk = '';
    let tmpTrace = '';
    for await (const chunk of stream) {
      const chunks = chunk.split('\n');

      for (const c of chunks) {
        if (c && c.length > 0) {
          const payload = JSON.parse(c) as StreamingChunk;

          if (payload.text.length > 0) {
            tmpChunk += payload.text;
          }

          if (payload.trace) {
            tmpTrace += payload.trace;
          }
        }

        if (tmpChunk.length >= 10) {
          yield { text: tmpChunk };
          tmpChunk = '';
        }

        if (tmpTrace.length >= 10) {
          yield { trace: tmpTrace };
          tmpTrace = '';
        }
      }

      if (tmpChunk.length > 0) {
        yield { text: tmpChunk };
        tmpChunk = '';
      }

      if (tmpTrace.length > 0) {
        yield { trace: tmpTrace };
        tmpTrace = '';
      }
    }
  };

  return {
    write,
    modelId,
    setModelId,
  };
};

export default useWriter;
