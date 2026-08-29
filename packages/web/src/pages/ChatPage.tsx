import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { AcceptedDotExtensions } from '../utils/MediaUtils';
import { useTranslation } from 'react-i18next';

// File size limits for Chat (Lambda route: API Gateway → Lambda → Bedrock Converse API)
// - Lambda synchronous payload limit: 6MB
// - File data is base64-encoded in the request, so max original file size ≈ 6MB / 1.33 ≈ 4.5MB
// - Bedrock Converse API document limit: 4.5MB per document (except Claude 4+ PDF and Nova PDF/DOCX)
const fileLimit: FileLimit = {
  accept: AcceptedDotExtensions,
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

const DEFAULT_REASONING_BUDGET = 4096; // Claude 3.7 Sonnet recommended minimum value

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
    writing,
    loadingMessages,
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
  } = useChat(pathname, chatId);
  const { createShareId, findShareId, deleteShareId } = useChatApi();
  const { createSystemContext } = useSystemContextApi();
  const { scrollableContainer, setFollowing } = useFollow();
  const { getChatTitle } = useChatList();
  const { allModelIds: availableModels, modelDisplayName } = MODELS;
  const { data: share, mutate: reloadShare } = findShareId(chatId);
  const modelId = getModelId();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);
  const [overrideModelParameters, setOverrideModelParameters] =
    useState<AdditionalModelRequestFields>({
      reasoningConfig: {
        type: 'disabled',
        budgetTokens: DEFAULT_REASONING_BUDGET,
      },
    });
  const [showSetting, setShowSetting] = useState(false);
  const { t } = useTranslation();
  const [forceExpandPromptList, setForceExpandPromptList] = useState<
    number | null
  >(null);

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
    const feature = MODELS.getModelMetadata(modelId);
    return [
      ...(feature.flags.doc ? fileLimit.accept.doc : []),
      ...(feature.flags.image ? fileLimit.accept.image : []),
      ...(feature.flags.video ? fileLimit.accept.video : []),
    ];
  }, [modelId]);
  const fileUpload = useMemo(() => {
    return accept.length > 0;
  }, [accept]);
  const reasoning = useMemo(() => {
    return MODELS.getModelMetadata(modelId).flags.reasoning ?? false;
  }, [modelId]);
  const adaptiveThinking = useMemo(() => {
    return MODELS.getModelMetadata(modelId).flags.adaptiveThinking ?? false;
  }, [modelId]);
  const adaptiveThinkingAlwaysOn = useMemo(() => {
    return (
      MODELS.getModelMetadata(modelId).flags.adaptiveThinkingAlwaysOn ?? false
    );
  }, [modelId]);
  const xhighEffort = useMemo(() => {
    return MODELS.getModelMetadata(modelId).flags.xhighEffort ?? false;
  }, [modelId]);
  const reasoningEnabled = useMemo(() => {
    return (
      overrideModelParameters.reasoningConfig.type === 'enabled' ||
      overrideModelParameters.reasoningConfig.type === 'adaptive'
    );
  }, [overrideModelParameters]);
  // Currently, the settings modal is only used with the reasoning option
  const setting = useMemo(() => {
    return reasoning;
  }, [reasoning]);

  // Whether reasoning was force-enabled by an always-on model while the
  // user had it disabled, so the disabled state can be restored later
  const reasoningForcedByAlwaysOn = useRef(false);

  // When model changes, update reasoning type if reasoning is already enabled.
  // For models whose adaptive thinking is always on (e.g. Claude Sonnet 5),
  // reasoning is force-enabled while the model is selected, and the user's
  // original disabled state is restored when switching away.
  useEffect(() => {
    setOverrideModelParameters((prev) => {
      const config = prev.reasoningConfig;
      const enabled = config.type === 'enabled' || config.type === 'adaptive';

      let newType = config.type;
      if (adaptiveThinkingAlwaysOn) {
        if (!enabled) {
          reasoningForcedByAlwaysOn.current = true;
        }
        newType = 'adaptive';
      } else if (reasoningForcedByAlwaysOn.current) {
        reasoningForcedByAlwaysOn.current = false;
        newType = 'disabled';
      } else if (enabled) {
        newType = adaptiveThinking ? 'adaptive' : 'enabled';
      }

      const newEffort =
        config.effort === 'xhigh' && !xhighEffort ? 'high' : config.effort;
      if (config.type === newType && config.effort === newEffort) {
        return prev;
      }
      return {
        ...prev,
        reasoningConfig: { ...config, type: newType, effort: newEffort },
      };
    });
  }, [adaptiveThinking, adaptiveThinkingAlwaysOn, xhighEffort]);

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

  const onSend = useCallback(async () => {
    setFollowing(true);
    const savedContent = content;
    setContent('');
    clearFiles();
    const success = await postChat(
      prompter.chatPrompt({ content: savedContent }),
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
    if (!success) {
      setContent(savedContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    content,
    base64Cache,
    fileUpload,
    setFollowing,
    overrideModelParameters,
    uploadedFiles,
  ]);

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

  const onStop = useCallback(() => {
    forceToStop();
  }, [forceToStop]);

  const onEdit = useCallback(
    (modifiedPrompt: string, messageId?: string) => {
      setFollowing(true);
      editChat(
        messageId,
        modifiedPrompt,
        false,
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
    },
    [editChat, base64Cache, setFollowing, overrideModelParameters]
  );

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

  const onReasoningSwitched = useCallback(() => {
    if (reasoningEnabled) {
      setOverrideModelParameters({
        ...overrideModelParameters,
        reasoningConfig: {
          ...overrideModelParameters.reasoningConfig,
          type: 'disabled',
        },
      });
    } else {
      setOverrideModelParameters({
        ...overrideModelParameters,
        reasoningConfig: {
          ...overrideModelParameters.reasoningConfig,
          type: adaptiveThinking ? 'adaptive' : 'enabled',
        },
      });
    }
  }, [
    reasoningEnabled,
    adaptiveThinking,
    overrideModelParameters,
    setOverrideModelParameters,
  ]);

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

  // Initialize forceExpandPromptList to null when the path changes
  useEffect(() => {
    setForceExpandPromptList(null);
  }, [pathname, setForceExpandPromptList]);

  return (
    <>
      <div
        onDragOver={fileUpload ? handleDragOver : undefined}
        className={`${!isEmpty ? 'screen:pb-48' : ''} relative`}>
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
              return { value: m, label: modelDisplayName(m) };
            })}
          />
        </div>

        {((isEmpty && !loadingMessages) || loadingMessages) && (
          <div className="relative flex h-[calc(100vh-13rem)] flex-col items-center justify-center gap-y-4">
            <BedrockIcon
              className={`fill-gray-400 ${
                loadingMessages ? 'animate-pulse' : ''
              }`}
            />

            {!loadingMessages && (
              <Button
                className="text-sm"
                outlined
                onClick={() => {
                  setForceExpandPromptList(Math.random());
                }}>
                {t('chat.view_prompt_examples')}
              </Button>
            )}
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
                  editable={chat.role === 'user' && !loading}
                  hasFollowingMessages={idx < showingMessages.length - 2}
                  onCommitEdit={
                    chat.role === 'user' && !loading ? onEdit : undefined
                  }
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
            disabled={loading && !writing}
            onChangeContent={setContent}
            resetDisabled={!!chatId}
            onSend={() => {
              if (!loading) {
                onSend();
              } else {
                onStop();
              }
            }}
            onReset={onReset}
            fileUpload={fileUpload}
            fileLimit={fileLimit}
            accept={accept}
            reasoning={reasoning && !adaptiveThinkingAlwaysOn}
            onReasoningSwitched={onReasoningSwitched}
            reasoningEnabled={reasoningEnabled}
            setting={setting}
            onSetting={() => {
              setShowSetting(true);
            }}
            canStop={writing}
          />
        </div>
      </div>

      {isEmpty && !loadingMessages && (
        <PromptList
          onClick={onClickSamplePrompt}
          systemContextList={systemContextList as SystemContext[]}
          onClickDeleteSystemContext={onClickDeleteSystemContext}
          onClickUpdateSystemContext={onClickUpdateSystemContext}
          forceExpand={forceExpandPromptList}
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
          <div className="">
            <ModelParameters
              modelFeatureFlags={MODELS.getModelMetadata(modelId).flags}
              overrideModelParameters={overrideModelParameters}
              setOverrideModelParameters={setOverrideModelParameters}
            />
          </div>
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
