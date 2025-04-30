import React, { useCallback, useEffect, useMemo } from 'react';
import ButtonSend from './ButtonSend';
import Textarea from './Textarea';
import ZoomUpImage from './ZoomUpImage';
import ZoomUpVideo from './ZoomUpVideo';
import useChat from '../hooks/useChat';
import { useLocation } from 'react-router-dom';
import Button from './Button';
import {
  PiArrowsCounterClockwise,
  PiPaperclip,
  PiSpinnerGap,
  PiSlidersHorizontal,
} from 'react-icons/pi';
import useFiles from '../hooks/useFiles';
import FileCard from './FileCard';
import { FileLimit } from 'generative-ai-use-cases';
import { useTranslation } from 'react-i18next';

type Props = {
  content: string;
  disabled?: boolean;
  placeholder?: string;
  description?: string;
  fullWidth?: boolean;
  resetDisabled?: boolean;
  loading?: boolean;
  onChangeContent: (content: string) => void;
  onSend: () => void;
  sendIcon?: React.ReactNode;
  // When using it outside the bottom of the page, disable the margin bottom
  disableMarginBottom?: boolean;
  fileUpload?: boolean;
  fileLimit?: FileLimit;
  accept?: string[];
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
    onSetting?: () => void;
  };

const InputChatContent: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { loading: chatLoading, isEmpty } = useChat(pathname);
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
    }
    // If there is no file, stop the default behavior (paste text)
  };

  const loading = useMemo(() => {
    return props.loading === undefined ? chatLoading : props.loading;
  }, [chatLoading, props.loading]);

  const disabledSend = useMemo(() => {
    return (
      props.content.trim() === '' ||
      props.disabled ||
      uploading ||
      errorMessages.length > 0
    );
  }, [props.content, props.disabled, uploading, errorMessages]);

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
        className={`relative flex items-end rounded-xl border border-black/10 bg-gray-100 shadow-[0_0_30px_1px] shadow-gray-400/40 ${
          props.disableMarginBottom ? '' : 'mb-7'
        }`}>
        <div className="flex grow flex-col">
          {props.fileUpload && uploadedFiles.length > 0 && (
            <div className="m-2 flex flex-wrap gap-2">
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
            className={`scrollbar-thumb-gray-200 scrollbar-thin m-2 -mr-14 bg-transparent`}
            placeholder={props.placeholder ?? t('common.enter_text')}
            noBorder
            notItem
            value={props.content}
            onChange={props.onChangeContent}
            onPaste={props.fileUpload ? handlePaste : undefined}
            onEnter={disabledSend ? undefined : props.onSend}
          />
        </div>
        <div className="m-2 flex gap-1">
          {props.fileUpload && (
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
                  className={`${uploading ? 'bg-gray-300' : 'bg-aws-smile cursor-pointer '} flex items-center justify-center rounded-xl p-2 align-bottom text-xl text-white`}>
                  {uploading ? (
                    <PiSpinnerGap className="animate-spin" />
                  ) : (
                    <PiPaperclip />
                  )}
                </div>
              </label>
            </div>
          )}
          {props.setting && (
            <ButtonSend
              className=""
              disabled={loading}
              onClick={props.onSetting ?? (() => {})}
              icon={<PiSlidersHorizontal />}
            />
          )}
          <ButtonSend
            className=""
            disabled={disabledSend}
            loading={loading || uploading}
            onClick={props.onSend}
            icon={props.sendIcon}
          />
        </div>

        {!isEmpty && !props.resetDisabled && !props.hideReset && (
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
    </div>
  );
};

export default InputChatContent;
