import { useMemo, useCallback, useState } from 'react';
import { getPrompter } from '../prompts';
import { MODELS, findModelByModelId } from './useModel';
import useChatApi from '../hooks/useChatApi';

const useOneshotTranslation = () => {
  const { predict } = useChatApi();
  const { modelIds, lightModelIds } = MODELS;
  const [translating, setTranslating] = useState(false);

  const translationModelId = useMemo(() => {
    return lightModelIds[0] ?? modelIds[0];
  }, [modelIds, lightModelIds]);

  const translate = useCallback(
    async (sentence: string, language: string): Promise<string> => {
      if (translating) return '';

      setTranslating(true);

      // Translate using the same mechanism (prompt) as the Translation use case.
      // However, it will not remain in the conversation history.
      const id = '/translate';
      const prompter = getPrompter(translationModelId);
      const systemPrompt = prompter.systemContext(id);
      const translationPrompt = prompter.translatePrompt({
        sentence,
        language,
        context: undefined,
      });
      const model = findModelByModelId(translationModelId);
      const messages = [
        {
          role: 'system' as const,
          content: systemPrompt,
        },
        {
          role: 'user' as const,
          content: translationPrompt,
        },
      ];

      const translatedWithTag = await predict({
        model,
        messages,
        id,
      });

      const translated = translatedWithTag.replace(
        /(<output>|<\/output>)/g,
        ''
      );

      setTranslating(false);

      return translated;
    },
    [translating, setTranslating, translationModelId, predict]
  );

  return {
    translating,
    setTranslating,
    translate,
  };
};

export default useOneshotTranslation;
