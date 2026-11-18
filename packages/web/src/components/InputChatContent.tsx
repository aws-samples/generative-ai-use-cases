import React, { useCallback, useEffect, useMemo } from 'react';
import ButtonSend from './ButtonSend';
import ButtonToggle from './ButtonToggle';
import Textarea from './Textarea';
import ZoomUpImage from './ZoomUpImage';
import ZoomUpVideo from './ZoomUpVideo';
import useChat from '../hooks/useChat';
import { useLocation } from 'react-router-dom';
import Button from './Button';
import ButtonIcon from './ButtonIcon';
import {
  PiArrowsCounterClockwise,
  PiPaperclip,
  PiSpinnerGap,
  PiSlidersHorizontal,
  PiClockCountdownLight,
} from 'react-icons/pi';
import useFiles from '../hooks/useFiles';
import FileCard from './FileCard';
import { FileLimit } from 'generative-ai-use-cases';
import { useTranslation } from 'react-i18next';
import useUserSetting from '../hooks/useUserSetting';
import Tooltip from './Tooltip';
import {
  createPastedTextFile,
  shouldAttachPastedText,
} from '../utils/pastedText';

type Props = {
  content: string;
  disabled?: boolean;
  placeholder?: string;
  description?: string;
  fullWidth?: boolean;
  resetDisabled?: boolean;
  loading?: boolean;
  isEmpty?: boolean;
  onChangeContent: (content: string) => void;
  onSend: () => void;
  sendIcon?: React.ReactNode;
  // When using it outside the bottom of the page, disable the margin bottom
  disableMarginBottom?: boolean;
  fileUpload?: boolean;
  fileLimit?: FileLimit;
  accept?: string[];
  canStop?: boolean;
  reasoning?: boolean;
  onReasoningSwitched?: () => void;
  reasoningEnabled?: boolean;
  /** Model selector in the input toolbar, reachable without scrolling up. */
  modelId?: string;
  onModelChange?: (modelId: string) => void;
  modelOptions?: { value: string; label: string }[];
} & (
  | {
      hideReset?: false;
      onReset: () => void;
    }
  | {
      hideReset: true;
    }
) & {
    setting?: boolean;
    // Shown beside the settings button, so the current setting (e.g. the
    // reasoning effort) can be seen without opening it.
    settingLabel?: string;
    onSetting?: () => void;
  };

const InputChatContent: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const { settingSubmitCmdOrCtrlEnter } = useUserSetting();
  const { pathname } = useLocation();
  const { loading: chatLoading, isEmpty: chatIsEmpty } = useChat(pathname);
  const {
    uploadedFiles,
    uploadFiles,
    checkFiles,
    deleteUploadedFile,
    uploading,
    errorMessages,
  } = useFiles(pathname);

  // When the model is changed, etc., display the error message (do not automatically delete the file)
  useEffect(() => {
    if (props.fileLimit && props.accept) {
      checkFiles(props.fileLimit, props.accept);
    }
  }, [checkFiles, props.fileLimit, props.accept]);

  const onChangeFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && props.fileLimit && props.accept) {
      // Reflect the file and upload it
      uploadFiles(Array.from(files), props.fileLimit, props.accept);
    }
  };

  const deleteFile = useCallback(
    (fileId: string) => {
      if (props.fileLimit && props.accept) {
        deleteUploadedFile(fileId, props.fileLimit, props.accept);
      }
    },
    [deleteUploadedFile, props.fileLimit, props.accept]
  );
  const handlePaste = async (pasteEvent: React.ClipboardEvent) => {
    const fileList = pasteEvent.clipboardData.items || [];
    const files = Array.from(fileList)
      .filter((file) => file.kind === 'file')
      .map((file) => file.getAsFile() as File);
    if (files.length > 0 && props.fileLimit && props.accept) {
      // Upload the file
      uploadFiles(Array.from(files), props.fileLimit, props.accept);
      // Since the file name is also pasted when the file is pasted, stop the default behavior
      pasteEvent.preventDefault();
      return;
    }

    // Long text is attached as a text file so that the message stays small
    // enough to be saved in full
    const text = pasteEvent.clipboardData.getData('text/plain');
    if (props.fileLimit && shouldAttachPastedText(text, props.accept)) {
      uploadFiles(
        [createPastedTextFile(text)],
        props.fileLimit,
        props.accept ?? []
      );
      pasteEvent.preventDefault();
    }
    // Otherwise, keep the default behavior (paste text)
  };

  const loading = useMemo(() => {
    return props.loading === undefined ? chatLoading : props.loading;
  }, [chatLoading, props.loading]);

  const disabledSend = useMemo(() => {
    return (
      (!loading && props.content.trim() === '') ||
      props.disabled ||
      uploading ||
      errorMessages.length > 0
    );
  }, [props.content, props.disabled, uploading, errorMessages, loading]);

  return (
    <div
      className={`${
        props.fullWidth ? 'w-full' : 'w-11/12 md:w-10/12 lg:w-4/6 xl:w-3/6'
      }`}>
      {props.description && (
        <p className="m-2 whitespace-pre-wrap text-xs text-gray-500">
          {props.description}
        </p>
      )}
      <div
        className={`relative flex flex-col rounded-xl border border-black/10 bg-gray-100 shadow-[0_0_30px_1px] shadow-gray-400/40 ${
          props.disableMarginBottom
            ? ''
            : settingSubmitCmdOrCtrlEnter
              ? 'mb-2'
              : 'mb-7'
        }`}>
        <div className="flex grow flex-col">
          {props.fileUpload && uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2">
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
          {errorMessages.length > 0 && (
            <div className="m-2 flex flex-wrap gap-2">
              {errorMessages.map((errorMessage, idx) => (
                <p key={idx} className="text-red-500">
                  {errorMessage}
                </p>
              ))}
            </div>
          )}
          <Textarea
            className={`scrollbar-thumb-gray-200 scrollbar-thin -mr-14 bg-transparent p-4`}
            placeholder={props.placeholder ?? t('common.enter_text')}
            noBorder
            notItem
            value={props.content}
            onChange={props.onChangeContent}
            onPaste={props.fileUpload ? handlePaste : undefined}
            onEnter={disabledSend ? undefined : props.onSend}
          />
        </div>
        <div className="m-2 flex justify-between gap-1">
          {/* min-w-0 lets the model selector shrink on narrow screens instead
              of pushing the send button out of the row. */}
          <div className="flex min-w-0 items-center gap-x-1">
            {props.fileUpload && (
              <Tooltip
                message={t('inputs.attachment')}
                position="center"
                topPosition="-top-16"
                nowrap>
                <div className="">
                  <label>
                    <input
                      hidden
                      onChange={onChangeFiles}
                      type="file"
                      accept={props.accept?.join(',')}
                      multiple
                      value={[]}
                    />
                    <div
                      className={`${uploading ? 'bg-gray-300' : 'cursor-pointer bg-white '} ${uploadedFiles.length > 0 ? 'text-aws-smile border-aws-smile' : 'border-gray-400 text-gray-400'} flex items-center justify-center rounded-xl border p-2 align-bottom text-xl`}>
                      {uploading ? (
                        <PiSpinnerGap className="animate-spin" />
                      ) : (
                        <PiPaperclip />
                      )}
                    </div>
                  </label>
                </div>
              </Tooltip>
            )}
            {props.reasoning && (
              <Tooltip
                message={t('inputs.reasoning')}
                position="center"
                topPosition="-top-16"
                nowrap>
                <ButtonToggle
                  onSwitch={props.onReasoningSwitched ?? (() => {})}
                  icon={<PiClockCountdownLight />}
                  isEnabled={!!props.reasoningEnabled}
                />
              </Tooltip>
            )}
            {props.modelId && props.onModelChange && props.modelOptions && (
              // A native select is as wide as its longest option. The hidden
              // span holds only the selected label, with the same padding,
              // border and font, so the box fits the current model; the
              // select is laid over it.
              <div className="relative min-w-0 max-w-[160px] sm:max-w-[240px]">
                <span
                  aria-hidden="true"
                  className="invisible block h-[38px] truncate whitespace-nowrap border pl-3 pr-8 text-xs leading-[36px]">
                  {props.modelOptions.find((o) => o.value === props.modelId)
                    ?.label ?? props.modelId}
                </span>
                <select
                  aria-label={t('inputs.model')}
                  title={t('inputs.model')}
                  // h-[38px] matches the attachment button (20px icon + p-2 +
                  // border). pr-8 leaves room for the caret that
                  // @tailwindcss/forms draws as a background image on the right.
                  className="absolute inset-0 h-[38px] w-full truncate rounded-xl border border-gray-400 bg-white py-0 pl-3 pr-8 text-xs text-gray-700 disabled:opacity-50"
                  // Switching models mid-response would change the model used
                  // for the rest of the turn and for the title.
                  disabled={loading}
                  value={props.modelId}
                  onChange={(e) => props.onModelChange!(e.target.value)}>
                  {props.modelOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-x-2">
            {props.setting && (
              <Tooltip
                message={t('inputs.setting')}
                position="center"
                topPosition="-top-16"
                nowrap>
                <ButtonIcon
                  onClick={props.onSetting ?? (() => {})}
                  className="text-gray-500">
                  <PiSlidersHorizontal />
                  {props.settingLabel && (
                    <span className="ml-1 text-xs">{props.settingLabel}</span>
                  )}
                </ButtonIcon>
              </Tooltip>
            )}
            <ButtonSend
              className=""
              disabled={disabledSend}
              loading={loading || uploading}
              onClick={props.onSend}
              icon={props.sendIcon}
              canStop={props.canStop}
            />
          </div>
        </div>

        {!(props.isEmpty ?? chatIsEmpty) &&
          !props.resetDisabled &&
          !props.hideReset && (
            <Button
              className="absolute -top-14 right-0 p-2 text-sm"
              outlined
              disabled={loading}
              onClick={props.onReset}>
              <PiArrowsCounterClockwise className="mr-2" />
              {t('common.start_over')}
            </Button>
          )}
      </div>

      {/* Show keyboard shortcut hint when cmd/ctrl+enter setting is enabled */}
      {settingSubmitCmdOrCtrlEnter && (
        <div className="mb-2 text-right text-xs text-gray-500">
          {navigator.platform.toLowerCase().includes('mac')
            ? t('chat.hint_cmd_enter')
            : t('chat.hint_ctrl_enter')}
        </div>
      )}
    </div>
  );
};

export default InputChatContent;
