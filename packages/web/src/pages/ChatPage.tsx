import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import InputChatContent from '../components/InputChatContent';
import useChat from '../hooks/useChat';
import useChatApi from '../hooks/useChatApi';
import useSystemContextApi from '../hooks/useSystemContextApi';
import useChatList from '../hooks/useChatList';
import ChatMessage from '../components/ChatMessage';
import PromptList from '../components/PromptList';
import Button from '../components/Button';
import ButtonCopy from '../components/ButtonCopy';
import ModalDialog from '../components/ModalDialog';
import ModalSystemContext from '../components/ModalSystemContext';
import ExpandableField from '../components/ExpandableField';
import Switch from '../components/Switch';
import Select from '../components/Select';
import ScrollTopBottom from '../components/ScrollTopBottom';
import useFollow from '../hooks/useFollow';
import { PiArrowClockwiseBold, PiShareFatFill } from 'react-icons/pi';
import { create } from 'zustand';
import BedrockIcon from '../assets/bedrock.svg?react';
import { ChatPageQueryParams } from '../@types/navigate';
import { MODELS } from '../hooks/useModel';
import { getPrompter } from '../prompts';
import queryString from 'query-string';
import useFiles from '../hooks/useFiles';
import {
  AdditionalModelRequestFields,
  FileLimit,
  SystemContext,
} from 'generative-ai-use-cases';
import ModelParameters from '../components/ModelParameters';
import { useTranslation } from 'react-i18next';

const fileLimit: FileLimit = {
  accept: {
    doc: [
      '.csv',
      '.doc',
      '.docx',
      '.html',
      '.md',
      '.pdf',
      '.txt',
      '.xls',
      '.xlsx',
      '.gif',
    ],
    image: ['.jpg', '.jpeg', '.png', '.webp'],
    video: ['.mkv', '.mov', '.mp4', '.webm'],
  },
  maxFileCount: 5,
  maxFileSizeMB: 4.5,
  maxImageFileCount: 20,
  maxImageFileSizeMB: 3.75,
  maxVideoFileCount: 1,
  maxVideoFileSizeMB: 1000, // 1 GB for S3 input
};

type StateType = {
  content: string;
  inputSystemContext: string;
  saveSystemContext: string;
  saveSystemContextTitle: string;
  setContent: (c: string) => void;
  setInputSystemContext: (c: string) => void;
  setSaveSystemContext: (c: string) => void;
  setSaveSystemContextTitle: (c: string) => void;
};

const useChatPageState = create<StateType>((set) => {
  return {
    content: '',
    inputSystemContext: '',
    saveSystemContext: '',
    saveSystemContextTitle: '',
    setContent: (s: string) => {
      set(() => ({
        content: s,
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

const ChatPage: React.FC = () => {
  const {
    content,
    inputSystemContext,
    saveSystemContext,
    saveSystemContextTitle,
    setContent,
    setInputSystemContext,
    setSaveSystemContext,
    setSaveSystemContextTitle,
  } = useChatPageState();
  const { pathname, search } = useLocation();
  const {
    clear: clearFiles,
    uploadedFiles,
    uploadFiles,
    base64Cache,
  } = useFiles(pathname);
  const { chatId } = useParams();

  const { listSystemContexts, deleteSystemContext, updateSystemContextTitle } =
    useSystemContextApi();
  const [systemContextList, setSystemContextList] = useState<SystemContext[]>(
    []
  );
  const { data: systemContextResponse, mutate } = listSystemContexts();
  useEffect(() => {
    setSystemContextList(systemContextResponse ? systemContextResponse : []);
  }, [systemContextResponse, setSystemContextList]);

  const {
    getModelId,
    setModelId,
    loading,
    loadingMessages,
    isEmpty,
    messages,
    rawMessages,
    clear,
    postChat,
    updateSystemContext,
    updateSystemContextByModel,
    getCurrentSystemContext,
    retryGeneration,
  } = useChat(pathname, chatId);
  const { createShareId, findShareId, deleteShareId } = useChatApi();
  const { createSystemContext } = useSystemContextApi();
  const { scrollableContainer, setFollowing } = useFollow();
  const { getChatTitle } = useChatList();
  const { modelIds: availableModels } = MODELS;
  const { data: share, mutate: reloadShare } = findShareId(chatId);
  const modelId = getModelId();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);
  const [overrideModelParameters, setOverrideModelParameters] = useState<
    AdditionalModelRequestFields | undefined
  >(undefined);
  const [showSetting, setShowSetting] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // On the conversation history page, do not change the system prompt even if the model is changed
    if (!chatId) {
      updateSystemContextByModel();
    }
    // eslint-disable-next-line  react-hooks/exhaustive-deps
  }, [prompter]);

  const title = useMemo(() => {
    if (chatId) {
      return getChatTitle(chatId) || t('chat.title');
    } else {
      return t('chat.title');
    }
  }, [chatId, getChatTitle, t]);

  const accept = useMemo(() => {
    if (!modelId) return [];
    const feature = MODELS.modelFeatureFlags[modelId];
    return [
      ...(feature.doc ? fileLimit.accept.doc : []),
      ...(feature.image ? fileLimit.accept.image : []),
      ...(feature.video ? fileLimit.accept.video : []),
    ];
  }, [modelId]);
  const fileUpload = useMemo(() => {
    return accept.length > 0;
  }, [accept]);
  const setting = useMemo(() => {
    return MODELS.modelFeatureFlags[modelId]?.reasoning ?? false;
  }, [modelId]);

  useEffect(() => {
    const _modelId = !modelId ? availableModels[0] : modelId;

    if (search !== '') {
      const params = queryString.parse(search) as ChatPageQueryParams;
      if (params.systemContext && params.systemContext !== '') {
        updateSystemContext(params.systemContext);
      } else {
        clear();
        setInputSystemContext(currentSystemContext);
      }
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
  }, [search, setContent, availableModels, pathname]);

  const onSend = useCallback(() => {
    setFollowing(true);
    postChat(
      prompter.chatPrompt({ content }),
      false,
      undefined,
      undefined,
      undefined,
      fileUpload ? uploadedFiles : undefined,
      undefined,
      undefined,
      undefined,
      base64Cache,
      overrideModelParameters
    );
    setContent('');
    clearFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, base64Cache, fileUpload, setFollowing, overrideModelParameters]);

  const onRetry = useCallback(() => {
    retryGeneration(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      base64Cache,
      overrideModelParameters
    );
  }, [retryGeneration, base64Cache, overrideModelParameters]);

  const onReset = useCallback(() => {
    clear();
    setContent('');
  }, [clear, setContent]);

  const [creatingShareId, setCreatingShareId] = useState(false);
  const [deletingShareId, setDeletingShareId] = useState(false);
  const [showShareIdModal, setShowShareIdModal] = useState(false);
  const [showSystemContextModal, setShowSystemContextModal] = useState(false);
  const [isOver, setIsOver] = useState(false);

  const onCreateShareId = useCallback(async () => {
    try {
      setCreatingShareId(true);
      await createShareId(chatId!);
      reloadShare();
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingShareId(false);
    }
  }, [chatId, createShareId, reloadShare]);

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
    saveSystemContextTitle,
    saveSystemContext,
    systemContextResponse,
    createSystemContext,
    setShowSystemContextModal,
    setInputSystemContext,
    setSaveSystemContextTitle,
    mutate,
    setSystemContextList,
  ]);
  const onDeleteShareId = useCallback(async () => {
    try {
      setDeletingShareId(true);
      await deleteShareId(share!.shareId.split('#')[1]);
      reloadShare();
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingShareId(false);
    }
  }, [share, deleteShareId, reloadShare]);

  const shareLink = useMemo(() => {
    if (share) {
      return `${window.location.origin}/share/${share.shareId.split('#')[1]}`;
    } else {
      return null;
    }
  }, [share]);

  const [showSystemContext, setShowSystemContext] = useState(false);

  const showingMessages = useMemo(() => {
    if (showSystemContext) {
      return rawMessages;
    } else {
      return messages;
    }
  }, [showSystemContext, rawMessages, messages]);

  const currentSystemContext = useMemo(() => {
    return getCurrentSystemContext();
  }, [getCurrentSystemContext]);

  useEffect(() => {
    setInputSystemContext(currentSystemContext);
  }, [currentSystemContext, setInputSystemContext]);

  const onClickSamplePrompt = useCallback(
    (params: ChatPageQueryParams) => {
      setContent(params.content ?? '');
      updateSystemContext(params.systemContext ?? '');
    },
    [setContent, updateSystemContext]
  );

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

  const handleDragOver = (event: React.DragEvent) => {
    // When a file is dragged, display the overlay
    event.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    // When a file is dragged, hide the overlay
    event.preventDefault();
    setIsOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    // When a file is dropped, add the file
    event.preventDefault();
    setIsOver(false);
    if (event.dataTransfer.files) {
      // Reflect the file and upload it
      uploadFiles(Array.from(event.dataTransfer.files), fileLimit, accept);
    }
  };

  return (
    <>
      <div
        onDragOver={fileUpload ? handleDragOver : undefined}
        className={`${!isEmpty ? 'screen:pb-36' : ''} relative`}>
        <div className="invisible my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
          {title}
        </div>

        {isOver && fileUpload && (
          <div
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="fixed bottom-0 left-0 right-0 top-0 z-[999] bg-slate-300 p-10 text-center">
            <div className="flex h-full w-full items-center justify-center outline-dashed">
              <div className="font-bold">{t('chat.drop_files')}</div>
            </div>
          </div>
        )}

        <div className="mt-2 flex w-full items-end justify-center lg:mt-0 print:hidden">
          <Select
            value={modelId}
            onChange={setModelId}
            options={availableModels.map((m) => {
              return { value: m, label: m };
            })}
          />
        </div>

        {((isEmpty && !loadingMessages) || loadingMessages) && (
          <div className="relative flex h-[calc(100vh-13rem)] flex-col items-center justify-center">
            <BedrockIcon
              className={`fill-gray-400 ${
                loadingMessages ? 'animate-pulse' : ''
              }`}
            />
          </div>
        )}

        {!isEmpty && !loadingMessages && (
          <div className="my-2 flex flex-col items-end pr-3 print:hidden">
            {chatId && (
              <div>
                <button
                  className="mb-1 flex items-center justify-center text-xs hover:underline"
                  onClick={() => {
                    setShowShareIdModal(true);
                  }}>
                  <PiShareFatFill className="mr-1" />
                  {share ? <>{t('chat.sharing')}</> : <>{t('chat.share')}</>}
                </button>
              </div>
            )}
            <Switch
              checked={showSystemContext}
              onSwitch={setShowSystemContext}
              label={t('chat.show_system_prompt')}
            />
          </div>
        )}

        <div ref={scrollableContainer}>
          {!isEmpty &&
            showingMessages.map((chat, idx) => (
              <div key={showSystemContext ? idx : idx + 1}>
                {idx === 0 && (
                  <div className="w-full border-b border-gray-300"></div>
                )}
                <ChatMessage
                  chatContent={chat}
                  loading={loading && idx === showingMessages.length - 1}
                  setSaveSystemContext={setSaveSystemContext}
                  setShowSystemContextModal={setShowSystemContextModal}
                  allowRetry={idx === showingMessages.length - 1}
                  retryGeneration={onRetry}
                />
                <div className="w-full border-b border-gray-300"></div>
              </div>
            ))}
        </div>

        <div className="fixed right-4 top-[calc(50vh-2rem)] z-0 lg:right-8">
          <ScrollTopBottom />
        </div>

        <div className="fixed bottom-0 z-0 flex w-full flex-col items-center justify-center lg:pr-64 print:hidden">
          {isEmpty && !loadingMessages && !chatId && (
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
            disabled={loading}
            onChangeContent={setContent}
            resetDisabled={!!chatId}
            onSend={() => {
              onSend();
            }}
            onReset={onReset}
            fileUpload={fileUpload}
            fileLimit={fileLimit}
            accept={accept}
            setting={setting}
            onSetting={() => {
              setShowSetting(true);
            }}
          />
        </div>
      </div>

      {isEmpty && !loadingMessages && (
        <PromptList
          onClick={onClickSamplePrompt}
          systemContextList={systemContextList as SystemContext[]}
          onClickDeleteSystemContext={onClickDeleteSystemContext}
          onClickUpdateSystemContext={onClickUpdateSystemContext}
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

      <ModalDialog
        isOpen={showShareIdModal}
        title={t('chat.share_conversation')}
        onClose={() => {
          setShowShareIdModal(false);
        }}>
        <div className="py-3 text-xs text-gray-600">
          {share ? (
            <>{t('chat.delete_link_message')}</>
          ) : (
            <>{t('chat.create_link_message')}</>
          )}
        </div>
        {shareLink && (
          <div className="bg-aws-squid-ink my-2 flex flex-row items-center justify-between rounded px-2 py-1 text-white">
            <div className="break-all text-sm">{shareLink}</div>
            <ButtonCopy text={shareLink} />
          </div>
        )}
        <div className="flex justify-end py-3">
          {share ? (
            <div className="flex">
              <Button
                onClick={() => {
                  window.open(shareLink!, '_blank', 'noreferrer');
                }}
                outlined
                className="mr-1"
                loading={deletingShareId}>
                {t('chat.open_link')}
              </Button>
              <Button
                onClick={onDeleteShareId}
                loading={deletingShareId}
                className="bg-red-500">
                {t('chat.delete_link')}
              </Button>
            </div>
          ) : (
            <Button onClick={onCreateShareId} loading={creatingShareId}>
              {t('chat.create_link')}
            </Button>
          )}
        </div>
      </ModalDialog>
      <ModalDialog
        isOpen={showSetting}
        onClose={() => {
          setShowSetting(false);
        }}
        title={t('chat.advanced_options')}>
        {setting && (
          <ExpandableField
            label={t('chat.model_parameters')}
            className="relative w-full"
            defaultOpened={true}>
            <div className="">
              <ModelParameters
                modelFeatureFlags={MODELS.modelFeatureFlags[modelId]}
                overrideModelParameters={overrideModelParameters}
                setOverrideModelParameters={setOverrideModelParameters}
              />
            </div>
          </ExpandableField>
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
    </>
  );
};

export default ChatPage;
