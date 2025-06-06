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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
  } = useMeetingMinutes();

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

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Auto-generation logic with proper cleanup
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!autoGenerate || generationFrequency <= 0 || !formattedOutput) return;

    // Initial generation if needed
    if (
      formattedOutput !== lastProcessedTranscript &&
      !minutesLoading &&
      formattedOutput.trim() !== ''
    ) {
      generateMinutes(formattedOutput, modelId, (status) => {
        if (status === 'success') {
          toast.success(t('meetingMinutes.generation_success'));
        } else if (status === 'error') {
          toast.error(t('meetingMinutes.generation_error'));
        }
      });
    }

    // Set up interval for periodic generation
    intervalRef.current = setInterval(
      () => {
        if (
          formattedOutput !== lastProcessedTranscript &&
          !minutesLoading &&
          formattedOutput.trim() !== ''
        ) {
          generateMinutes(formattedOutput, modelId, (status) => {
            if (status === 'success') {
              toast.success(t('meetingMinutes.generation_success'));
            } else if (status === 'error') {
              toast.error(t('meetingMinutes.generation_error'));
            }
          });
        }
      },
      generationFrequency * 60 * 1000
    ); // Convert minutes to milliseconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    autoGenerate,
    generationFrequency,
    formattedOutput,
    lastProcessedTranscript,
    minutesLoading,
    modelId,
    generateMinutes,
    t,
  ]);

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
    setContent([]);
    stopTranscription();
    clearTranscripts();
    transcribe(speakerLabel, maxSpeakers);
  }, [
    loading,
    speakerLabel,
    maxSpeakers,
    setContent,
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

  return (
    <div className="grid grid-cols-12">
      <div className="invisible col-span-12 my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('meetingMinutes.title')}
      </div>
      <div className="col-span-12 col-start-1 mx-2 lg:col-span-10 lg:col-start-2 xl:col-span-10 xl:col-start-2">
        <Card>
          {/* Meeting Minutes Configuration */}
          <div className="mb-4 flex flex-col justify-center sm:flex-row">
            <div className="basis-1/3 p-2">
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
                    value: 'standard',
                    label: t('meetingMinutes.style_standard'),
                  },
                  {
                    value: 'executive',
                    label: t('meetingMinutes.style_executive'),
                  },
                  {
                    value: 'detailed',
                    label: t('meetingMinutes.style_detailed'),
                  },
                  { value: 'custom', label: t('meetingMinutes.style_custom') },
                ]}
              />
            </div>
            <div className="basis-1/3 p-2">
              <label className="mb-2 block font-bold">
                {t('common.model')}
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
          </div>

          {/* Show custom prompt textarea when custom style is selected */}
          {minutesStyle === 'custom' && (
            <div className="mb-4 p-2">
              <Textarea
                label={t('meetingMinutes.custom_prompt')}
                value={customPrompt}
                onChange={setCustomPrompt}
                placeholder={t('meetingMinutes.custom_prompt_placeholder')}
                rows={4}
              />
            </div>
          )}

          {/* Auto-generation controls */}
          <div className="mb-4 flex flex-col justify-center sm:flex-row">
            <div className="basis-1/2 p-2">
              <Switch
                label={t('meetingMinutes.auto_generate')}
                checked={autoGenerate}
                onSwitch={setAutoGenerate}
              />
            </div>
            {autoGenerate && (
              <div className="basis-1/2 p-2">
                <Select
                  label={t('meetingMinutes.frequency')}
                  value={generationFrequency.toString()}
                  onChange={(value) => setGenerationFrequency(parseInt(value))}
                  options={[
                    { value: '1', label: t('meetingMinutes.frequency_1min') },
                    { value: '5', label: t('meetingMinutes.frequency_5min') },
                    { value: '10', label: t('meetingMinutes.frequency_10min') },
                  ]}
                />
              </div>
            )}
          </div>

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
              <label className="mb-2 block font-bold" htmlFor="file_input">
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
          <ExpandableField
            label={t('transcribe.detailed_parameters')}
            className="p-2"
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
              <div className="">
                <Textarea
                  placeholder={t('transcribe.speaker_names')}
                  value={speakers}
                  onChange={setSpeakers}
                />
              </div>
            )}
          </ExpandableField>
          <div className="flex justify-end gap-3">
            <Button outlined disabled={disableClearExec} onClick={onClickClear}>
              {t('common.clear')}
            </Button>
            <Button disabled={disabledExec} onClick={onClickExec}>
              {t('common.execute')}
            </Button>
          </div>

          {/* Split view for transcript and generated minutes */}
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Transcript Panel */}
            <div className="rounded border border-black/30 p-1.5">
              <div className="mb-2 font-bold">
                {t('meetingMinutes.transcript')}
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
              <div className="mt-2 flex w-full justify-end">
                <ButtonCopy
                  text={formattedOutput}
                  interUseCasesKey="transcript"
                />
              </div>
            </div>

            {/* Generated Minutes Panel */}
            <div className="rounded border border-black/30 p-1.5">
              <div className="mb-2 flex items-center justify-between">
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
              <div className="mt-2 flex w-full justify-end gap-2">
                <ButtonCopy
                  text={generatedMinutes}
                  interUseCasesKey="minutes"
                />
              </div>
            </div>
          </div>

          {/* Control bar between panels */}
          <div className="mt-4 flex justify-center gap-3">
            <Button
              onClick={handleManualGeneration}
              disabled={formattedOutput === '' || minutesLoading}>
              {t('meetingMinutes.generate_minutes')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MeetingMinutesPage;
