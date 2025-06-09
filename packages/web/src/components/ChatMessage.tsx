import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Markdown from './Markdown';
import ButtonCopy from './ButtonCopy';
import ButtonFeedback from './ButtonFeedback';
import ButtonIcon from './ButtonIcon';
import ZoomUpImage from './ZoomUpImage';
import ZoomUpVideo from './ZoomUpVideo';
import {
  PiUserFill,
  PiChalkboardTeacher,
  PiFloppyDisk,
  PiArrowClockwise,
  PiArrowUp,
  PiArrowDown,
  PiCloudArrowUp,
  PiCloudArrowDown,
  PiNotePencil,
  PiCheck,
  PiX,
} from 'react-icons/pi';
import { BaseProps } from '../@types/common';
import { ShownMessage, UpdateFeedbackRequest } from 'generative-ai-use-cases';
import BedrockIcon from '../assets/bedrock.svg?react';
import useChat from '../hooks/useChat';
import useTyping from '../hooks/useTyping';
import FileCard from './FileCard';
import FeedbackForm from './FeedbackForm';
import Textarea from './Textarea';
import useFiles from '../hooks/useFiles';
import { useTranslation } from 'react-i18next';

type Props = BaseProps & {
  idx?: number;
  chatContent?: ShownMessage;
  loading?: boolean;
  hideFeedback?: boolean;
  hideSaveSystemContext?: boolean;
  setSaveSystemContext?: (s: string) => void;
  setShowSystemContextModal?: (value: boolean) => void;
  allowRetry?: boolean;
  editable?: boolean;
  retryGeneration?: () => void;
  onCommitEdit?: (modifiedPrompt: string) => void;
};

const ChatMessage: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const chatContent = useMemo(() => {
    return props.chatContent;
  }, [props]);

  const { pathname } = useLocation();
  const { sendFeedback } = useChat(pathname);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showThankYouMessage, setShowThankYouMessage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState('');
  const [isOpenTrace, setIsOpenTrace] = useState(false);
  const { getFileDownloadSignedUrl } = useFiles(pathname);

  const { setTypingTextInput, typingTextOutput } = useTyping(
    chatContent?.role === 'assistant' && props.loading
  );

  useEffect(() => {
    if (chatContent?.content !== undefined && chatContent?.content !== null) {
      setTypingTextInput(chatContent?.content);
    }
  }, [chatContent, setTypingTextInput]);

  const [signedUrls, setSignedUrls] = useState<string[]>([]);

  useEffect(() => {
    if (chatContent?.extraData) {
      // To display the loading, prepare as many elements as the number of images, and set undefined as the initial value
      setSignedUrls(new Array(chatContent.extraData.length).fill(undefined));
      Promise.all(
        chatContent.extraData.map(async (file) => {
          if (file.source.type === 's3') {
            return await getFileDownloadSignedUrl(file.source.data, true);
          } else {
            return file.source.data;
          }
        })
      ).then((results) => setSignedUrls(results));
    } else {
      setSignedUrls([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatContent]);

  const disabled = useMemo(() => {
    return isSendingFeedback || !props.chatContent?.id;
  }, [isSendingFeedback, props]);

  const onSendFeedback = async (feedbackData: UpdateFeedbackRequest) => {
    if (!disabled) {
      setIsSendingFeedback(true);
      if (feedbackData.feedback !== chatContent?.feedback) {
        if (feedbackData.feedback !== 'bad') {
          setShowFeedbackForm(false);
        }
        await sendFeedback(feedbackData);
      } else {
        await sendFeedback({
          createdDate: props.chatContent!.createdDate!,
          feedback: 'none',
        });
        setShowFeedbackForm(false);
      }
      setIsSendingFeedback(false);
    }
  };

  const handleFeedbackClick = (feedback: string) => {
    // When the button is pressed, send the detailed feedback from the user to the DB before it is displayed.
    onSendFeedback({
      createdDate: props.chatContent!.createdDate!,
      feedback: feedback,
    });
    if (feedback === 'bad' && chatContent?.feedback !== 'bad') {
      setShowFeedbackForm(true);
    }
  };

  const handleFeedbackFormSubmit = async (
    reasons: string[],
    detailedFeedback: string
  ) => {
    await sendFeedback({
      createdDate: props.chatContent!.createdDate!,
      feedback: 'bad',
      reasons: reasons,
      detailedFeedback: detailedFeedback,
    });
    setShowFeedbackForm(false);
    setShowThankYouMessage(true);
    setTimeout(() => {
      setShowThankYouMessage(false);
    }, 3000);
  };

  const handleFeedbackFormCancel = () => {
    setShowFeedbackForm(false);
  };

  const toggleOpenTrace = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    e.preventDefault();
    setIsOpenTrace(!isOpenTrace);
  };

  return (
    <div
      className={`flex justify-center ${
        chatContent?.role === 'assistant' || chatContent?.role === 'system'
          ? 'bg-gray-100/70'
          : ''
      }`}>
      <div
        className={`${
          props.className ?? ''
        } flex w-full flex-col justify-between p-3 md:w-11/12 lg:w-5/6 xl:w-4/6`}>
        <div className="flex w-full">
          {chatContent?.role === 'user' && (
            <div className="bg-aws-sky h-min rounded p-2 text-xl text-white">
              <PiUserFill />
            </div>
          )}
          {chatContent?.role === 'assistant' && (
            <div className="bg-aws-ml h-min rounded p-1">
              <BedrockIcon className="size-7 fill-white" />
            </div>
          )}
          {chatContent?.role === 'system' && (
            <div className="bg-aws-sky h-min rounded p-2 text-xl text-white">
              <PiChalkboardTeacher />
            </div>
          )}

          <div className="ml-5 w-full pr-8 lg:pr-14">
            {chatContent?.trace && (
              <div className="mb-2 rounded border p-2">
                <details className="cursor-pointer" open={isOpenTrace}>
                  <summary className="text-sm" onClick={toggleOpenTrace}>
                    <div className="inline-flex gap-1">
                      {t('common.trace')}
                      {props.loading && !chatContent?.content && (
                        <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
                      )}
                    </div>
                  </summary>
                  <Markdown prefix={`${props.idx}-trace`}>
                    {chatContent.trace}
                  </Markdown>
                </details>

                {!isOpenTrace &&
                  props.loading &&
                  !chatContent?.content &&
                  chatContent?.traceInlineMessage && (
                    <Markdown
                      className="mt-2"
                      prefix={`${props.idx}-last-trace`}>
                      {chatContent.traceInlineMessage}
                    </Markdown>
                  )}
              </div>
            )}

            {chatContent?.extraData && chatContent.extraData.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {chatContent.extraData.map((data, idx) => {
                  if (data.type === 'image') {
                    return (
                      <ZoomUpImage
                        key={idx}
                        src={signedUrls[idx]}
                        size="m"
                        loading={!signedUrls[idx]}
                      />
                    );
                  } else if (data.type === 'file') {
                    return (
                      <FileCard
                        key={idx}
                        filename={data.name}
                        url={signedUrls[idx]}
                        loading={!signedUrls[idx]}
                        size="m"
                      />
                    );
                  } else if (data.type === 'video') {
                    return (
                      <ZoomUpVideo key={idx} src={signedUrls[idx]} size="m" />
                    );
                  }
                })}
              </div>
            )}
            {chatContent?.role === 'user' && (
              <>
                {editing ? (
                  <Textarea value={editingPrompt} onChange={setEditingPrompt} />
                ) : (
                  <div className="whitespace-pre-wrap">{typingTextOutput}</div>
                )}
              </>
            )}
            {chatContent?.role === 'assistant' && (
              <Markdown prefix={`${props.idx}`}>
                {typingTextOutput +
                  `${
                    props.loading && (chatContent?.content ?? '') !== ''
                      ? '▍'
                      : ''
                  }`}
              </Markdown>
            )}
            {chatContent?.role === 'system' && (
              <div className="whitespace-pre-wrap">{typingTextOutput}</div>
            )}
            {props.loading && (chatContent?.content ?? '') === '' && (
              /* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */
              <div className="animate-pulse">▍</div>
            )}

            {chatContent?.role === 'assistant' && (
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <div className="text-right text-xs text-gray-400 lg:mb-0">
                  {chatContent?.llmType}
                </div>
                {chatContent?.metadata && (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <PiArrowUp title="Input tokens" />
                    {chatContent.metadata.usage.inputTokens}
                    <PiArrowDown title="Output tokens" />
                    {chatContent.metadata.usage.outputTokens}
                    {chatContent.metadata.usage.cacheWriteInputTokens && (
                      <>
                        <PiCloudArrowUp title="Cache write input tokens" />
                        {chatContent.metadata.usage.cacheWriteInputTokens}
                      </>
                    )}
                    {chatContent.metadata.usage.cacheReadInputTokens && (
                      <>
                        <PiCloudArrowDown title="Cache read input tokens" />
                        {chatContent.metadata.usage.cacheReadInputTokens}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-start justify-end pr-8 lg:pr-14 print:hidden">
          {chatContent?.role === 'system' && !props.hideSaveSystemContext && (
            <ButtonIcon
              className="text-gray-400"
              onClick={() => {
                props.setSaveSystemContext?.(chatContent?.content || '');
                props.setShowSystemContextModal?.(true);
              }}>
              <PiFloppyDisk />
            </ButtonIcon>
          )}
          {chatContent?.role === 'user' && props.editable && (
            <>
              {editing ? (
                <>
                  <ButtonIcon
                    onClick={() => {
                      setEditing(false);
                    }}>
                    <PiX className="text-red-500" />
                  </ButtonIcon>
                  <ButtonIcon
                    onClick={() => {
                      if (props.onCommitEdit) {
                        setEditing(false);
                        props.onCommitEdit(editingPrompt);
                      }
                    }}>
                    <PiCheck className="text-green-500" />
                  </ButtonIcon>
                </>
              ) : (
                <ButtonIcon
                  onClick={() => {
                    setEditingPrompt(chatContent?.content ?? '');
                    setEditing(true);
                  }}>
                  <PiNotePencil className="text-gray-400" />
                </ButtonIcon>
              )}
            </>
          )}
          {chatContent?.role === 'assistant' &&
            !props.loading &&
            !props.hideFeedback && (
              <>
                {props.allowRetry && (
                  <ButtonIcon
                    className="mr-0.5 text-gray-400"
                    onClick={() => props.retryGeneration?.()}>
                    <PiArrowClockwise />
                  </ButtonIcon>
                )}
                <ButtonCopy
                  className="mr-0.5 text-gray-400"
                  text={chatContent?.content || ''}
                />
                {chatContent && (
                  <>
                    <ButtonFeedback
                      className="mx-0.5"
                      feedback="good"
                      message={chatContent}
                      disabled={disabled}
                      onClick={() => {
                        handleFeedbackClick('good');
                      }}
                    />
                    <ButtonFeedback
                      className="ml-0.5"
                      feedback="bad"
                      message={chatContent}
                      disabled={disabled}
                      onClick={() => handleFeedbackClick('bad')}
                    />
                  </>
                )}
              </>
            )}
        </div>
        <div>
          {showFeedbackForm && (
            <FeedbackForm
              onSubmit={handleFeedbackFormSubmit}
              onCancel={handleFeedbackFormCancel}
            />
          )}
          {showThankYouMessage && (
            <div className="mt-2 rounded-md bg-green-100 p-2 text-center text-green-700">
              {t('common.feedback_received')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
