// === Attention ===
// useRagKnowledgeBase.ts is deprecated due to #802.
// The code in the main branch is not using this hook.
// ============

import { useMemo } from 'react';
import useChat from './useChat';
import useRagKnowledgeBaseApi from './useRagKnowledgeBaseApi';
import { getPrompter } from '../prompts';
import { RetrieveResultItem } from '@aws-sdk/client-kendra';
import { ShownMessage } from 'generative-ai-use-cases';
import { cleanEncode } from '../utils/URLUtils';
import { arrangeItems } from './useRag';
import { useTranslation } from 'react-i18next';

// Convert s3://<BUCKET>/<PREFIX> to https://s3.<REGION>.amazonaws.com/<BUCKET>/<PREFIX>
const convertS3UriToUrl = (s3Uri: string, region: string): string => {
  const result = /^s3:\/\/(?<bucketName>.+?)\/(?<prefix>.+)/.exec(s3Uri);

  if (!result) {
    return s3Uri;
  }

  const groups = result?.groups as {
    bucketName: string;
    prefix: string;
  };

  return `https://s3.${region}.amazonaws.com/${groups.bucketName}/${groups.prefix}`;
};

const useRagKnowledgeBase = (id: string) => {
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
  const { retrieve } = useRagKnowledgeBaseApi();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);

  return {
    isEmpty,
    loading,
    setLoading,
    messages,
    postChat,
    clear,
    postMessage: async (content: string) => {
      setLoading(true);

      const modelRegion = import.meta.env.VITE_APP_MODEL_REGION!;

      pushMessage('user', content);
      pushMessage('assistant', t('rag.knowledgeBase.retrieving'));

      let retrievedItems = null;

      try {
        retrievedItems = await retrieve(content);
      } catch (e) {
        console.error(e);
        popMessage();
        pushMessage(
          'assistant',
          t('rag.knowledgeBase.retrieveError', { region: modelRegion })
        );
        setLoading(false);
        return;
      }

      if (
        !retrievedItems ||
        !retrievedItems.data.retrievalResults ||
        retrievedItems.data.retrievalResults.length === 0
      ) {
        popMessage();
        pushMessage('assistant', t('rag.knowledgeBase.noDocuments'));
        setLoading(false);
        return;
      }

      // For reusing the prompt, convert the format to the same as the Amazon Kendra retrieve item
      // This processing is not needed for using only the Knowledge Base
      const retrievedItemsKendraFormat: RetrieveResultItem[] =
        retrievedItems.data.retrievalResults!.map((r, idx) => {
          const sourceUri =
            r.metadata?.['x-amz-bedrock-kb-source-uri']?.toString() ?? '';
          const pageNumber =
            r.metadata?.['x-amz-bedrock-kb-document-page-number'];

          return {
            Content: r.content?.text ?? '',
            DocumentId: `${idx}`,
            DocumentTitle: sourceUri.split('/').pop(),
            DocumentURI: convertS3UriToUrl(sourceUri, modelRegion),
            DocumentAttributes: pageNumber
              ? [
                  {
                    Key: '_excerpt_page_number',
                    Value: { LongValue: Number(pageNumber) },
                  },
                ]
              : [],
          };
        });
      const items = arrangeItems(retrievedItemsKendraFormat);

      updateSystemContext(
        prompter.ragPrompt({
          promptType: 'SYSTEM_CONTEXT',
          referenceItems: items,
        })
      );

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

export default useRagKnowledgeBase;
