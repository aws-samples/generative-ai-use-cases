import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import RowItem from '../components/RowItem';
import ExpandableField from '../components/ExpandableField';
import Textarea from '../components/Textarea';
import Markdown from '../components/Markdown';
import ButtonCopy from '../components/ButtonCopy';
import Alert from '../components/Alert';
import Select from '../components/Select';
import useChat from '../hooks/useChat';
import useChatApi from '../hooks/useChatApi';
import useTyping from '../hooks/useTyping';
import { create } from 'zustand';
import { WebContentPageQueryParams } from '../@types/navigate';
import { MODELS } from '../hooks/useModel';
import { getPrompter } from '../prompts';
import queryString from 'query-string';
import InputText from '../components/InputText';
import { useTranslation } from 'react-i18next';

type StateType = {
  url: string;
  setUrl: (s: string) => void;
  fetching: boolean;
  setFetching: (b: boolean) => void;
  text: string;
  setText: (s: string) => void;
  context: string;
  setContext: (s: string) => void;
  content: string;
  setContent: (s: string) => void;
  clear: () => void;
};

const useWebContentPageState = create<StateType>((set) => {
  const INIT_STATE = {
    url: '',
    fetching: false,
    text: '',
    context: '',
    content: '',
  };
  return {
    ...INIT_STATE,
    setUrl: (s: string) => {
      set(() => ({
        url: s,
      }));
    },
    setFetching: (b: boolean) => {
      set(() => ({
        fetching: b,
      }));
    },
    setText: (s: string) => {
      set(() => ({
        text: s,
      }));
    },
    setContext: (s: string) => {
      set(() => ({
        context: s,
      }));
    },
    setContent: (s: string) => {
      set(() => ({
        content: s,
      }));
    },
    clear: () => {
      set(INIT_STATE);
    },
  };
});

const WebContent: React.FC = () => {
  const { t } = useTranslation();
  const {
    url,
    setUrl,
    fetching,
    setFetching,
    text,
    setText,
    context,
    setContext,
    content,
    setContent,
    clear,
  } = useWebContentPageState();

  const { pathname, search } = useLocation();
  const {
    getModelId,
    setModelId,
    loading,
    messages,
    postChat,
    continueGeneration,
    clear: clearChat,
    updateSystemContextByModel,
    getStopReason,
  } = useChat(pathname);
  const { setTypingTextInput, typingTextOutput } = useTyping(loading);
  const { getWebText } = useChatApi();
  const [showError, setShowError] = useState(false);
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const modelId = getModelId();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);
  const stopReason = getStopReason();

  useEffect(() => {
    updateSystemContextByModel();
    // eslint-disable-next-line  react-hooks/exhaustive-deps
  }, [prompter]);

  const disabledExec = useMemo(() => {
    return url === '' || loading || fetching;
  }, [url, loading, fetching]);

  useEffect(() => {
    const _modelId = !modelId ? availableModels[0] : modelId;
    if (search !== '') {
      const params = queryString.parse(search) as WebContentPageQueryParams;
      setUrl(params.url ?? '');
      setContext(params.context ?? '');
      setModelId(
        availableModels.includes(params.modelId ?? '')
          ? params.modelId!
          : _modelId
      );
    } else {
      setModelId(_modelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUrl, setContext, modelId, availableModels, search]);

  useEffect(() => {
    setTypingTextInput(content);
  }, [content, setTypingTextInput]);

  const getContent = useCallback(
    (text: string, context: string) => {
      postChat(
        prompter.webContentPrompt({
          text,
          context,
        }),
        true
      );
    },
    [prompter, postChat]
  );

  const onClickExec = useCallback(async () => {
    if (loading || fetching) return;
    setContent('');
    setFetching(true);
    setShowError(false);

    let res;

    try {
      res = await getWebText({ url });
    } catch (e) {
      setFetching(false);
      setShowError(true);
      return;
    }

    setFetching(false);

    const text = res!.data.text;

    setText(text);
    getContent(text, context);
  }, [
    url,
    context,
    loading,
    fetching,
    setContent,
    setFetching,
    setText,
    getContent,
    getWebText,
  ]);

  useEffect(() => {
    if (messages.length === 0) return;
    const _lastMessage = messages[messages.length - 1];
    if (_lastMessage.role !== 'assistant') return;
    const _response = messages[messages.length - 1].content;
    setContent(_response.trim());
  }, [messages, setContent]);

  const onClickClear = useCallback(() => {
    setShowError(false);
    clear();
    clearChat();
  }, [clear, clearChat]);

  return (
    <div className="grid grid-cols-12">
      <div className="invisible col-span-12 my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('webcontent.title')}
      </div>

      <div className="col-span-12 col-start-1 mx-2 lg:col-span-10 lg:col-start-2 xl:col-span-10 xl:col-start-2">
        {showError && (
          <Alert
            severity="error"
            className="mb-3"
            title={t('common.error')}
            onDissmiss={() => {
              setShowError(false);
            }}>
            {t('webcontent.error_message')}
          </Alert>
        )}

        <Card label={t('webcontent.website_to_extract')}>
          <div className="mb-2 flex w-full">
            <Select
              value={modelId}
              onChange={setModelId}
              options={availableModels.map((m) => {
                return { value: m, label: modelDisplayName(m) };
              })}
            />
          </div>

          <div className="text-xs text-black/50">
            {t('webcontent.instruction')}
          </div>

          <RowItem>
            <InputText
              placeholder={t('webcontent.enter_url')}
              value={url}
              onChange={(value) => {
                setUrl(value);
              }}
            />
          </RowItem>

          <ExpandableField label={t('webcontent.additional_context')} optional>
            <Textarea
              placeholder={t('webcontent.additional_context_placeholder')}
              value={context}
              onChange={setContext}
            />
          </ExpandableField>

          <div className="flex justify-end gap-3">
            {stopReason === 'max_tokens' && (
              <Button onClick={continueGeneration}>
                {t('translate.continue_output')}
              </Button>
            )}

            <Button outlined onClick={onClickClear} disabled={disabledExec}>
              {t('common.clear')}
            </Button>

            <Button disabled={disabledExec} onClick={onClickExec}>
              {t('common.execute')}
            </Button>
          </div>

          <div className="mt-2 rounded border border-black/30 p-1.5">
            <Markdown>{typingTextOutput}</Markdown>
            {!loading && !fetching && content === '' && (
              <div className="text-gray-500">
                {t('webcontent.result_placeholder')}
              </div>
            )}
            {(loading || fetching) && (
              <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
            )}
            <div className="flex w-full justify-end">
              <ButtonCopy
                text={content}
                interUseCasesKey="content"></ButtonCopy>
            </div>
          </div>

          <ExpandableField
            label={t('webcontent.original_text', {
              status: fetching
                ? t('webcontent.loading')
                : text === ''
                  ? t('webcontent.not_fetched')
                  : t('webcontent.fetched'),
            })}
            className="mt-2">
            <div className="rounded border border-black/30 p-1.5">
              {text === '' && (
                <div className="text-gray-500">
                  {t('webcontent.not_fetched_instruction')}
                </div>
              )}
              {text}
              <div className="flex w-full justify-end">
                <ButtonCopy text={text}></ButtonCopy>
              </div>
            </div>
          </ExpandableField>
        </Card>
      </div>
    </div>
  );
};

export default WebContent;
