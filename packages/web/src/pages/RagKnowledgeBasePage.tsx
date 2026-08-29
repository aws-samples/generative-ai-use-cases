import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import InputChatContent from '../components/InputChatContent';
import ChatMessage from '../components/ChatMessage';
import Select from '../components/Select';
import ScrollTopBottom from '../components/ScrollTopBottom';
import ExpandableField from '../components/ExpandableField';
import KbFilter from '../components/KbFilter';
import ModalDialog from '../components/ModalDialog';
import ModalSystemContext from '../components/ModalSystemContext';
import Button from '../components/Button';
import Switch from '../components/Switch';
import PromptList from '../components/PromptList';
import useChat from '../hooks/useChat';
import useFollow from '../hooks/useFollow';
import useSystemContextApi from '../hooks/useSystemContextApi';
import { PiArrowClockwiseBold } from 'react-icons/pi';
import { create } from 'zustand';
import BedrockIcon from '../assets/bedrock.svg?react';
import { RagPageQueryParams } from '../@types/navigate';
import { MODELS } from '../hooks/useModel';
import queryString from 'query-string';
import { getPrompter } from '../prompts';
import { userDefinedExplicitFilters } from '@generative-ai-use-cases/common';
import { RetrievalFilter } from '@aws-sdk/client-bedrock-agent-runtime';
import { RetrievalFilterLabel } from '../components/KbFilter';
import {
  ExplicitFilterConfiguration,
  ExtraData,
  SystemContext,
} from 'generative-ai-use-cases';
import { Option, SelectValue } from '../components/FilterSelect';
import { useTranslation } from 'react-i18next';

type StateType = {
  sessionId: string | undefined;
  content: string;
  filters: (RetrievalFilterLabel | null)[];
  inputSystemContext: string;
  saveSystemContext: string;
  saveSystemContextTitle: string;
  setSessionId: (c: string | undefined) => void;
  setContent: (c: string) => void;
  setFilters: (f: (RetrievalFilterLabel | null)[]) => void;
  setInputSystemContext: (c: string) => void;
  setSaveSystemContext: (c: string) => void;
  setSaveSystemContextTitle: (c: string) => void;
};

const useRagKnowledgeBasePageState = create<StateType>((set) => {
  return {
    sessionId: undefined, // Set initial value to null because RetrieveAndGenerate does not allow sessionId to be specified on the app side
    content: '',
    filters: userDefinedExplicitFilters.map(() => null),
    inputSystemContext: '',
    saveSystemContext: '',
    saveSystemContextTitle: '',
    setSessionId: (s: string | undefined) => {
      set(() => ({
        sessionId: s,
      }));
    },
    setContent: (s: string) => {
      set(() => ({
        content: s,
      }));
    },
    setFilters: (f: (RetrievalFilterLabel | null)[]) => {
      set(() => ({
        filters: f,
      }));
    },
    setInputSystemContext: (s: string) => {
      set(() => ({
        inputSystemContext: s,
      }));
    },
    setSaveSystemContext: (s: string) => {
      set(() => ({
        saveSystemContext: s,
      }));
    },
    setSaveSystemContextTitle: (s: string) => {
      set(() => ({
        saveSystemContextTitle: s,
      }));
    },
  };
});

const RagKnowledgeBasePage: React.FC = () => {
  const { t } = useTranslation();
  const {
    sessionId,
    content,
    filters,
    inputSystemContext,
    saveSystemContext,
    saveSystemContextTitle,
    setContent,
    setFilters,
    setSessionId,
    setInputSystemContext,
    setSaveSystemContext,
    setSaveSystemContextTitle,
  } = useRagKnowledgeBasePageState();
  const { pathname, search } = useLocation();
  const {
    getModelId,
    setModelId,
    loading,
    writing,
    isEmpty,
    messages,
    rawMessages,
    clear,
    postChat,
    editChat,
    updateSystemContext,
    updateSystemContextByModel,
    getCurrentSystemContext,
    retryGeneration,
    forceToStop,
  } = useChat(pathname);
  const { scrollableContainer, setFollowing } = useFollow();
  const { modelIdsInModelRegion: availableModels, modelDisplayName } = MODELS;
  const modelId = getModelId();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);

  const {
    listSystemContexts,
    deleteSystemContext,
    updateSystemContextTitle,
    createSystemContext,
  } = useSystemContextApi();
  const [systemContextList, setSystemContextList] = useState<SystemContext[]>(
    []
  );
  const { data: systemContextResponse, mutate } = listSystemContexts();

  useEffect(() => {
    setSystemContextList(systemContextResponse ? systemContextResponse : []);
  }, [systemContextResponse, setSystemContextList]);

  const [showSetting, setShowSetting] = useState(false);
  const [showSystemContext, setShowSystemContext] = useState(false);
  const [showSystemContextModal, setShowSystemContextModal] = useState(false);

  const RetrievalFilterLabelToRetrievalFilter = (
    f: RetrievalFilterLabel | null,
    filterConfig: ExplicitFilterConfiguration
  ): RetrievalFilter | null => {
    if (f === null) return null;
    const selectValueToValue = (
      selectValue: SelectValue,
      filterConfig: ExplicitFilterConfiguration
    ): string[] | string | number | boolean | null => {
      if (selectValue === null) return null;
      if (filterConfig.type === 'STRING_LIST' || Array.isArray(selectValue)) {
        return (selectValue as Option[]).map((v) => v.value);
      } else if (selectValue.value === null) {
        return null;
      } else if (filterConfig.type === 'STRING') {
        return (selectValue as Option).value;
      } else if (filterConfig.type === 'BOOLEAN') {
        return (selectValue as Option).value === 'true';
      } else if (filterConfig.type === 'NUMBER') {
        return (selectValue as Option).value === '' ||
          isNaN(Number((selectValue as Option).value))
          ? null
          : Number((selectValue as Option).value);
      }
      return null;
    };
    return Object.entries(f).map(([key, filterAttributeLabel]) => ({
      [key]: {
        key: filterAttributeLabel.key,
        value: selectValueToValue(filterAttributeLabel.value, filterConfig),
      },
    }))[0] as unknown as RetrievalFilter;
  };

  useEffect(() => {
    updateSystemContextByModel();
    // eslint-disable-next-line  react-hooks/exhaustive-deps
  }, [prompter]);

  const currentSystemContext = useMemo(() => {
    return getCurrentSystemContext();
  }, [getCurrentSystemContext]);

  useEffect(() => {
    setInputSystemContext(currentSystemContext);
  }, [currentSystemContext, setInputSystemContext]);

  const showingMessages = useMemo(() => {
    if (showSystemContext) {
      return rawMessages;
    } else {
      return messages;
    }
  }, [showSystemContext, rawMessages, messages]);

  useEffect(() => {
    const _modelId = !modelId ? availableModels[0] : modelId;
    if (search !== '') {
      const params = queryString.parse(search) as RagPageQueryParams;
      setContent(params.content ?? '');
      setModelId(
        availableModels.includes(params.modelId ?? '')
          ? params.modelId!
          : _modelId
      );
    } else {
      setModelId(_modelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModels, modelId, search, setContent]);

  const getExtraDataFromFilters = useCallback(() => {
    return filters
      .map((f, index) =>
        RetrievalFilterLabelToRetrievalFilter(
          f,
          userDefinedExplicitFilters[index]
        )
      )
      .filter(
        (f: RetrievalFilter | null) =>
          f !== null &&
          Object.values(f).filter((v) => v.value != null).length > 0
      )
      .map(
        (f) =>
          ({
            type: 'json',
            name: 'filter',
            source: {
              type: 'json',
              mediaType: 'application/json',
              data: JSON.stringify(f),
            },
          }) as ExtraData
      );
  }, [filters]);

  const onSend = useCallback(() => {
    setFollowing(true);
    // If there is a filter, add it to extraData
    const extraData: ExtraData[] = getExtraDataFromFilters();
    postChat(
      content,
      false,
      undefined,
      undefined,
      sessionId,
      undefined,
      extraData,
      'bedrockKb',
      setSessionId
    );
    setContent('');
  }, [
    content,
    sessionId,
    postChat,
    getExtraDataFromFilters,
    setContent,
    setFollowing,
    setSessionId,
  ]);

  const onRetry = useCallback(() => {
    const extraData: ExtraData[] = getExtraDataFromFilters();
    retryGeneration(
      false,
      undefined,
      undefined,
      sessionId,
      undefined,
      extraData,
      'bedrockKb',
      setSessionId
    );
  }, [sessionId, getExtraDataFromFilters, retryGeneration, setSessionId]);

  const onReset = useCallback(() => {
    clear();
    setContent('');
    setFilters(userDefinedExplicitFilters.map(() => null));
    setSessionId(undefined);
  }, [clear, setContent, setFilters, setSessionId]);

  // Only the last user message can be edited.
  // RetrieveAndGenerate keeps the conversation history in the server-side
  // session and only the last message is sent on each request, so truncating the
  // conversation in the middle cannot be reflected on the Knowledge Base side.
  const onEdit = useCallback(
    (modifiedPrompt: string, messageId?: string) => {
      const extraData: ExtraData[] = getExtraDataFromFilters();
      editChat(
        messageId,
        modifiedPrompt,
        false,
        undefined,
        undefined,
        sessionId,
        undefined,
        extraData,
        'bedrockKb',
        setSessionId
      );
    },
    [sessionId, getExtraDataFromFilters, editChat, setSessionId]
  );

  const onStop = useCallback(() => {
    forceToStop();
    setSessionId(undefined);
  }, [forceToStop, setSessionId]);

  const onCreateSystemContext = useCallback(async () => {
    try {
      await createSystemContext(saveSystemContextTitle, saveSystemContext);
    } catch (e) {
      console.error(e);
    } finally {
      setShowSystemContextModal(false);
      setInputSystemContext(saveSystemContext);
      setSaveSystemContextTitle('');
      mutate();
      setSystemContextList(systemContextResponse ?? []);
    }
  }, [
    createSystemContext,
    saveSystemContextTitle,
    saveSystemContext,
    systemContextResponse,
    setShowSystemContextModal,
    setInputSystemContext,
    setSaveSystemContextTitle,
    mutate,
    setSystemContextList,
  ]);

  const onClickDeleteSystemContext = async (systemContextId: string) => {
    try {
      const idx = systemContextList.findIndex(
        (item) => item.systemContextId === systemContextId
      );
      if (idx >= 0) {
        setSystemContextList(systemContextList.filter((_, i) => i !== idx));
      }
      await deleteSystemContext(systemContextId);
      mutate();
    } catch (e) {
      console.error(e);
    }
  };

  const onClickUpdateSystemContext = async (
    systemContextId: string,
    title: string
  ) => {
    try {
      const idx = systemContextList.findIndex(
        (item) => item.systemContextId === systemContextId
      );
      if (idx >= 0) {
        setSystemContextList(
          systemContextList.map((item, i) => {
            if (i === idx) {
              return { ...item, systemContextTitle: title };
            }
            return item;
          })
        );
      }
      await updateSystemContextTitle(systemContextId, title);
      mutate();
    } catch (e) {
      console.error(e);
    }
  };

  const onClickSamplePrompt = useCallback(
    (params: RagPageQueryParams) => {
      setContent(params.content ?? '');
      if (params.systemContext) {
        updateSystemContext(params.systemContext);
      }
    },
    [setContent, updateSystemContext]
  );

  const onChangeModel = useCallback(
    (newModelId: string) => {
      if (newModelId !== modelId) {
        setSessionId(undefined);
      }
      setModelId(newModelId);
    },
    [modelId, setModelId, setSessionId]
  );

  return (
    <>
      <div className={`${!isEmpty ? 'screen:pb-48' : ''} relative`}>
        <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
          {t('rag.title')}
        </div>

        <div className="mt-2 flex w-full items-end justify-center lg:mt-0">
          <Select
            value={modelId}
            onChange={onChangeModel}
            options={availableModels.map((m) => {
              return { value: m, label: modelDisplayName(m) };
            })}
          />
        </div>

        {isEmpty && (
          <div className="relative flex h-[calc(100vh-9rem)] flex-col items-center justify-center">
            <BedrockIcon className="fill-gray-400" />
          </div>
        )}

        {!isEmpty && (
          <div className="my-2 flex flex-col items-end pr-3 print:hidden">
            <Switch
              checked={showSystemContext}
              onSwitch={setShowSystemContext}
              label={t('chat.show_system_prompt')}
            />
          </div>
        )}

        <div ref={scrollableContainer}>
          {showingMessages.map((chat, idx) => (
            <div key={showSystemContext ? idx : idx + 1}>
              {idx === 0 && (
                <div className="w-full border-b border-gray-300"></div>
              )}
              <ChatMessage
                idx={idx}
                chatContent={chat}
                loading={loading && idx === showingMessages.length - 1}
                allowRetry={idx === showingMessages.length - 1}
                retryGeneration={onRetry}
                editable={idx === showingMessages.length - 2 && !loading}
                onCommitEdit={
                  idx === showingMessages.length - 2 && !loading
                    ? onEdit
                    : undefined
                }
                setSaveSystemContext={setSaveSystemContext}
                setShowSystemContextModal={setShowSystemContextModal}
              />
              <div className="w-full border-b border-gray-300"></div>
            </div>
          ))}
        </div>

        <div className={`fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8`}>
          <ScrollTopBottom />
        </div>

        <div
          className={`fixed bottom-0 z-0 flex w-full flex-col items-center justify-center lg:pr-64 print:hidden`}>
          {isEmpty && (
            <ExpandableField
              label={t('chat.system_prompt')}
              className="relative w-11/12 md:w-10/12 lg:w-4/6 xl:w-3/6">
              <>
                <div className="absolute -top-2 right-0 mb-2 flex justify-end">
                  <Button
                    outlined
                    className="text-xs"
                    onClick={() => {
                      clear();
                      setInputSystemContext(currentSystemContext);
                    }}>
                    {t('chat.initialize')}
                  </Button>
                  <Button
                    outlined
                    className="ml-1 text-xs"
                    onClick={() => {
                      setSaveSystemContext(inputSystemContext);
                      setShowSystemContextModal(true);
                    }}>
                    {t('chat.save')}
                  </Button>
                </div>

                <InputChatContent
                  disableMarginBottom={true}
                  content={inputSystemContext}
                  onChangeContent={setInputSystemContext}
                  fullWidth={true}
                  resetDisabled={true}
                  disabled={inputSystemContext === currentSystemContext}
                  sendIcon={<PiArrowClockwiseBold />}
                  onSend={() => {
                    updateSystemContext(inputSystemContext);
                  }}
                  hideReset={true}
                />
              </>
            </ExpandableField>
          )}
          <InputChatContent
            content={content}
            disabled={loading && !writing}
            onChangeContent={setContent}
            onSend={() => {
              if (!loading) {
                onSend();
              } else {
                onStop();
              }
            }}
            onReset={onReset}
            setting={true}
            onSetting={() => {
              setShowSetting(true);
            }}
            canStop={writing}
          />
        </div>
      </div>

      <ModalDialog
        isOpen={showSetting}
        onClose={() => {
          setShowSetting(false);
        }}
        title={t('chat.advanced_options')}>
        {userDefinedExplicitFilters.length > 0 && (
          <ExpandableField
            label={t('rag.filter')}
            className="relative w-full"
            defaultOpened={true}>
            <div className="flex justify-end">
              <div>
                {t('rag.filter_settings')}{' '}
                <a
                  className="text-aws-smile underline"
                  href="https://github.com/aws-samples/generative-ai-use-cases/blob/main/packages/common/src/custom/rag-knowledge-base.ts"
                  target="_blank">
                  {t('rag.here')}
                </a>{' '}
                {t('rag.please_refer')}
              </div>
            </div>

            <KbFilter
              filterConfigs={userDefinedExplicitFilters}
              filters={filters}
              setFilters={setFilters}
            />
          </ExpandableField>
        )}
        {userDefinedExplicitFilters.length === 0 && (
          <p>
            {t('rag.no_settings_found')}
            {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
            <a
              className="text-aws-smile underline"
              href="https://github.com/aws-samples/generative-ai-use-cases/blob/main/packages/common/src/custom/rag-knowledge-base.ts"
              target="_blank">
              packages/common/src/custom/rag-knowledge-base.ts
            </a>{' '}
            {t('rag.can_add_filters')}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => {
              setShowSetting(false);
            }}>
            {t('chat.settings')}
          </Button>
        </div>
      </ModalDialog>

      {isEmpty && (
        <PromptList
          onClick={onClickSamplePrompt}
          systemContextList={systemContextList as SystemContext[]}
          onClickDeleteSystemContext={onClickDeleteSystemContext}
          onClickUpdateSystemContext={onClickUpdateSystemContext}
          forceExpand={null}
        />
      )}

      <ModalSystemContext
        showSystemContextModal={showSystemContextModal}
        saveSystemContext={saveSystemContext}
        saveSystemContextTitle={saveSystemContextTitle}
        setShowSystemContextModal={setShowSystemContextModal}
        setSaveSystemContext={setSaveSystemContext}
        setSaveSystemContextTitle={setSaveSystemContextTitle}
        onCreateSystemContext={onCreateSystemContext}
      />
    </>
  );
};

export default RagKnowledgeBasePage;
