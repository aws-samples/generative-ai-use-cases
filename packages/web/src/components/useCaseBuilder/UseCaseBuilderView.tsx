import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import Select from '../Select';
import Button from '../Button';
import useChat from '../../hooks/useChat';
import { useLocation } from 'react-router-dom';
import { MODELS } from '../../hooks/useModel';
import Markdown from '../Markdown';
import ButtonCopy from '../ButtonCopy';
import useTyping from '../../hooks/useTyping';
import { create } from 'zustand';
import Textarea from '../Textarea';
import { produce } from 'immer';
import ButtonFavorite from './ButtonFavorite';
import ButtonShare from './ButtonShare';
import ButtonUseCaseEdit from './ButtonUseCaseEdit';
import Skeleton from '../Skeleton';
import useMyUseCases from '../../hooks/useCaseBuilder/useMyUseCases';
import { UseCaseInputExample, FileLimit } from 'generative-ai-use-cases';
import {
  NOLABEL,
  extractPlaceholdersFromPromptTemplate,
  getItemsFromPlaceholders,
  getTextFormItemsFromItems,
  getTextFormUniqueLabels,
} from '../../utils/UseCaseBuilderUtils';
import useRagKnowledgeBaseApi from '../../hooks/useRagKnowledgeBaseApi';
import useRagApi from '../../hooks/useRagApi';
import useFiles from '../../hooks/useFiles';
import ZoomUpImage from '../ZoomUpImage';
import ZoomUpVideo from '../ZoomUpVideo';
import FileCard from '../FileCard';
import { PiPaperclip, PiSpinnerGap } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';

const ragEnabled: boolean = import.meta.env.VITE_APP_RAG_ENABLED === 'true';
const ragKnowledgeBaseEnabled: boolean =
  import.meta.env.VITE_APP_RAG_KNOWLEDGE_BASE_ENABLED === 'true';

// Match pages/ChatPage.tsx
// If a difference occurs, update it
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
  maxVideoFileSizeMB: 25, // 25 MB for base64 input (TODO: up to 1 GB through S3)
};

type Props = {
  modelId?: string;
  title: string;
  promptTemplate: string;
  description?: string;
  inputExamples?: UseCaseInputExample[];
  fixedModelId: string;
  fileUpload: boolean;
  isLoading?: boolean;
} & (
  | {
      previewMode?: false;
      useCaseId: string;
      isFavorite: boolean;
      isShared: boolean;
      canEdit?: boolean;
      onToggleFavorite: () => void;
      onToggleShared: () => void;
    }
  | {
      previewMode: true;
    }
);

type StateType = {
  text: string;
  setText: (s: string) => void;
  values: { [key: string]: string };
  setValue: (label: string, value: string) => void;
  clear: (uniqueLabels: string[]) => void;
};

const useUseCaseBuilderViewState = create<StateType>((set, get) => {
  const INIT_STATE = {
    text: '',
    values: {},
  };
  return {
    ...INIT_STATE,
    setText: (s: string) => {
      set(() => ({
        text: s,
      }));
    },
    setValue: (label, value) => {
      set(() => ({
        values: produce(get().values, (draft) => {
          draft[label] = value;
        }),
      }));
    },
    clear: (uniqueLabels: string[]) => {
      set({
        ...INIT_STATE,
        values: uniqueLabels.reduce(
          (obj, label) => Object.assign(obj, { [label]: '' }),
          {}
        ),
      });
    },
  };
});

const UseCaseBuilderView: React.FC<Props> = (props) => {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const { text, setText, values, setValue, clear } =
    useUseCaseBuilderViewState();
  const {
    getModelId,
    setModelId,
    loading,
    setLoading,
    messages,
    postChat,
    continueGeneration,
    clear: clearChat,
    getStopReason,
  } = useChat(pathname);
  const modelId = useMemo(() => {
    if (props.fixedModelId !== '') {
      return props.fixedModelId;
    } else {
      return getModelId();
    }
  }, [getModelId, props.fixedModelId]);
  const { modelIds: availableModels } = MODELS;
  const { setTypingTextInput, typingTextOutput } = useTyping(loading);
  const { updateRecentUseUseCase } = useMyUseCases();
  const { retrieve: retrieveKendra } = useRagApi();
  const { retrieve: retrieveKnowledgeBase } = useRagKnowledgeBaseApi();
  const {
    uploadedFiles,
    uploadFiles,
    checkFiles,
    deleteUploadedFile,
    uploading,
    errorMessages: fileErrorMessages,
    clear: clearFiles,
  } = useFiles(pathname);
  const stopReason = getStopReason();
  const [isOver, setIsOver] = useState(false);

  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  const placeholders = useMemo(() => {
    return extractPlaceholdersFromPromptTemplate(props.promptTemplate);
  }, [props.promptTemplate]);

  const items = useMemo(() => {
    return getItemsFromPlaceholders(placeholders);
  }, [placeholders]);

  const textFormItems = useMemo(() => {
    return getTextFormItemsFromItems(items);
  }, [items]);

  const selectItems = useMemo(() => {
    return textFormItems.filter((i) => i.inputType === 'select');
  }, [textFormItems]);

  const textFormUniqueLabels = useMemo(() => {
    return getTextFormUniqueLabels(textFormItems);
  }, [textFormItems]);

  useEffect(() => {
    clear(textFormUniqueLabels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textFormUniqueLabels]);

  useEffect(() => {
    for (const item of selectItems) {
      if (
        item.options &&
        item.options.length > 0 &&
        values[item.label] === ''
      ) {
        setValue(item.label, item.options.split(',')[0]);
      }
    }
  }, [selectItems, values, setValue]);

  useEffect(() => {
    setModelId(
      availableModels.includes(props.modelId ?? '')
        ? props.modelId!
        : availableModels[0]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableModels, props.modelId, pathname]);

  useEffect(() => {
    setTypingTextInput(text);
  }, [text, setTypingTextInput]);

  // Display the real-time response
  useEffect(() => {
    if (messages.length === 0) return;
    const _lastMessage = messages[messages.length - 1];
    if (_lastMessage.role !== 'assistant') return;
    const _response = messages[messages.length - 1].content;
    setText(_response.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    const retrieveKendraItems = items.filter(
      (i) => i.inputType === 'retrieveKendra'
    );
    const retrieveKnowledgeBaseItems = items.filter(
      (i) => i.inputType === 'retrieveKnowledgeBase'
    );
    const hasKendra = retrieveKendraItems.length > 0;
    const hasKnowledgeBase = retrieveKnowledgeBaseItems.length > 0;
    const tmpErrorMessages = [];

    if (hasKendra && !ragEnabled) {
      tmpErrorMessages.push(t('useCaseBuilder.error.rag_kendra_not_enabled'));
    }

    if (hasKnowledgeBase && !ragKnowledgeBaseEnabled) {
      tmpErrorMessages.push(
        t('useCaseBuilder.error.rag_knowledge_base_not_enabled')
      );
    }

    for (const item of retrieveKendraItems) {
      const textForm = textFormItems.find((i) => i.label === item.label);

      if (!textForm) {
        tmpErrorMessages.push(
          t('useCaseBuilder.error.missing_text_form', {
            label: item.label === NOLABEL ? '' : ':' + item.label,
          })
        );
      }
    }

    for (const item of retrieveKnowledgeBaseItems) {
      const textForm = textFormItems.find((i) => i.label === item.label);

      if (!textForm) {
        tmpErrorMessages.push(
          t('useCaseBuilder.error.missing_kb_text_form', {
            label: item.label === NOLABEL ? '' : ':' + item.label,
          })
        );
      }
    }

    for (const item of selectItems) {
      if (!item.options || item.options.length === 0) {
        tmpErrorMessages.push(t('useCaseBuilder.error.missing_select_options'));
      } else {
        const options = item.options.split(',');
        const emptyOptions = options.filter((o) => o === '');

        if (emptyOptions.length > 0) {
          tmpErrorMessages.push(
            t('useCaseBuilder.error.empty_select_options', {
              label: item.label,
            })
          );
        }

        const uniqueOptions = options.filter(
          (elem, idx, self) => self.findIndex((e) => e === elem) === idx
        );

        if (options.length !== uniqueOptions.length) {
          tmpErrorMessages.push(
            t('useCaseBuilder.error.duplicate_select_options', {
              label: item.label,
            })
          );
        }
      }
    }

    tmpErrorMessages.push(...fileErrorMessages);

    setErrorMessages(tmpErrorMessages);
  }, [
    setErrorMessages,
    items,
    textFormItems,
    fileErrorMessages,
    selectItems,
    t,
  ]);

  const onClickExec = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setText('');

    let prompt = props.promptTemplate;

    for (const textFormItem of textFormItems) {
      const sameLabelItems = items.filter(
        (i) => i.label === textFormItem.label
      );

      for (const item of sameLabelItems) {
        let placeholder;

        if (item.label !== NOLABEL) {
          if (item.options) {
            placeholder = `{{${item.inputType}:${item.label}:${item.options}}}`;
          } else {
            placeholder = `{{${item.inputType}:${item.label}}}`;
          }
        } else {
          placeholder = `{{${item.inputType}}}`;
        }

        if (item.inputType === 'text' || item.inputType === 'select') {
          prompt = prompt.replace(
            new RegExp(placeholder, 'g'),
            values[item.label]
          );
        } else if (item.inputType === 'form') {
          prompt = prompt.replace(new RegExp(placeholder, 'g'), '');
        } else if (item.inputType === 'retrieveKendra') {
          if (ragEnabled && values[item.label].length > 0) {
            const res = await retrieveKendra(values[item.label]);
            const resJson = JSON.stringify(res.data.ResultItems);
            prompt = prompt.replace(new RegExp(placeholder, 'g'), resJson);
          } else {
            prompt = prompt.replace(new RegExp(placeholder, 'g'), '');
          }
        } else if (item.inputType === 'retrieveKnowledgeBase') {
          if (ragKnowledgeBaseEnabled && values[item.label].length > 0) {
            const res = await retrieveKnowledgeBase(values[item.label]);
            const resJson = JSON.stringify(res.data.retrievalResults);
            prompt = prompt.replace(new RegExp(placeholder, 'g'), resJson);
          } else {
            prompt = prompt.replace(new RegExp(placeholder, 'g'), '');
          }
        }
      }
    }

    postChat(
      prompt,
      true,
      undefined,
      undefined,
      undefined,
      uploadedFiles.length > 0 ? uploadedFiles : undefined
    );
    if (!props.previewMode) {
      updateRecentUseUseCase(props.useCaseId);
    }
  }, [
    loading,
    items,
    textFormItems,
    postChat,
    props,
    updateRecentUseUseCase,
    values,
    setLoading,
    retrieveKendra,
    retrieveKnowledgeBase,
    setText,
    uploadedFiles,
  ]);

  // Reset
  const onClickClear = useCallback(() => {
    clear(textFormUniqueLabels);
    clearChat();
    clearFiles();
  }, [clear, clearChat, clearFiles, textFormUniqueLabels]);

  const disabledExec = useMemo(() => {
    if (props.isLoading || loading) {
      return true;
    }

    if (errorMessages.length > 0) {
      return true;
    }

    return false;
  }, [props.isLoading, loading, errorMessages]);

  const fillInputsFromExamples = useCallback(
    (examples: Record<string, string>) => {
      Object.entries(examples).forEach(([key, value]) => {
        setValue(key, value);
      });
    },
    [setValue]
  );

  const accept = useMemo(() => {
    if (!modelId) return [];
    const feature = MODELS.modelFeatureFlags[modelId];
    return [
      ...(feature.doc ? fileLimit.accept.doc : []),
      ...(feature.image ? fileLimit.accept.image : []),
      ...(feature.video ? fileLimit.accept.video : []),
    ];
  }, [modelId]);

  useEffect(() => {
    checkFiles(fileLimit, accept);
  }, [checkFiles, accept]);

  const fileInput = useRef<HTMLInputElement | null>(null);

  const onChangeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      uploadFiles(Array.from(files), fileLimit, accept);

      if (fileInput.current) {
        fileInput.current.value = '';
      }
    }
  };

  const deleteFile = useCallback(
    (fileId: string) => {
      if (fileLimit && accept) {
        deleteUploadedFile(fileId, fileLimit, accept);
      }
    },
    [deleteUploadedFile, accept]
  );

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
      // Upload the file
      uploadFiles(Array.from(event.dataTransfer.files), fileLimit, accept);
    }
  };

  const handlePaste = async (pasteEvent: React.ClipboardEvent) => {
    const fileList = pasteEvent.clipboardData.items || [];
    const files = Array.from(fileList)
      .filter((file) => file.kind === 'file')
      .map((file) => file.getAsFile() as File);
    if (files.length > 0 && fileLimit && accept) {
      // Upload the file
      uploadFiles(Array.from(files), fileLimit, accept);
      // Because the file name is also pasted when a file is pasted, prevent the default behavior
      pasteEvent.preventDefault();
    }
    // If there is no file, the default behavior (paste text)
  };

  return (
    <div
      onDragOver={props.fileUpload ? handleDragOver : undefined}
      onDragLeave={props.fileUpload ? handleDragLeave : undefined}
      onPaste={props.fileUpload ? handlePaste : undefined}
      className="relative">
      {isOver && props.fileUpload && (
        <div
          onDrop={handleDrop}
          className="absolute inset-0 z-[999] bg-slate-300 p-10 text-center">
          <div className="flex h-full w-full items-center justify-center outline-dashed">
            <div className="font-bold">{t('chat.drop_files')}</div>
          </div>
        </div>
      )}
      <div className="mb-4 flex flex-col-reverse text-xl font-semibold md:flex-row">
        {!props.previewMode && <div className="flex-1" />}
        <div
          className={`${props.previewMode ? '' : 'hidden lg:block'} flex flex-row justify-center`}>
          {props.isLoading
            ? t('common.loading')
            : props.title
              ? props.title
              : t('useCaseBuilder.untitledUseCase')}
        </div>
        {!props.previewMode && (
          <div className="mb-2 flex min-w-48 flex-1 flex-row items-start justify-end md:mb-0">
            <div className="flex items-center">
              <ButtonFavorite
                isFavorite={props.isFavorite}
                disabled={props.isLoading}
                onClick={props.onToggleFavorite}
              />

              {props.canEdit && (
                <>
                  <ButtonUseCaseEdit useCaseId={props.useCaseId} />
                  <ButtonShare
                    className="ml-2"
                    isShared={props.isShared}
                    disabled={props.isLoading}
                    onClick={props.onToggleShared}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {errorMessages.length > 0 &&
        errorMessages.map((m, idx) => (
          <div
            key={idx}
            className="text-aws-squid-ink mb-2 rounded bg-red-200 p-2 text-sm">
            {m}
          </div>
        ))}

      {props.description && (
        <div className="pb-4 text-sm text-gray-600">{props.description}</div>
      )}

      {!props.isLoading && props.fixedModelId === '' && (
        <div className="mb-2 flex w-full flex-col justify-between sm:flex-row">
          <Select
            value={modelId}
            onChange={setModelId}
            options={availableModels.map((m) => {
              return { value: m, label: m };
            })}
          />
        </div>
      )}

      {props.isLoading && (
        <div className="my-3 flex flex-col gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}
      {!props.isLoading && (
        <>
          <div className="flex flex-col ">
            {textFormItems.map((item, idx) => (
              <div key={idx}>
                {(item.inputType === 'text' || item.inputType === 'form') && (
                  <Textarea
                    label={item.label !== NOLABEL ? item.label : undefined}
                    rows={item.inputType === 'text' ? 2 : 1}
                    value={values[item.label]}
                    onChange={(v) => {
                      setValue(item.label, v);
                    }}
                  />
                )}
                {item.inputType === 'select' && (
                  <Select
                    label={item.label !== NOLABEL ? item.label : undefined}
                    value={values[item.label] ?? ''}
                    options={
                      item.options?.split(',')?.map((v: string) => {
                        return { value: v, label: v };
                      }) ?? []
                    }
                    onChange={(value) => {
                      setValue(item.label, value);
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {props.fileUpload && (
            <div className="mb-3 flex flex-col">
              <label className="w-fit">
                <input
                  hidden
                  type="file"
                  accept={accept.join(',')}
                  onChange={onChangeFile}
                  ref={fileInput}
                />
                <div
                  className={`${uploading ? 'bg-gray-300' : 'bg-aws-smile cursor-pointer '} flex w-fit items-center justify-center rounded-lg border px-2 py-1 text-white`}>
                  {uploading ? (
                    <PiSpinnerGap className="animate-spin" />
                  ) : (
                    <PiPaperclip />
                  )}
                  {t('useCaseBuilder.attach_file')}
                </div>
              </label>

              {uploadedFiles.length > 0 && (
                <div className="my-2 flex flex-wrap gap-2">
                  {uploadedFiles.map((uploadedFile, idx) => {
                    if (uploadedFile.type === 'image') {
                      return (
                        <ZoomUpImage
                          key={idx}
                          src={uploadedFile.base64EncodedData}
                          loading={uploadedFile.uploading}
                          deleting={uploadedFile.deleting}
                          size="s"
                          error={uploadedFile.errorMessages.length > 0}
                          onDelete={() => {
                            deleteFile(uploadedFile.id ?? '');
                          }}
                        />
                      );
                    } else if (uploadedFile.type === 'video') {
                      return (
                        <ZoomUpVideo
                          key={idx}
                          src={uploadedFile.base64EncodedData}
                          loading={uploadedFile.uploading}
                          deleting={uploadedFile.deleting}
                          size="s"
                          error={uploadedFile.errorMessages.length > 0}
                          onDelete={() => {
                            deleteFile(uploadedFile.id ?? '');
                          }}
                        />
                      );
                    } else {
                      return (
                        <FileCard
                          key={idx}
                          filename={uploadedFile.name}
                          loading={uploadedFile.uploading}
                          deleting={uploadedFile.deleting}
                          size="s"
                          error={uploadedFile.errorMessages.length > 0}
                          onDelete={() => {
                            deleteFile(uploadedFile.id ?? '');
                          }}
                        />
                      );
                    }
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div className="flex flex-1 items-end justify-between">
        <div>
          {props.inputExamples && props.inputExamples.length > 0 && (
            <>
              <div className="mb-1 text-sm font-bold text-gray-600">
                {t('useCaseBuilder.inputExamples')}
              </div>
              <div className="flex flex-wrap gap-2">
                {props.inputExamples.map((inputExample, idx) => {
                  return (
                    <button
                      key={idx}
                      className="cursor-pointer rounded-full border px-4 py-1 text-sm text-gray-600 hover:bg-gray-100"
                      onClick={() => {
                        fillInputsFromExamples(inputExample.examples);
                      }}>
                      {inputExample.title
                        ? inputExample.title
                        : t('useCaseBuilder.untitled')}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0 gap-3 ">
          {stopReason === 'max_tokens' && (
            <Button onClick={continueGeneration}>
              {t('translate.continue_output')}
            </Button>
          )}

          <Button
            outlined
            onClick={onClickClear}
            disabled={props.isLoading || loading}>
            {t('common.clear')}
          </Button>

          <Button onClick={onClickExec} disabled={disabledExec}>
            {t('common.execute')}
          </Button>
        </div>
      </div>

      <div className="mt-5 rounded border border-black/30 p-1.5">
        <Markdown>{typingTextOutput}</Markdown>
        {!loading && text === '' && (
          <div className="text-gray-500">
            {t('useCaseBuilder.resultPlaceholder')}
          </div>
        )}
        {loading && (
          <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
        )}
        <div className="flex w-full justify-end">
          <ButtonCopy text={text} interUseCasesKey="text"></ButtonCopy>
        </div>
      </div>
    </div>
  );
};

export default UseCaseBuilderView;
