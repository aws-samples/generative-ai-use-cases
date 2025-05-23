import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { useLocation } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import ButtonIcon from '../components/ButtonIcon';
import Textarea from '../components/Textarea';
import ExpandableField from '../components/ExpandableField';
import Select from '../components/Select';
import Markdown from '../components/Markdown';
import ButtonCopy from '../components/ButtonCopy';
import Switch from '../components/Switch';
import useChat from '../hooks/useChat';
import useMicrophone from '../hooks/useMicrophone';
import useTyping from '../hooks/useTyping';
import useLocalStorageBoolean from '../hooks/useLocalStorageBoolean';
import {
  PiMicrophoneBold,
  PiStopCircleBold,
  PiSpeakerSimpleHigh,
  PiSpeakerSimpleHighFill,
} from 'react-icons/pi';
import { create } from 'zustand';
import debounce from 'lodash.debounce';
import { TranslatePageQueryParams } from '../@types/navigate';
import { MODELS } from '../hooks/useModel';
import { getPrompter } from '../prompts';
import queryString from 'query-string';
import useSpeach from '../hooks/useSpeach';
import { useTranslation } from 'react-i18next';

const languages = ['en', 'ja', 'zh', 'ko', 'fr', 'es', 'de', 'th'];

type StateType = {
  sentence: string;
  setSentence: (s: string) => void;
  additionalContext: string;
  setAdditionalContext: (s: string) => void;
  language: string;
  setLanguage: (s: string) => void;
  translatedSentence: string;
  setTranslatedSentence: (s: string) => void;
  clear: () => void;
};

const useTranslatePageState = create<StateType>((set) => {
  const INIT_STATE = {
    sentence: '',
    additionalContext: '',
    language: languages[0],
    translatedSentence: '',
  };
  return {
    ...INIT_STATE,
    setSentence: (s: string) => {
      set(() => ({
        sentence: s,
      }));
    },
    setAdditionalContext: (s: string) => {
      set(() => ({
        additionalContext: s,
      }));
    },
    setLanguage: (s: string) => {
      set(() => ({
        language: s,
      }));
    },
    setTranslatedSentence: (s: string) => {
      set(() => ({
        translatedSentence: s,
      }));
    },
    clear: () => {
      set(INIT_STATE);
    },
  };
});

const TranslatePage: React.FC = () => {
  const { t } = useTranslation();
  const {
    sentence,
    setSentence,
    additionalContext,
    setAdditionalContext,
    language,
    setLanguage,
    translatedSentence,
    setTranslatedSentence,
    clear,
  } = useTranslatePageState();
  const {
    startTranscription,
    stopTranscription,
    transcriptMic,
    recording,
    clearTranscripts,
  } = useMicrophone();

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
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const modelId = getModelId();
  const prompter = useMemo(() => {
    return getPrompter(modelId);
  }, [modelId]);
  const stopReason = getStopReason();
  const [auto, setAuto] = useLocalStorageBoolean('Auto_Translate', true);
  const [audio, setAudioInput] = useState(false); // Audio input flag
  const { synthesizeSpeach, loading: speachIsLoading } = useSpeach(language);

  useEffect(() => {
    updateSystemContextByModel();
    // eslint-disable-next-line  react-hooks/exhaustive-deps
  }, [prompter]);

  // Memo variable
  const disabledExec = useMemo(() => {
    return sentence === '' || loading;
  }, [sentence, loading]);

  useEffect(() => {
    const _modelId = !modelId ? availableModels[0] : modelId;
    if (search !== '') {
      const params = queryString.parse(search) as TranslatePageQueryParams;
      setSentence(params.sentence ?? '');
      setAdditionalContext(params.additionalContext ?? '');
      setLanguage(params.language || languages[0]);
      setModelId(
        availableModels.includes(params.modelId ?? '')
          ? params.modelId!
          : _modelId
      );
    } else {
      setModelId(_modelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    setSentence,
    setAdditionalContext,
    setLanguage,
    modelId,
    availableModels,
    search,
  ]);

  useEffect(() => {
    setTypingTextInput(translatedSentence);
  }, [translatedSentence, setTypingTextInput]);

  // Update the comment when the article is updated
  useEffect(() => {
    if (auto) {
      // Translate after debounce
      onSentenceChange(sentence, additionalContext, language, loading);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence, language]);

  // Translate after debounce
  // Wait for 1 second after stopping input and send a translation request
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSentenceChange = useCallback(
    debounce(
      (
        _sentence: string,
        _additionalContext: string,
        _language: string,
        _loading: boolean
      ) => {
        if (_sentence === '') {
          setTranslatedSentence('');
        }
        if (_sentence !== '' && !_loading) {
          getTranslation(_sentence, _language, _additionalContext);
        }
      },
      1000
    ),
    [prompter]
  );

  // Display the response in real time
  useEffect(() => {
    if (messages.length === 0) return;
    const _lastMessage = messages[messages.length - 1];
    if (_lastMessage.role !== 'assistant') return;
    const _response = messages[messages.length - 1].content;
    setTranslatedSentence(_response.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // When the recording function fails, turn the toggle switch off
  useEffect(() => {
    if (!recording) {
      setAudioInput(false);
    }
  }, [recording]);

  // Process when the transcribe element is added. Automatically input it into the left box
  useEffect(() => {
    const combinedTranscript = transcriptMic
      .map((item) => item.transcript)
      .join('\n');
    if (combinedTranscript.length > 0) {
      setSentence(combinedTranscript);
    }
  }, [transcriptMic, setSentence]);

  // Send a request to the LLM
  const getTranslation = (
    sentence: string,
    language: string,
    context: string
  ) => {
    postChat(
      prompter.translatePrompt({
        sentence,
        language,
        context: context === '' ? undefined : context,
      }),
      true
    );
  };

  // Execute translation
  const onClickExec = useCallback(() => {
    if (loading) return;
    getTranslation(sentence, language, additionalContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence, additionalContext, loading, prompter, language]);

  // Reset
  const onClickClear = useCallback(() => {
    clear();
    clearChat();
    clearTranscripts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isSpeachPlaying, setIsSpeachPlaying] = useState(false);

  const handleSpeachEnded = useCallback(() => {
    setIsSpeachPlaying(false);
  }, [setIsSpeachPlaying]);

  const startOrStopSpeach = useCallback(async () => {
    if (speachIsLoading) return;

    // If it is playing, stop it
    if (isSpeachPlaying && audioRef.current) {
      setIsSpeachPlaying(false);

      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      return;
    }

    setIsSpeachPlaying(true);

    const speachUrl = await synthesizeSpeach(translatedSentence);
    const audio = new Audio(speachUrl!);

    audioRef.current = audio;
    audio.addEventListener('ended', handleSpeachEnded);
    audio.play();
  }, [
    translatedSentence,
    synthesizeSpeach,
    audioRef,
    setIsSpeachPlaying,
    isSpeachPlaying,
    handleSpeachEnded,
    speachIsLoading,
  ]);

  return (
    <div className="grid grid-cols-12">
      <div className="invisible col-span-12 my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('translate.title')}
      </div>
      <div className="col-span-12 col-start-1 mx-2 lg:col-span-10 lg:col-start-2 xl:col-span-10 xl:col-start-2">
        <Card label={t('translate.text_to_translate')}>
          <div className="flex w-full flex-col justify-between sm:flex-row">
            <Select
              value={modelId}
              onChange={setModelId}
              options={availableModels.map((m) => {
                return { value: m, label: modelDisplayName(m) };
              })}
            />
            <div className="col-span-12 col-start-1 mx-2 lg:col-span-10 lg:col-start-2 xl:col-span-10 xl:col-start-2">
              <Switch
                label={t('translate.auto_translate')}
                checked={auto}
                onSwitch={setAuto}
              />
            </div>
          </div>
          <div className="flex w-full flex-col lg:flex-row">
            <div className="w-full lg:w-1/2">
              <div className="flex h-12 items-center">
                {t('translate.auto_detect_language')}
                <div className="ml-2 justify-end">
                  {audio && (
                    <PiStopCircleBold
                      onClick={() => {
                        stopTranscription();
                        setAudioInput(false);
                      }}
                      className="text-aws-smile h-5 w-5 cursor-pointer"></PiStopCircleBold>
                  )}
                  {!audio && (
                    <PiMicrophoneBold
                      onClick={() => {
                        startTranscription();
                        setAudioInput(true);
                      }}
                      className="h-5 w-5 cursor-pointer"></PiMicrophoneBold>
                  )}
                </div>
              </div>

              <Textarea
                placeholder={t('translate.enter_text')}
                value={sentence}
                onChange={setSentence}
                maxHeight={-1}
                rows={5}
              />

              <ExpandableField
                label={t('translate.additional_context')}
                optional>
                <Textarea
                  placeholder={t('translate.additional_context_placeholder')}
                  value={additionalContext}
                  onChange={setAdditionalContext}
                />
              </ExpandableField>
            </div>
            <div className="w-full lg:ml-2 lg:w-1/2">
              <div className="flex h-12 items-center">
                <Select
                  notItem={true}
                  value={language}
                  options={languages.map((l) => {
                    return { value: l, label: t(`language.${l}`) };
                  })}
                  onChange={setLanguage}
                />
              </div>
              <div className="rounded border border-black/30 p-1.5">
                <Markdown>{typingTextOutput}</Markdown>
                {loading && (
                  <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
                )}
                {!loading && translatedSentence === '' && (
                  <div className="text-gray-500">
                    {t('translate.result_placeholder')}
                  </div>
                )}
                <div className="flex w-full justify-end">
                  <ButtonIcon onClick={startOrStopSpeach}>
                    {isSpeachPlaying ? (
                      <PiSpeakerSimpleHighFill />
                    ) : (
                      <PiSpeakerSimpleHigh />
                    )}
                  </ButtonIcon>
                  <ButtonCopy
                    text={translatedSentence}
                    interUseCasesKey="translatedSentence"></ButtonCopy>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-3">
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
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TranslatePage;
