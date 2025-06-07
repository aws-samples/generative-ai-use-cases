import React, {
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useState,
} from 'react';
import { create } from 'zustand';
import Card from '../components/Card';
import Button from '../components/Button';
import ButtonCopy from '../components/ButtonCopy';
import useTranscribe from '../hooks/useTranscribe';
import useMicrophone from '../hooks/useMicrophone';
import useMeetingMinutes from '../hooks/useMeetingMinutes';
import { MODELS } from '../hooks/useModel';
import { PiStopCircleBold, PiMicrophoneBold } from 'react-icons/pi';
import Switch from '../components/Switch';
import RangeSlider from '../components/RangeSlider';
import ExpandableField from '../components/ExpandableField';
import Select from '../components/Select';
import { Transcript } from 'generative-ai-use-cases';
import Textarea from '../components/Textarea';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Markdown from '../components/Markdown';

type StateType = {
  content: Transcript[];
  setContent: (c: Transcript[]) => void;
  speakerLabel: boolean;
  setSpeakerLabel: (b: boolean) => void;
  maxSpeakers: number;
  setMaxSpeakers: (n: number) => void;
  speakers: string;
  setSpeakers: (s: string) => void;
};

const useMeetingMinutesState = create<StateType>((set) => {
  return {
    content: [],
    speakerLabel: false, // Disabled by default per requirements
    maxSpeakers: 4, // Reasonable default for meetings
    speakers: '',
    setContent: (s: Transcript[]) => {
      set(() => ({
        content: s,
      }));
    },
    setSpeakerLabel: (b: boolean) => {
      set(() => ({
        speakerLabel: b,
      }));
    },
    setMaxSpeakers: (n: number) => {
      set(() => ({
        maxSpeakers: n,
      }));
    },
    setSpeakers: (s: string) => {
      set(() => ({
        speakers: s,
      }));
    },
  };
});

const MeetingMinutesPage: React.FC = () => {
  const { t } = useTranslation();
  const { loading, transcriptData, file, setFile, transcribe, clear } =
    useTranscribe();
  const {
    startTranscription,
    stopTranscription,
    transcriptMic,
    recording,
    clearTranscripts,
  } = useMicrophone();
  const {
    content,
    setContent,
    speakerLabel,
    setSpeakerLabel,
    maxSpeakers,
    setMaxSpeakers,
    speakers,
    setSpeakers,
  } = useMeetingMinutesState();
  const ref = useRef<HTMLInputElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldGenerateRef = useRef<boolean>(false);

  // Countdown state for auto-generation timer
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  // Model selection state
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const [modelId, setModelId] = useState(availableModels[0] || '');

  // Meeting minutes specific hook
  const {
    minutesStyle,
    setMinutesStyle,
    autoGenerate,
    setAutoGenerate,
    generationFrequency,
    setGenerationFrequency,
    generatedMinutes,
    lastProcessedTranscript,
    lastGeneratedTime,
    customPrompt,
    setCustomPrompt,
    loading: minutesLoading,
    generateMinutes,
    clearMinutes,
  } = useMeetingMinutes();

  // Track previous style to detect changes
  const [previousStyle, setPreviousStyle] =
    useState<typeof minutesStyle>('transcription');

  const speakerMapping = useMemo(() => {
    return Object.fromEntries(
      speakers.split(',').map((speaker, idx) => [`spk_${idx}`, speaker.trim()])
    );
  }, [speakers]);

  const formattedOutput: string = useMemo(() => {
    return content
      .map((item) =>
        item.speakerLabel
          ? `${speakerMapping[item.speakerLabel] || item.speakerLabel}: ${item.transcript}`
          : item.transcript
      )
      .join('\n');
  }, [content, speakerMapping]);

  const onChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setFile(files[0]);
    }
  };

  useEffect(() => {
    if (transcriptData && transcriptData.transcripts) {
      setContent(transcriptData.transcripts);
    }
  }, [setContent, transcriptData]);

  useEffect(() => {
    if (transcriptMic && transcriptMic.length > 0) {
      setContent(transcriptMic);
    }
  }, [setContent, transcriptMic]);

  // Watch for generation signal and trigger generation
  useEffect(() => {
    if (
      shouldGenerateRef.current &&
      autoGenerate &&
      formattedOutput.trim() !== ''
    ) {
      if (formattedOutput !== lastProcessedTranscript && !minutesLoading) {
        shouldGenerateRef.current = false; // Reset the flag
        generateMinutes(formattedOutput, modelId, (status) => {
          if (status === 'success') {
            toast.success(t('meetingMinutes.generation_success'));
          } else if (status === 'error') {
            toast.error(t('meetingMinutes.generation_error'));
          }
        });
      } else {
        shouldGenerateRef.current = false; // Reset even if we don't generate
      }
    }
  }, [
    countdownSeconds,
    autoGenerate,
    formattedOutput,
    lastProcessedTranscript,
    minutesLoading,
    generateMinutes,
    modelId,
    t,
  ]);

  // Auto-generation countdown setup
  useEffect(() => {
    // Clear existing interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Early return if auto-generate is disabled
    if (!autoGenerate || generationFrequency <= 0) {
      setCountdownSeconds(0);
      return;
    }

    // Initialize countdown
    const totalSeconds = generationFrequency * 60;
    setCountdownSeconds(totalSeconds);

    // Set up countdown timer (updates every second)
    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        const newValue = prev - 1;
        if (newValue <= 0) {
          shouldGenerateRef.current = true; // Signal generation should happen
          return totalSeconds; // Reset countdown
        }
        return newValue;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [autoGenerate, generationFrequency]);

  const disabledExec = useMemo(() => {
    return !file || loading || recording;
  }, [file, loading, recording]);

  const disableClearExec = useMemo(() => {
    return (!file && content.length === 0) || loading || recording;
  }, [content, file, loading, recording]);

  const disabledMicExec = useMemo(() => {
    return loading;
  }, [loading]);

  const onClickExec = useCallback(() => {
    if (loading) return;
    // Don't clear existing transcripts - append instead
    stopTranscription();
    clearTranscripts();
    transcribe(speakerLabel, maxSpeakers);
  }, [
    loading,
    speakerLabel,
    maxSpeakers,
    stopTranscription,
    clearTranscripts,
    transcribe,
  ]);

  const onClickClear = useCallback(() => {
    if (ref.current) {
      ref.current.value = '';
    }
    setContent([]);
    stopTranscription();
    clear();
    clearTranscripts();
  }, [setContent, stopTranscription, clear, clearTranscripts]);

  const onClickExecStartTranscription = useCallback(() => {
    if (ref.current) {
      ref.current.value = '';
    }
    setContent([]);
    clear();
    clearTranscripts();
    startTranscription(undefined, speakerLabel);
  }, [speakerLabel, clear, clearTranscripts, setContent, startTranscription]);

  // Manual generation handler
  const handleManualGeneration = useCallback(() => {
    if (formattedOutput.trim() !== '' && !minutesLoading) {
      generateMinutes(formattedOutput, modelId, (status) => {
        if (status === 'success') {
          toast.success(t('meetingMinutes.generation_success'));
        } else if (status === 'error') {
          toast.error(t('meetingMinutes.generation_error'));
        }
      });
    }
  }, [formattedOutput, minutesLoading, modelId, generateMinutes, t]);

  // Clear minutes only handler
  const handleClearMinutes = useCallback(() => {
    // Clear generated minutes but keep transcript
    clearMinutes();
  }, [clearMinutes]);

  // Style change detection to trigger minutes regeneration
  useEffect(() => {
    // Only regenerate if style has changed, we have transcript content, and we're not in the initial render
    if (previousStyle !== minutesStyle && formattedOutput.trim() !== '') {
      handleManualGeneration();
    }

    // Update previous style for next comparison
    setPreviousStyle(minutesStyle);
  }, [minutesStyle, formattedOutput, handleManualGeneration, previousStyle]);

  return (
    <div className="grid grid-cols-12">
      <div className="invisible col-span-12 my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('meetingMinutes.title')}
      </div>
      <div className="col-span-12 col-start-1 mx-2 lg:col-span-10 lg:col-start-2 xl:col-span-10 xl:col-start-2">
        <Card>
          {/* Two-column layout */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Left Column - Record & Transcribe */}
            <div>
              {/* Header */}
              <div className="mb-4 border-b pb-2">
                <h2 className="text-lg font-semibold">
                  {t('meetingMinutes.record_transcribe')}
                </h2>
              </div>

              {/* Audio Input Controls */}
              <div className="mb-4">
                <div className="mb-2 flex justify-center text-sm text-gray-500">
                  {t('transcribe.select_input_method')}
                </div>
                <div className="mb-4 flex flex-col justify-center sm:flex-row">
                  <div className="basis-1/2 p-2 xl:basis-2/5">
                    <label className="mb-2 block font-bold">
                      {t('transcribe.mic_input')}
                    </label>
                    <div className="flex justify-center">
                      {recording ? (
                        <Button
                          className="h-10 w-full"
                          onClick={stopTranscription}
                          disabled={disabledMicExec}>
                          <PiStopCircleBold className="mr-2 h-5 w-5" />
                          {t('transcribe.stop_recording')}
                        </Button>
                      ) : (
                        <Button
                          className="h-10 w-full"
                          disabled={disabledMicExec}
                          onClick={() => {
                            if (!disabledMicExec) {
                              onClickExecStartTranscription();
                            }
                          }}
                          outlined={true}>
                          <PiMicrophoneBold className="mr-2 h-5 w-5" />
                          {t('transcribe.start_recording')}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="basis-1/2 p-2 xl:basis-2/5">
                    <label
                      className="mb-2 block font-bold"
                      htmlFor="file_input">
                      {t('transcribe.file_upload')}
                    </label>
                    <input
                      className="border-aws-font-color/20 block h-10 w-full cursor-pointer rounded-lg border
                text-sm text-gray-900 file:mr-4 file:cursor-pointer file:border-0 file:bg-gray-500
                file:px-4 file:py-2.5 file:text-white focus:outline-none"
                      onChange={onChangeFile}
                      aria-describedby="file_input_help"
                      id="file_input"
                      type="file"
                      accept=".mp3, .mp4, .wav, .flac, .ogg, .amr, .webm, .m4a"
                      ref={ref}></input>
                    <p
                      className="ml-0.5 mt-1 text-xs text-gray-500"
                      id="file_input_help">
                      {t('transcribe.supported_files')}
                    </p>
                  </div>
                </div>

                {/* Speaker Recognition Parameters */}
                <ExpandableField
                  label={t('transcribe.detailed_parameters')}
                  className="mb-4"
                  notItem={true}>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Switch
                      label={t('transcribe.speaker_recognition')}
                      checked={speakerLabel}
                      onSwitch={setSpeakerLabel}
                    />
                    {speakerLabel && (
                      <RangeSlider
                        className=""
                        label={t('transcribe.max_speakers')}
                        min={2}
                        max={10}
                        value={maxSpeakers}
                        onChange={setMaxSpeakers}
                        help={t('transcribe.max_speakers_help')}
                      />
                    )}
                  </div>
                  {speakerLabel && (
                    <div className="mt-2">
                      <Textarea
                        placeholder={t('transcribe.speaker_names')}
                        value={speakers}
                        onChange={setSpeakers}
                      />
                    </div>
                  )}
                </ExpandableField>

                {/* Left Column Buttons */}
                <div className="flex justify-end gap-3">
                  <Button
                    outlined
                    disabled={disableClearExec}
                    onClick={onClickClear}>
                    {t('common.clear')}
                  </Button>
                  <Button disabled={disabledExec} onClick={onClickExec}>
                    {t('meetingMinutes.speech_recognition')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column - Generate Minutes */}
            <div>
              {/* Header */}
              <div className="mb-4 border-b pb-2">
                <h2 className="text-lg font-semibold">
                  {t('meetingMinutes.generate_minutes_header')}
                </h2>
              </div>

              {/* Meeting Minutes Configuration */}
              <div className="mb-4">
                <div className="mb-4">
                  <label className="mb-2 block font-bold">
                    {t('meetingMinutes.style')}
                  </label>
                  <Select
                    value={minutesStyle}
                    onChange={(value) =>
                      setMinutesStyle(value as typeof minutesStyle)
                    }
                    options={[
                      {
                        value: 'transcription',
                        label: t('meetingMinutes.style_transcription'),
                      },
                      {
                        value: 'newspaper',
                        label: t('meetingMinutes.style_newspaper'),
                      },
                      {
                        value: 'faq',
                        label: t('meetingMinutes.style_faq'),
                      },
                      {
                        value: 'custom',
                        label: t('meetingMinutes.style_custom'),
                      },
                    ]}
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-2 block font-bold">
                    {t('meetingMinutes.model')}
                  </label>
                  <Select
                    value={modelId}
                    onChange={setModelId}
                    options={availableModels.map((id: string) => ({
                      value: id,
                      label: modelDisplayName(id),
                    }))}
                  />
                </div>

                {/* Show custom prompt textarea when custom style is selected */}
                {minutesStyle === 'custom' && (
                  <div className="mb-4">
                    <Textarea
                      label={t('meetingMinutes.custom_prompt')}
                      value={customPrompt}
                      onChange={setCustomPrompt}
                      placeholder={t(
                        'meetingMinutes.custom_prompt_placeholder'
                      )}
                      rows={4}
                    />
                  </div>
                )}

                {/* Auto-generation controls */}
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <Switch
                      label={t('meetingMinutes.auto_generate')}
                      checked={autoGenerate}
                      onSwitch={setAutoGenerate}
                    />
                    {/* eslint-disable @shopify/jsx-no-hardcoded-content */}
                    {autoGenerate && countdownSeconds > 0 && (
                      <div className="text-sm text-gray-600">
                        {t('meetingMinutes.next_generation_in')}
                        {Math.floor(countdownSeconds / 60)}:
                        {(countdownSeconds % 60).toString().padStart(2, '0')}
                      </div>
                    )}
                    {/* eslint-enable @shopify/jsx-no-hardcoded-content */}
                  </div>
                </div>
                {autoGenerate && (
                  <div className="mb-4">
                    <Select
                      label={t('meetingMinutes.frequency')}
                      value={generationFrequency.toString()}
                      onChange={(value) =>
                        setGenerationFrequency(parseInt(value))
                      }
                      options={[
                        {
                          value: '1',
                          label: t('meetingMinutes.frequency_1min'),
                        },
                        {
                          value: '5',
                          label: t('meetingMinutes.frequency_5min'),
                        },
                        {
                          value: '10',
                          label: t('meetingMinutes.frequency_10min'),
                        },
                      ]}
                    />
                  </div>
                )}

                {/* Right Column Buttons */}
                <div className="flex justify-end gap-3">
                  <Button outlined onClick={handleClearMinutes}>
                    {t('common.clear')}
                  </Button>
                  <Button
                    onClick={handleManualGeneration}
                    disabled={formattedOutput === '' || minutesLoading}>
                    {t('meetingMinutes.generate')}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Split view for transcript and generated minutes */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Transcript Panel */}
            <div className="rounded border border-black/30 p-1.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-bold">
                  {t('meetingMinutes.transcript')}
                </div>
                {formattedOutput.trim() !== '' && (
                  <ButtonCopy
                    text={formattedOutput}
                    interUseCasesKey="transcript"
                  />
                )}
              </div>
              {content.length > 0 && (
                <div>
                  {content.map((transcript, idx) => (
                    <div key={idx} className="flex">
                      {transcript.speakerLabel && (
                        <div className="min-w-20">
                          {speakerMapping[transcript.speakerLabel] ||
                            transcript.speakerLabel}
                        </div>
                      )}
                      <div className="grow">{transcript.transcript}</div>
                    </div>
                  ))}
                </div>
              )}
              {!loading && formattedOutput == '' && (
                <div className="text-gray-500">
                  {t('transcribe.result_placeholder')}
                </div>
              )}
              {loading && (
                <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
              )}
            </div>

            {/* Generated Minutes Panel */}
            <div className="rounded border border-black/30 p-1.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="font-bold">
                    {t('meetingMinutes.generated_minutes')}
                  </div>
                  {lastGeneratedTime && (
                    <div className="text-sm text-gray-500">
                      {t('meetingMinutes.last_generated', {
                        time: lastGeneratedTime.toLocaleTimeString(),
                      })}
                    </div>
                  )}
                </div>
                {generatedMinutes.trim() !== '' && (
                  <ButtonCopy
                    text={generatedMinutes}
                    interUseCasesKey="minutes"
                  />
                )}
              </div>
              <Markdown>{generatedMinutes}</Markdown>
              {!minutesLoading && generatedMinutes === '' && (
                <div className="text-gray-500">
                  {t('meetingMinutes.minutes_placeholder')}
                </div>
              )}
              {minutesLoading && (
                <div className="flex items-center gap-2">
                  <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
                  <span className="text-sm text-gray-600">
                    {t('meetingMinutes.generating')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MeetingMinutesPage;
