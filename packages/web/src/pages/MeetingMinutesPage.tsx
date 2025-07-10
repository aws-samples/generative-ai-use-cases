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
import ButtonSendToUseCase from '../components/ButtonSendToUseCase';
import ButtonIcon from '../components/ButtonIcon';
import useTranscribe from '../hooks/useTranscribe';
import useMicrophone from '../hooks/useMicrophone';
import useScreenAudio from '../hooks/useScreenAudio';
import useMeetingMinutes from '../hooks/useMeetingMinutes';
import { MODELS } from '../hooks/useModel';
import {
  PiStopCircleBold,
  PiMicrophoneBold,
  PiPencilLine,
  PiPaperclip,
} from 'react-icons/pi';
import Switch from '../components/Switch';
import RangeSlider from '../components/RangeSlider';
import ExpandableField from '../components/ExpandableField';
import Select from '../components/Select';
import { Transcript } from 'generative-ai-use-cases';
import Textarea from '../components/Textarea';
import { useTranslation, Trans } from 'react-i18next';
import { toast } from 'sonner';
import Markdown from '../components/Markdown';
import { useNavigate } from 'react-router-dom';
import queryString from 'query-string';
import { MeetingMinutesStyle } from '../hooks/useMeetingMinutes';
import { LanguageCode } from '@aws-sdk/client-transcribe-streaming';

// Real-time transcript segment for chronological integration
interface RealtimeSegment {
  resultId: string;
  source: 'microphone' | 'screen';
  startTime: number;
  endTime: number;
  isPartial: boolean;
  transcripts: Transcript[];
}

type StateType = {
  content: Transcript[];
  setContent: (c: Transcript[]) => void;
  speakerLabel: boolean;
  setSpeakerLabel: (b: boolean) => void;
  maxSpeakers: number;
  setMaxSpeakers: (n: number) => void;
  speakers: string;
  setSpeakers: (s: string) => void;
  generatedMinutes: string;
  setGeneratedMinutes: (s: string) => void;
  lastProcessedTranscript: string;
  setLastProcessedTranscript: (s: string) => void;
  lastGeneratedTime: Date | null;
  setLastGeneratedTime: (d: Date | null) => void;
  minutesStyle: MeetingMinutesStyle;
  setMinutesStyle: (s: MeetingMinutesStyle) => void;
  autoGenerate: boolean;
  setAutoGenerate: (b: boolean) => void;
  generationFrequency: number;
  setGenerationFrequency: (n: number) => void;
  customPrompt: string;
  setCustomPrompt: (s: string) => void;
  autoGenerateSessionTimestamp: number | null;
  setAutoGenerateSessionTimestamp: (timestamp: number | null) => void;
  languageCode: string;
  setLanguageCode: (s: string) => void;
};

const useMeetingMinutesState = create<StateType>((set) => {
  return {
    content: [],
    speakerLabel: false, // Disabled by default per requirements
    maxSpeakers: 4, // Reasonable default for meetings
    speakers: '',
    generatedMinutes: '',
    lastProcessedTranscript: '',
    lastGeneratedTime: null,
    minutesStyle: 'faq' as MeetingMinutesStyle,
    autoGenerate: false,
    generationFrequency: 5,
    customPrompt: '',
    autoGenerateSessionTimestamp: null,
    languageCode: 'auto', // Default to auto-detection
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
    setGeneratedMinutes: (s: string) => {
      set(() => ({
        generatedMinutes: s,
      }));
    },
    setLastProcessedTranscript: (s: string) => {
      set(() => ({
        lastProcessedTranscript: s,
      }));
    },
    setLastGeneratedTime: (d: Date | null) => {
      set(() => ({
        lastGeneratedTime: d,
      }));
    },
    setMinutesStyle: (s: MeetingMinutesStyle) => {
      set(() => ({
        minutesStyle: s,
      }));
    },
    setAutoGenerate: (b: boolean) => {
      set(() => ({
        autoGenerate: b,
      }));
    },
    setGenerationFrequency: (n: number) => {
      set(() => ({
        generationFrequency: n,
      }));
    },
    setCustomPrompt: (s: string) => {
      set(() => ({
        customPrompt: s,
      }));
    },
    setAutoGenerateSessionTimestamp: (timestamp: number | null) => {
      set(() => ({
        autoGenerateSessionTimestamp: timestamp,
      }));
    },
    setLanguageCode: (s: string) => {
      set(() => ({
        languageCode: s,
      }));
    },
  };
});

const MeetingMinutesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { loading, transcriptData, file, setFile, transcribe, clear } =
    useTranscribe();
  const {
    startTranscription: startMicTranscription,
    stopTranscription: stopMicTranscription,
    recording: micRecording,
    clearTranscripts: clearMicTranscripts,
    rawTranscripts: micRawTranscripts,
  } = useMicrophone();
  const {
    prepareScreenCapture,
    startTranscriptionWithStream,
    stopTranscription: stopScreenTranscription,
    recording: screenRecording,
    clearTranscripts: clearScreenTranscripts,
    isSupported: isScreenAudioSupported,
    error: screenAudioError,
    rawTranscripts: screenRawTranscripts,
  } = useScreenAudio();
  const {
    speakerLabel,
    setSpeakerLabel,
    maxSpeakers,
    setMaxSpeakers,
    speakers,
    setSpeakers,
    generatedMinutes,
    setGeneratedMinutes,
    lastProcessedTranscript,
    setLastProcessedTranscript,
    lastGeneratedTime,
    setLastGeneratedTime,
    minutesStyle,
    setMinutesStyle,
    autoGenerate,
    setAutoGenerate,
    generationFrequency,
    setGenerationFrequency,
    customPrompt,
    setCustomPrompt,
    autoGenerateSessionTimestamp,
    setAutoGenerateSessionTimestamp,
    languageCode,
    setLanguageCode,
  } = useMeetingMinutesState();
  const ref = useRef<HTMLInputElement>(null);
  const transcriptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldGenerateRef = useRef<boolean>(false);
  const isAtBottomRef = useRef<boolean>(true);

  // Countdown state for auto-generation timer
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  // Screen Audio enable/disable state
  const [enableScreenAudio, setEnableScreenAudio] = useState(false);

  // Input method selection state
  const [inputMethod, setInputMethod] = useState<
    'microphone' | 'file' | 'direct'
  >('microphone');

  // Direct input text state
  const [directInputText, setDirectInputText] = useState('');

  // File upload transcript text state
  const [fileTranscriptText, setFileTranscriptText] = useState('');

  // Real-time segments management
  const [realtimeSegments, setRealtimeSegments] = useState<RealtimeSegment[]>(
    []
  );

  // Language options for transcription
  const languageOptions = useMemo(
    () => [
      { value: 'auto', label: t('meetingMinutes.language_auto') },
      { value: 'ja-JP', label: t('meetingMinutes.language_japanese') },
      { value: 'en-US', label: t('meetingMinutes.language_english') },
      { value: 'zh-CN', label: t('meetingMinutes.language_chinese') },
      { value: 'ko-KR', label: t('meetingMinutes.language_korean') },
      { value: 'th-TH', label: t('meetingMinutes.language_thai') },
      { value: 'vi-VN', label: t('meetingMinutes.language_vietnamese') },
    ],
    [t]
  );

  // Map i18n language to transcription language, fallback to auto if not supported
  const getTranscriptionLanguageFromSettings = useCallback(
    (settingsLang: string): string => {
      const langMapping: { [key: string]: string } = {
        ja: 'ja-JP',
        en: 'en-US',
        zh: 'zh-CN',
        ko: 'ko-KR',
        th: 'th-TH',
        vi: 'vi-VN',
      };
      return langMapping[settingsLang] || 'auto';
    },
    []
  );

  // Set language from settings on mount
  useEffect(() => {
    if (i18n.resolvedLanguage && languageCode === 'auto') {
      const mappedLang = getTranscriptionLanguageFromSettings(
        i18n.resolvedLanguage
      );
      if (mappedLang !== 'auto') {
        setLanguageCode(mappedLang);
      }
    }
  }, [
    i18n.resolvedLanguage,
    languageCode,
    setLanguageCode,
    getTranscriptionLanguageFromSettings,
  ]);

  // Model selection state
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const [modelId, setModelId] = useState(availableModels[0] || '');

  // Meeting minutes specific hook with external state
  const {
    loading: minutesLoading,
    generateMinutes,
    clearMinutes,
  } = useMeetingMinutes(
    minutesStyle,
    customPrompt,
    autoGenerateSessionTimestamp,
    setGeneratedMinutes,
    setLastProcessedTranscript,
    setLastGeneratedTime
  );

  const speakerMapping = useMemo(() => {
    return Object.fromEntries(
      speakers.split(',').map((speaker, idx) => [`spk_${idx}`, speaker.trim()])
    );
  }, [speakers]);

  // Helper function to format time in MM:SS format
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Real-time text output
  const realtimeText: string = useMemo(() => {
    // Sort segments by start time (chronological order)
    // Show both partial and finalized segments for real-time display
    const sortedSegments = [...realtimeSegments].sort(
      (a, b) => a.startTime - b.startTime
    );

    return sortedSegments
      .map((segment) => {
        const timeStr = `[${formatTime(segment.startTime)}]`;
        const partialIndicator = segment.isPartial ? ' (...)' : '';

        return segment.transcripts
          .map((transcript) => {
            const speakerLabel = transcript.speakerLabel
              ? `${speakerMapping[transcript.speakerLabel] || transcript.speakerLabel}: `
              : '';
            return `${timeStr} ${speakerLabel}${transcript.transcript}${partialIndicator}`;
          })
          .join('\n');
      })
      .join('\n');
  }, [realtimeSegments, speakerMapping, formatTime]);

  // Auto scroll to bottom when transcript updates if user was at bottom
  useEffect(() => {
    if (
      transcriptTextareaRef.current &&
      isAtBottomRef.current &&
      realtimeText
    ) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        if (transcriptTextareaRef.current) {
          transcriptTextareaRef.current.scrollTop =
            transcriptTextareaRef.current.scrollHeight;
        }
      }, 10);
    }
  }, [realtimeText]);

  // Current transcript text based on input method
  const currentTranscriptText = useMemo(() => {
    switch (inputMethod) {
      case 'direct':
        return directInputText;
      case 'file':
        return fileTranscriptText;
      default:
        return realtimeText;
    }
  }, [inputMethod, directInputText, fileTranscriptText, realtimeText]);

  // Text existence check
  const hasTranscriptText = useMemo(() => {
    return currentTranscriptText.trim() !== '';
  }, [currentTranscriptText]);

  const onChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setFile(files[0]);
    }
  };

  useEffect(() => {
    if (transcriptData && transcriptData.transcripts) {
      // Convert file upload transcripts to simple text format
      const fileText = transcriptData.transcripts
        .map((transcript) => {
          const speakerLabel = transcript.speakerLabel
            ? `${speakerMapping[transcript.speakerLabel] || transcript.speakerLabel}: `
            : '';
          return `${speakerLabel}${transcript.transcript}`;
        })
        .join('\n');

      setFileTranscriptText(fileText);
    }
  }, [transcriptData, speakerMapping]);

  // Real-time integration of raw transcripts
  const updateRealtimeSegments = useCallback((newSegment: RealtimeSegment) => {
    setRealtimeSegments((prev) => {
      const existingIndex = prev.findIndex(
        (seg) =>
          seg.resultId === newSegment.resultId &&
          seg.source === newSegment.source
      );

      if (existingIndex >= 0) {
        // Update existing segment (partial result update)
        const updated = [...prev];
        updated[existingIndex] = newSegment;
        return updated;
      } else {
        // Add new segment
        return [...prev, newSegment];
      }
    });
  }, []);

  // Process microphone raw transcripts
  useEffect(() => {
    if (micRawTranscripts && micRawTranscripts.length > 0) {
      // Only process the latest segment
      const latestSegment = micRawTranscripts[micRawTranscripts.length - 1];
      const segment: RealtimeSegment = {
        resultId: latestSegment.resultId,
        source: 'microphone',
        startTime: latestSegment.startTime,
        endTime: latestSegment.endTime,
        isPartial: latestSegment.isPartial,
        transcripts: latestSegment.transcripts,
      };
      updateRealtimeSegments(segment);
    }
  }, [micRawTranscripts, updateRealtimeSegments]);

  // Process screen audio raw transcripts
  useEffect(() => {
    if (
      enableScreenAudio &&
      screenRawTranscripts &&
      screenRawTranscripts.length > 0
    ) {
      // Only process the latest segment
      const latestSegment =
        screenRawTranscripts[screenRawTranscripts.length - 1];
      const segment: RealtimeSegment = {
        resultId: latestSegment.resultId,
        source: 'screen',
        startTime: latestSegment.startTime,
        endTime: latestSegment.endTime,
        isPartial: latestSegment.isPartial,
        transcripts: latestSegment.transcripts,
      };
      updateRealtimeSegments(segment);
    }
  }, [screenRawTranscripts, enableScreenAudio, updateRealtimeSegments]);

  // Watch for generation signal and trigger generation
  useEffect(() => {
    if (
      shouldGenerateRef.current &&
      autoGenerate &&
      realtimeText.trim() !== ''
    ) {
      if (realtimeText !== lastProcessedTranscript && !minutesLoading) {
        shouldGenerateRef.current = false; // Reset the flag
        generateMinutes(realtimeText, modelId, (status) => {
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
    realtimeText,
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
    return !file || loading || micRecording;
  }, [file, loading, micRecording]);

  const isRecording = micRecording || screenRecording;

  const disableClearExec = useMemo(() => {
    const hasData = file || hasTranscriptText;
    return !hasData || loading || isRecording;
  }, [file, hasTranscriptText, loading, isRecording]);

  const disabledMicExec = useMemo(() => {
    return loading;
  }, [loading]);

  const onClickExec = useCallback(() => {
    if (loading) return;
    // Don't clear existing transcripts - append instead
    stopMicTranscription();
    clearMicTranscripts();
    const langCode = languageCode === 'auto' ? undefined : languageCode;
    transcribe(speakerLabel, maxSpeakers, langCode);
  }, [
    loading,
    languageCode,
    speakerLabel,
    maxSpeakers,
    stopMicTranscription,
    clearMicTranscripts,
    transcribe,
  ]);

  const onClickClear = useCallback(() => {
    // Clear all input methods
    setDirectInputText('');
    setFileTranscriptText('');
    if (ref.current) {
      ref.current.value = '';
    }
    setRealtimeSegments([]);
    stopMicTranscription();
    stopScreenTranscription();
    clear();
    clearMicTranscripts();
    clearScreenTranscripts();
  }, [
    stopMicTranscription,
    stopScreenTranscription,
    clear,
    clearMicTranscripts,
    clearScreenTranscripts,
  ]);

  const onClickExecStartTranscription = useCallback(async () => {
    // Clear existing content before starting new recording
    setRealtimeSegments([]);
    clearMicTranscripts();
    clearScreenTranscripts();

    const langCode =
      languageCode === 'auto' ? undefined : (languageCode as LanguageCode);

    try {
      // If screen audio is enabled, prepare screen capture first
      let screenStream: MediaStream | null = null;
      if (enableScreenAudio && isScreenAudioSupported) {
        screenStream = await prepareScreenCapture();
      }

      // Now start both recordings simultaneously for better synchronization
      if (screenStream) {
        startTranscriptionWithStream(screenStream, langCode, speakerLabel);
      }
      startMicTranscription(langCode, speakerLabel);
    } catch (error) {
      console.error('Failed to start synchronized recording:', error);
      // Fallback to microphone only if screen preparation fails
      startMicTranscription(langCode, speakerLabel);
    }
  }, [
    languageCode,
    speakerLabel,
    startMicTranscription,
    enableScreenAudio,
    isScreenAudioSupported,
    prepareScreenCapture,
    startTranscriptionWithStream,
    clearMicTranscripts,
    clearScreenTranscripts,
  ]);

  // Manual generation handler
  const handleManualGeneration = useCallback(() => {
    // Validate custom prompt when using custom style
    if (
      minutesStyle === 'custom' &&
      (!customPrompt || customPrompt.trim() === '')
    ) {
      toast.error(t('meetingMinutes.custom_prompt_placeholder'));
      return;
    }

    if (hasTranscriptText && !minutesLoading) {
      generateMinutes(currentTranscriptText, modelId, (status) => {
        if (status === 'success') {
          toast.success(t('meetingMinutes.generation_success'));
        } else if (status === 'error') {
          toast.error(t('meetingMinutes.generation_error'));
        }
      });
    }
  }, [
    hasTranscriptText,
    currentTranscriptText,
    minutesLoading,
    modelId,
    generateMinutes,
    t,
    minutesStyle,
    customPrompt,
  ]);

  // Clear minutes only handler
  const handleClearMinutes = useCallback(() => {
    // Clear generated minutes but keep transcript
    clearMinutes();
  }, [clearMinutes]);

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
              {/* Audio Input Controls */}
              <div className="mb-4">
                {/* Tab Headers */}
                <div className="mb-4 flex border-b border-gray-200">
                  <button
                    className={`flex items-center border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                      inputMethod === 'microphone'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setInputMethod('microphone')}>
                    <PiMicrophoneBold className="mr-2 h-4 w-4" />
                    {t('transcribe.mic_input')}
                  </button>
                  <button
                    className={`flex items-center border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                      inputMethod === 'direct'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setInputMethod('direct')}>
                    <PiPencilLine className="mr-2 h-4 w-4" />
                    {t('transcribe.direct_input')}
                  </button>
                  <button
                    className={`flex items-center border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                      inputMethod === 'file'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setInputMethod('file')}>
                    <PiPaperclip className="mr-2 h-4 w-4" />
                    {t('transcribe.file_upload')}
                  </button>
                </div>

                {/* Tab Content */}
                <div className="mb-4">
                  {inputMethod === 'microphone' && (
                    <div className="p-2">
                      <div className="flex justify-center">
                        {isRecording ? (
                          <Button
                            className="h-10 w-full"
                            onClick={() => {
                              stopMicTranscription();
                              stopScreenTranscription();
                            }}
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
                      {isScreenAudioSupported && (
                        <div className="ml-0.5 mt-2">
                          <Switch
                            label={t('transcribe.screen_audio')}
                            checked={enableScreenAudio}
                            onSwitch={setEnableScreenAudio}
                          />
                          {enableScreenAudio && (
                            <div className="mt-2 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
                              <Trans
                                i18nKey="transcribe.screen_audio_notice"
                                components={{ br: <br /> }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {inputMethod === 'file' && (
                    <div className="p-2">
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
                  )}

                  {inputMethod === 'direct' && (
                    <div className="p-2">
                      <p className="mb-2 text-sm text-gray-600">
                        {t('transcribe.direct_input_instruction')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Language Selection - Hidden for direct input */}
                {inputMethod !== 'direct' && (
                  <div className="mb-4 px-2">
                    <label className="mb-2 block font-bold">
                      {t('meetingMinutes.language')}
                    </label>
                    <Select
                      value={languageCode}
                      onChange={(value) => setLanguageCode(value)}
                      options={languageOptions}
                    />
                  </div>
                )}

                {/* Speaker Recognition Parameters - Hidden for direct input */}
                {inputMethod !== 'direct' && (
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
                )}

                {/* Screen Audio Error Display */}
                {screenAudioError && (
                  <div className="mb-4 mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                    <strong>{t('meetingMinutes.screen_audio_error')}</strong>{' '}
                    {screenAudioError}
                  </div>
                )}

                {/* Left Column Buttons */}
                <div className="flex justify-end gap-3">
                  <Button
                    outlined
                    disabled={disableClearExec}
                    onClick={onClickClear}>
                    {t('common.clear')}
                  </Button>
                  {inputMethod === 'file' && (
                    <Button disabled={disabledExec} onClick={onClickExec}>
                      {t('meetingMinutes.speech_recognition')}
                    </Button>
                  )}
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
                        value: 'faq',
                        label: t('meetingMinutes.style_faq'),
                      },
                      {
                        value: 'newspaper',
                        label: t('meetingMinutes.style_newspaper'),
                      },
                      {
                        value: 'transcription',
                        label: t('meetingMinutes.style_transcription'),
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
                      onSwitch={(checked) => {
                        setAutoGenerate(checked);
                        if (checked) {
                          setAutoGenerateSessionTimestamp(Date.now());
                        } else {
                          setAutoGenerateSessionTimestamp(null);
                        }
                      }}
                    />
                    {autoGenerate && countdownSeconds > 0 && (
                      <div className="text-sm text-gray-600">
                        {t('meetingMinutes.next_generation_in')}
                        {Math.floor(countdownSeconds / 60)}
                        {t('common.colon')}
                        {(countdownSeconds % 60).toString().padStart(2, '0')}
                      </div>
                    )}
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
                    disabled={
                      !hasTranscriptText ||
                      minutesLoading ||
                      (minutesStyle === 'custom' &&
                        (!customPrompt || customPrompt.trim() === ''))
                    }>
                    {t('meetingMinutes.generate')}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Split view for transcript and generated minutes */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Transcript Panel */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="font-bold">
                  {t('meetingMinutes.transcript')}
                </div>
                {hasTranscriptText && (
                  <div className="flex">
                    <ButtonCopy
                      text={currentTranscriptText}
                      interUseCasesKey="transcript"></ButtonCopy>
                    <ButtonSendToUseCase text={currentTranscriptText} />
                  </div>
                )}
              </div>
              <textarea
                ref={transcriptTextareaRef}
                value={currentTranscriptText}
                onChange={(e) => {
                  // Only used when inputMethod === 'direct' (other modes are readOnly)
                  setDirectInputText(e.target.value);
                }}
                onScroll={(e) => {
                  // Check if user is at the bottom of the textarea
                  const target = e.target as HTMLTextAreaElement;
                  const isAtBottom =
                    Math.abs(
                      target.scrollHeight -
                        target.clientHeight -
                        target.scrollTop
                    ) < 3;
                  isAtBottomRef.current = isAtBottom;
                }}
                placeholder={
                  inputMethod === 'direct'
                    ? t('transcribe.direct_input_placeholder')
                    : t('transcribe.result_placeholder')
                }
                rows={10}
                className="min-h-96 w-full resize-none rounded border border-black/30 p-1.5 outline-none"
                readOnly={inputMethod !== 'direct'}
              />
              {loading && (
                <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
              )}
            </div>

            {/* Generated Minutes Panel */}
            <div>
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
                  <div className="flex gap-2">
                    <ButtonCopy
                      text={generatedMinutes}
                      interUseCasesKey="minutes"
                    />
                    <ButtonIcon
                      onClick={() => {
                        navigate(
                          `/writer?${queryString.stringify({ sentence: generatedMinutes })}`
                        );
                      }}
                      title={t('navigation.writing')}>
                      <PiPencilLine />
                    </ButtonIcon>
                  </div>
                )}
              </div>
              <div className="min-h-96 rounded border border-black/30 p-1.5">
                <Markdown>{generatedMinutes}</Markdown>
                {!minutesLoading && generatedMinutes === '' && (
                  <div className="text-gray-500">
                    {t('meetingMinutes.minutes_placeholder')}
                  </div>
                )}
              </div>
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
