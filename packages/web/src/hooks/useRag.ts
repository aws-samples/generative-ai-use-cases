import { useMemo } from 'react';
import useChat from './useChat';
import useChatApi from './useChatApi';
import useRagApi from './useRagApi';
import { ShownMessage } from 'generative-ai-use-cases';
import { findModelByModelId } from './useModel';
import { getPrompter } from '../prompts';
import { RetrieveResultItem, DocumentAttribute } from '@aws-sdk/client-kendra';
import { cleanEncode } from '../utils/URLUtils';
import { useTranslation } from 'react-i18next';

// Key value to consider the same document
const uniqueKeyOfItem = (item: RetrieveResultItem): string => {
  const pageNumber =
    item.DocumentAttributes?.find(
      (a: DocumentAttribute) => a.Key === '_excerpt_page_number'
    )?.Value?.LongValue ?? '';
  const uri = item.DocumentURI;
  return `${uri}_${pageNumber}`;
};

export const arrangeItems = (
  items: RetrieveResultItem[]
): RetrieveResultItem[] => {
  const res: Record<string, RetrieveResultItem> = {};

  for (const item of items) {
    const key = uniqueKeyOfItem(item);

    if (res[key]) {
      // Content of the same source is connected with ...
      res[key].Content += ' ... ' + item.Content;
    } else {
      res[key] = item;
    }
  }

  return Object.values(res);
};

const useRag = (id: string) => {
  const { t } = useTranslation();

  const {
    getModelId,
    messages,
    postChat,
    clear,
    loading,
    setLoading,
    updateSystemContext,
    popMessage,
    pushMessage,
    isEmpty,
  } = useChat(id);

  const modelId = getModelId();
  const { retrieve } = useRagApi();
  const { predict } = useChatApi();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);

  return {
    isEmpty,
    clear,
    loading,
    messages,
    postMessage: async (content: string) => {
      const model = findModelByModelId(modelId);

      if (!model) {
        console.error(`model not found for ${modelId}`);
        return;
      }
      const prevQueries = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content);

      // When retrieving from Kendra, display the loading
      setLoading(true);
      pushMessage('user', content);
      pushMessage('assistant', t('rag.retrieving'));

      const query = await predict({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompter.ragPrompt({
              promptType: 'RETRIEVE',
              retrieveQueries: [...prevQueries, content],
            }),
          },
        ],
        id: id,
      });

      // Retrieve reference documents from Kendra and set them as the system prompt
      let items: RetrieveResultItem[] = [];
      try {
        const retrievedItems = await retrieve(query);
        items = arrangeItems(retrievedItems.data.ResultItems ?? []);
      } catch (error) {
        popMessage();
        pushMessage('assistant', t('rag.errorRetrieval'));
        setLoading(false);
        return;
      }

      if (items.length == 0) {
        popMessage();
        pushMessage('assistant', t('rag.noDocuments'));
        setLoading(false);
        return;
      }

      updateSystemContext(
        prompter.ragPrompt({
          promptType: 'SYSTEM_CONTEXT',
          referenceItems: items,
        })
      );

      // After hiding the loading, execute the POST processing of the normal chat
      popMessage();
      popMessage();
      postChat(
        content,
        false,
        (messages: ShownMessage[]) => {
          // Preprocessing: Few-shot is used, so delete the footnote from the past logs
          return messages.map((message) => ({
            ...message,
            content: message.content
              .replace(/\[\^0\]:[\s\S]*/s, '') // Delete the footnote at the end of the sentence
              .replace(/\[\^(\d+)\]/g, '') // Delete the footnote anchor in the sentence
              .trim(), // Delete the leading and trailing spaces
          }));
        },
        (message: string) => {
          // Postprocessing: Add the footnote
          const footnote = items
            .map((item, idx) => {
              // If there is a reference page number, set it as an anchor link
              const _excerpt_page_number = item.DocumentAttributes?.find(
                (attr) => attr.Key === '_excerpt_page_number'
              )?.Value?.LongValue;
              return message.includes(`[^${idx}]`)
                ? `[^${idx}]: [${item.DocumentTitle}${
                    _excerpt_page_number
                      ? `(${_excerpt_page_number} ${t('rag.page')})`
                      : ''
                  }](
                  ${item.DocumentURI ? cleanEncode(item.DocumentURI) : ''}${
                    _excerpt_page_number ? `#page=${_excerpt_page_number}` : ''
                  })`
                : '';
            })
            .filter((x) => x)
            .join('\n');
          return message + '\n' + footnote;
        }
      );
    },
  };
};

export default useRag;
