import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Card from '../components/Card';
import {
  PiMicrophoneBold,
  PiPencilLine,
  PiPaperclip,
  PiTranslateBold,
  PiFileText,
  PiColumnsBold,
} from 'react-icons/pi';
import MeetingMinutesTranscription from '../components/MeetingMinutes/MeetingMinutesTranscription';
import MeetingMinutesRealtimeTranslation from '../components/MeetingMinutes/MeetingMinutesRealtimeTranslation';
import MeetingMinutesDirect from '../components/MeetingMinutes/MeetingMinutesDirect';
import MeetingMinutesFile from '../components/MeetingMinutes/MeetingMinutesFile';
import MeetingMinutesGeneration from '../components/MeetingMinutes/MeetingMinutesGeneration';
import NavigationBlockDialog from '../components/NavigationBlockDialog';
import usePreventNavigation from '../hooks/usePreventNavigation';
import useWakeLock from '../hooks/useWakeLock';
import { useTranslation } from 'react-i18next';

// Types for Meeting Minutes components
export type InputMethod =
  | 'transcription'
  | 'direct'
  | 'file'
  | 'realtime_translation';

export interface LanguageOption {
  value: string;
  label: string;
}

export interface AudioRecognitionSettings {
  languageCode: string;
  speakerLabel: boolean;
  maxSpeakers: number;
  speakers: string;
}

export interface AudioRecognitionSettingsHandlers {
  onLanguageCodeChange: (code: string) => void;
  onSpeakerLabelChange: (enabled: boolean) => void;
  onMaxSpeakersChange: (count: number) => void;
  onSpeakersChange: (names: string) => void;
}

export interface CommonTranscriptProps {
  hasTranscriptText: boolean;
  onClear: () => void;
  disableClear: boolean;
}

// Panel type for view toggle
type ViewPanel = 'transcription' | 'both' | 'generation';

const MeetingMinutesPage: React.FC = () => {
  const { t } = useTranslation();

  // State management
  const [inputMethod, setInputMethod] = useState<InputMethod>('transcription');
  // Active panel for view toggle (default: 'both' for desktop)
  const [activePanel, setActivePanel] = useState<ViewPanel>('both');
  // Track if screen is large (lg breakpoint: 1024px)
  const [isLargeScreen, setIsLargeScreen] = useState(true);
  const [transcriptTexts, setTranscriptTexts] = useState({
    transcription: '',
    direct: '',
    file: '',
    realtime_translation: '',
  });

  // Recording state management for navigation protection
  const [transcriptionRecording, setTranscriptionRecording] = useState({
    micRecording: false,
    screenRecording: false,
  });
  const [realtimeTranslationRecording, setRealtimeTranslationRecording] =
    useState({
      micRecording: false,
      screenRecording: false,
    });

  // Check if there are unsaved changes (recording in progress)
  const hasUnsavedChanges = useMemo(() => {
    if (inputMethod === 'transcription') {
      return (
        transcriptionRecording.micRecording ||
        transcriptionRecording.screenRecording
      );
    } else if (inputMethod === 'realtime_translation') {
      return (
        realtimeTranslationRecording.micRecording ||
        realtimeTranslationRecording.screenRecording
      );
    }
    return false;
  }, [inputMethod, transcriptionRecording, realtimeTranslationRecording]);

  // Prevent navigation when recording
  const blocker = usePreventNavigation(hasUnsavedChanges);

  // Prevent screen sleep while any recording is active
  const isAnyRecording = useMemo(() => {
    return (
      transcriptionRecording.micRecording ||
      transcriptionRecording.screenRecording ||
      realtimeTranslationRecording.micRecording ||
      realtimeTranslationRecording.screenRecording
    );
  }, [transcriptionRecording, realtimeTranslationRecording]);
  useWakeLock(isAnyRecording);

  // Handle transcript changes from components
  const handleTranscriptChange = (method: InputMethod, text: string) => {
    setTranscriptTexts((prev) => ({
      ...prev,
      [method]: text,
    }));
  };

  // Memoized callback for transcription transcript changes
  const handleTranscriptionTranscriptChange = useCallback(
    (text: string) => handleTranscriptChange('transcription', text),
    []
  );

  // Memoized callback for realtime translation transcript changes
  const handleRealtimeTranslationTranscriptChange = useCallback(
    (text: string) => handleTranscriptChange('realtime_translation', text),
    []
  );

  // Memoized callback for direct transcript changes
  const handleDirectTranscriptChange = useCallback(
    (text: string) => handleTranscriptChange('direct', text),
    []
  );

  // Memoized callback for file transcript changes
  const handleFileTranscriptChange = useCallback(
    (text: string) => handleTranscriptChange('file', text),
    []
  );

  // Memoized callback for recording state changes (prevents infinite loop)
  const handleTranscriptionRecordingStateChange = useCallback(
    (state: { micRecording: boolean; screenRecording: boolean }) => {
      setTranscriptionRecording(state);
    },
    []
  );

  const handleRealtimeTranslationRecordingStateChange = useCallback(
    (state: { micRecording: boolean; screenRecording: boolean }) => {
      setRealtimeTranslationRecording(state);
    },
    []
  );

  // Get current transcript text
  const currentTranscriptText = transcriptTexts[inputMethod];

  // Monitor screen size changes for responsive behavior
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsLargeScreen(e.matches);
      if (!e.matches && activePanel === 'both') {
        // When screen becomes small and 'both' is selected, switch to 'transcription'
        setActivePanel('transcription');
      }
    };

    // Initial check
    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [activePanel]);

  // Handle panel selection with screen size consideration
  const handlePanelChange = useCallback(
    (panel: ViewPanel) => {
      if (panel === 'both' && !isLargeScreen) {
        // On small screens, 'both' is not available, fallback to 'transcription'
        setActivePanel('transcription');
      } else {
        setActivePanel(panel);
      }
    },
    [isLargeScreen]
  );

  return (
    <div className="flex h-[calc(100vh)] flex-col">
      <NavigationBlockDialog
        isOpen={blocker.state === 'blocked'}
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
      {/* Title Header with Panel Toggle */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3 lg:py-5">
        <div className="flex-1" />
        <h1 className="text-xl font-semibold">{t('meetingMinutes.title')}</h1>
        <div className="flex flex-1 justify-end">
          <div className="flex rounded border text-xs font-bold">
            <div
              className={`my-1 ml-1 flex cursor-pointer items-center rounded px-2 py-1.5 ${
                activePanel === 'transcription'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-600'
              }`}
              onClick={() => handlePanelChange('transcription')}>
              <PiMicrophoneBold className="text-base lg:mr-1" />
              <span className="hidden lg:inline">
                {t('meetingMinutes.transcription_panel')}
              </span>
            </div>
            {isLargeScreen && (
              <div
                className={`my-1 flex cursor-pointer items-center rounded px-2 py-1.5 ${
                  activePanel === 'both'
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-600'
                }`}
                onClick={() => handlePanelChange('both')}>
                <PiColumnsBold className="text-base lg:mr-1" />
                <span className="hidden lg:inline">
                  {t('meetingMinutes.both_panel')}
                </span>
              </div>
            )}
            <div
              className={`my-1 mr-1 flex cursor-pointer items-center rounded px-2 py-1.5 ${
                activePanel === 'generation'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-600'
              }`}
              onClick={() => handlePanelChange('generation')}>
              <PiFileText className="text-base lg:mr-1" />
              <span className="hidden lg:inline">
                {t('meetingMinutes.generation_panel')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Left & Right columns */}
      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
        {/* Left Column - Tab Content */}
        <div
          className={`min-h-0 transition-all duration-300 ease-in-out ${
            activePanel === 'transcription'
              ? 'block w-full'
              : activePanel === 'both'
                ? 'block w-1/2'
                : 'hidden'
          }`}>
          <Card className="flex h-full flex-col">
            {/* Tab Headers */}
            <div className="mb-4 shrink-0 border-b border-gray-200">
              <div className="flex justify-center gap-2 overflow-x-auto sm:justify-start sm:gap-0">
                <button
                  className={`flex min-h-[48px] min-w-[48px] items-center justify-center border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-4 sm:py-2 ${
                    inputMethod === 'transcription'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setInputMethod('transcription')}>
                  <PiMicrophoneBold className="h-10 w-10 sm:mr-2 sm:h-4 sm:w-4" />
                  <span className="hidden text-xs sm:inline">
                    {t('transcribe.voice_transcription')}
                  </span>
                </button>
                <button
                  className={`flex min-h-[48px] min-w-[48px] items-center justify-center border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-4 sm:py-2 ${
                    inputMethod === 'realtime_translation'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setInputMethod('realtime_translation')}>
                  <PiTranslateBold className="h-10 w-10 sm:mr-2 sm:h-4 sm:w-4" />
                  <span className="hidden text-xs sm:inline">
                    {t('translate.realtime_translation')}
                  </span>
                </button>
                <button
                  className={`flex min-h-[48px] min-w-[48px] items-center justify-center border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-4 sm:py-2 ${
                    inputMethod === 'direct'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setInputMethod('direct')}>
                  <PiPencilLine className="h-10 w-10 sm:mr-2 sm:h-4 sm:w-4" />
                  <span className="hidden text-xs sm:inline">
                    {t('transcribe.direct_input')}
                  </span>
                </button>
                <button
                  className={`flex min-h-[48px] min-w-[48px] items-center justify-center border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:min-h-0 sm:min-w-0 sm:justify-start sm:px-4 sm:py-2 ${
                    inputMethod === 'file'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setInputMethod('file')}>
                  <PiPaperclip className="h-10 w-10 sm:mr-2 sm:h-4 sm:w-4" />
                  <span className="hidden text-xs sm:inline">
                    {t('transcribe.file_upload')}
                  </span>
                </button>
              </div>
              {/* Mobile: Show selected tab label below icons */}
              <div className="mt-4 pb-4 text-center text-sm font-medium text-blue-600 sm:hidden">
                {inputMethod === 'transcription' && (
                  <span>{t('transcribe.voice_transcription')}</span>
                )}
                {inputMethod === 'realtime_translation' && (
                  <span>{t('translate.realtime_translation')}</span>
                )}
                {inputMethod === 'direct' && (
                  <span>{t('transcribe.direct_input')}</span>
                )}
                {inputMethod === 'file' && (
                  <span>{t('transcribe.file_upload')}</span>
                )}
              </div>
            </div>

            {/* Tab Content - Self-contained components */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div
                className="h-full"
                style={{
                  display: inputMethod === 'transcription' ? 'block' : 'none',
                }}>
                <MeetingMinutesTranscription
                  onTranscriptChange={handleTranscriptionTranscriptChange}
                  onRecordingStateChange={
                    handleTranscriptionRecordingStateChange
                  }
                />
              </div>
              <div
                className="h-full"
                style={{
                  display:
                    inputMethod === 'realtime_translation' ? 'block' : 'none',
                }}>
                <MeetingMinutesRealtimeTranslation
                  onTranscriptChange={handleRealtimeTranslationTranscriptChange}
                  onRecordingStateChange={
                    handleRealtimeTranslationRecordingStateChange
                  }
                />
              </div>
              <div
                className="h-full"
                style={{
                  display: inputMethod === 'direct' ? 'block' : 'none',
                }}>
                <MeetingMinutesDirect
                  onTranscriptChange={handleDirectTranscriptChange}
                />
              </div>
              <div
                className="h-full"
                style={{ display: inputMethod === 'file' ? 'block' : 'none' }}>
                <MeetingMinutesFile
                  onTranscriptChange={handleFileTranscriptChange}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Generation Panel */}
        <div
          className={`min-h-0 transition-all duration-300 ease-in-out ${
            activePanel === 'generation'
              ? 'block w-full'
              : activePanel === 'both'
                ? 'block w-1/2'
                : 'hidden'
          }`}>
          <Card className="flex h-full flex-col">
            <MeetingMinutesGeneration transcriptText={currentTranscriptText} />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MeetingMinutesPage;
