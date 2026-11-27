import { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks';
import {
  chatMessages,
  clearMessages,
  overwriteLatestMessage,
  pushMessages,
  replaceMessages,
} from './chatSlice';
import usePredict from './usePredict';
import useSettings from '../settings/useSettings';
import { Message } from '../../../@types/chat';
import Browser from 'webextension-polyfill';
import { PromptSetting } from '../../../@types/settings';
import { StreamingChunk } from '../../../@types/backend-api';

const parseFirstModelId = (modelIds: string): string => {
  try {
    const parsed = JSON.parse(modelIds);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      if (typeof first === 'object' && first !== null) return first.modelId?.trim() ?? '';
      if (typeof first === 'string') return first.trim();
    }
  } catch {
    // not JSON
  }
  return modelIds.split(',')[0]?.trim() ?? '';
};

const useChat = () => {
  const { settings } = useSettings();
  // Keep the state for each tab because it can be launched in multiple screens
  const [tabId, setTabId] = useState<number>(-1);
  Browser.tabs?.getCurrent().then((tab) => {
    if (tab) {
      if (tab.id !== tabId) {
        setTabId(tab.id ?? -1);
      }
    }
  });

  const messages = useAppSelector((state) => chatMessages(state, tabId));
  const dispatch = useAppDispatch();
  const { predictStream } = usePredict();

  const [isLoading, setIsLoading] = useState(false);

  const isEmptyMessages = useMemo(() => {
    return messages.length === 0;
  }, [messages]);

  return {
    messages,
    isEmptyMessages,
    // The tab and the settings are loaded after the first render
    isReady: tabId !== -1 && !!settings,
    sendMessage: async (promptSetting: PromptSetting, content: string, isReplace?: boolean) => {
      if (tabId === -1) {
        throw new Error('Tab IDが取得できませんでした');
      }

      setIsLoading(true);
      try {
        const sendingMessage: Message[] = [
          {
            role: 'user',
            content: content,
          },
        ];
        // If ignoreHistory is true, use the one-question-one-answer format
        if (isEmptyMessages || promptSetting.ignoreHistory) {
          sendingMessage.unshift({
            role: 'system',
            title: promptSetting.systemContextTitle,
            content: promptSetting.systemContext,
          });
        }

        const effectiveModelId =
          settings?.modelId || (settings?.modelIds ? parseFirstModelId(settings.modelIds) : '');
        const stream = predictStream({
          model: {
            modelId: effectiveModelId,
            type: 'bedrock',
          },
          messages:
            isReplace || promptSetting.ignoreHistory
              ? sendingMessage
              : [...messages, ...sendingMessage],
        });
        dispatch(
          isReplace
            ? replaceMessages(tabId, [
                ...sendingMessage,
                {
                  role: 'assistant',
                  content: '▍',
                },
              ])
            : pushMessages(tabId, [
                ...sendingMessage,
                {
                  role: 'assistant',
                  content: '▍',
                },
              ]),
        );

        // Update the Assistant message
        let tmpChunk = '';

        for await (const chunks of stream) {
          // The chunk data is sent with the newline code, so split and process it
          for (const chunk_ of chunks.split('\n')) {
            if (chunk_) {
              const chunk: StreamingChunk = JSON.parse(chunk_);
              tmpChunk += chunk.text;
            }
          }

          // chunk is processed together if it is 10 characters or more
          // If not buffering, the following error occurs
          // Maximum update depth exceeded
          if (tmpChunk.length >= 10) {
            dispatch(overwriteLatestMessage(tabId, tmpChunk + '▍'));
          }
        }
        dispatch(overwriteLatestMessage(tabId, tmpChunk));
      } finally {
        setIsLoading(false);
      }
    },
    clearMessages: () => {
      if (tabId === -1) {
        throw new Error('Tab IDが取得できませんでした');
      }

      dispatch(clearMessages({ tabId }));
    },
    isLoading,
  };
};

export default useChat;
