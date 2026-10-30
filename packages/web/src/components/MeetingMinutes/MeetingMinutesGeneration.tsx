import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import queryString from 'query-string';
import { toast } from 'sonner';
import { PiGearSix, PiDownloadSimple, PiPencilLine } from 'react-icons/pi';
import Button from '../Button';
import ButtonCopy from '../ButtonCopy';
import ButtonIcon from '../ButtonIcon';
import Markdown from '../Markdown';
import MeetingMinutesSettingsModal from './MeetingMinutesSettingsModal';
import useMeetingMinutes from '../../hooks/useMeetingMinutes';
import useMeetingMinutesCustomPromptApi from '../../hooks/useMeetingMinutesCustomPromptApi';
import useUseCases from '../../hooks/useUseCases';
import { MODELS } from '../../hooks/useModel';
import { MeetingMinutesParams, DiagramOption } from '../../prompts';
import { claudePrompter } from '../../prompts/claude';
import { decomposeId } from '../../utils/ChatUtils';

interface MeetingMinutesGenerationProps {
  /** Current transcript text to generate minutes from */
  transcriptText: string;
}

const MeetingMinutesGeneration: React.FC<MeetingMinutesGenerationProps> = ({
  transcriptText,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enabled } = useUseCases();
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldGenerateRef = useRef<boolean>(false);

  // Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Internal state management
  const [minutesStyle, setMinutesStyle] =
    useState<MeetingMinutesParams['style']>('summary');
  const [customPrompt, setCustomPrompt] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [generationFrequency, setGenerationFrequency] = useState(5);
  const [autoGenerateSessionTimestamp] = useState<number | null>(null);
  const [generatedMinutes, setGeneratedMinutes] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  // Diagram options for 'diagram' style
  const [diagramOptions, setDiagramOptions] = useState<DiagramOption[]>([
    'mindmap',
  ]);

  // Saved custom prompts
  const meetingMinutesCustomPromptApi = useMeetingMinutesCustomPromptApi();
  const { data: savedPrompts, mutate: mutateSavedPrompts } =
    meetingMinutesCustomPromptApi.listMeetingMinutesCustomPrompts();

  // Resolve effective custom prompt for saved prompts
  const effectiveCustomPrompt = useMemo(() => {
    if (minutesStyle.startsWith('savedPrompt:') && savedPrompts) {
      const promptId = minutesStyle.replace('savedPrompt:', '');
      const found = savedPrompts.find((p) => {
        const decomposed = decomposeId(p.meetingMinutesCustomPromptId);
        return decomposed === promptId;
      });
      return found?.meetingMinutesCustomPromptBody || '';
    }
    return customPrompt;
  }, [minutesStyle, savedPrompts, customPrompt]);

  // Toggle diagram option
  const toggleDiagramOption = useCallback((option: DiagramOption) => {
    setDiagramOptions((prev) => {
      if (prev.includes(option)) {
        // Don't allow removing the last option
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((o) => o !== option);
      } else {
        return [...prev, option];
      }
    });
  }, []);

  // Model selection
  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const [modelId, setModelId] = useState(availableModels[0] || '');

  // Meeting minutes hook
  const {
    loading: minutesLoading,
    generateMinutes,
    clearMinutes,
  } = useMeetingMinutes(
    minutesStyle,
    effectiveCustomPrompt,
    autoGenerateSessionTimestamp,
    setGeneratedMinutes,
    () => {}, // Empty function for setLastProcessedTranscript
    () => {}, // Empty function for setLastGeneratedTime
    minutesStyle === 'diagram' ? diagramOptions : undefined
  );

  // Text existence check
  const hasTranscriptText = useMemo(() => {
    return transcriptText.trim() !== '';
  }, [transcriptText]);

  // Get style label for display
  const styleLabel = useMemo(() => {
    if (minutesStyle.startsWith('savedPrompt:') && savedPrompts) {
      const promptId = minutesStyle.replace('savedPrompt:', '');
      const found = savedPrompts.find((p) => {
        const decomposed = decomposeId(p.meetingMinutesCustomPromptId);
        return decomposed === promptId;
      });
      if (found) {
        return `${t('meetingMinutes.saved_prompt_prefix')} ${found.meetingMinutesCustomPromptTitle}`;
      }
    }
    const builtinStyles: Record<string, string> = {
      summary: t('meetingMinutes.style_summary'),
      detail: t('meetingMinutes.style_detail'),
      faq: t('meetingMinutes.style_faq'),
      transcription: t('meetingMinutes.style_transcription'),
      diagram: t('meetingMinutes.style_diagram'),
      newspaper: t('meetingMinutes.style_newspaper'),
      whiteboard: t('meetingMinutes.style_whiteboard'),
      custom: t('meetingMinutes.style_custom'),
    };
    return builtinStyles[minutesStyle] || minutesStyle;
  }, [minutesStyle, savedPrompts, t]);

  // CRUD handlers for saved prompts
  const handleCreatePrompt = useCallback(
    async (title: string, body: string) => {
      await meetingMinutesCustomPromptApi.createMeetingMinutesCustomPrompt(
        title,
        body
      );
      await mutateSavedPrompts();
      toast.success(t('meetingMinutes.saved_prompt_created'));
    },
    [meetingMinutesCustomPromptApi, mutateSavedPrompts, t]
  );

  const handleUpdatePrompt = useCallback(
    async (id: string, title: string, body: string) => {
      await meetingMinutesCustomPromptApi.updateMeetingMinutesCustomPrompt(
        id,
        title,
        body
      );
      await mutateSavedPrompts();
      toast.success(t('meetingMinutes.saved_prompt_updated'));
    },
    [meetingMinutesCustomPromptApi, mutateSavedPrompts, t]
  );

  const handleDeletePrompt = useCallback(
    async (id: string) => {
      await meetingMinutesCustomPromptApi.deleteMeetingMinutesCustomPrompt(id);
      await mutateSavedPrompts();
      // Fall back to 'custom' style, preserving the prompt body
      if (minutesStyle.startsWith('savedPrompt:')) {
        setCustomPrompt(effectiveCustomPrompt);
        setMinutesStyle('custom');
      }
      toast.success(t('meetingMinutes.saved_prompt_deleted'));
    },
    [
      meetingMinutesCustomPromptApi,
      mutateSavedPrompts,
      minutesStyle,
      effectiveCustomPrompt,
      t,
    ]
  );

  // Watch for generation signal and trigger generation
  useEffect(() => {
    if (
      shouldGenerateRef.current &&
      autoGenerate &&
      transcriptText.trim() !== ''
    ) {
      if (!minutesLoading) {
        shouldGenerateRef.current = false;
        generateMinutes(
          transcriptText,
          modelId,
          (status) => {
            if (status === 'success') {
              toast.success(t('meetingMinutes.generation_success'));
            } else if (status === 'error') {
              toast.error(t('meetingMinutes.generation_error'));
            }
          },
          generatedMinutes
        );
      } else {
        shouldGenerateRef.current = false;
      }
    }
  }, [
    countdownSeconds,
    autoGenerate,
    transcriptText,
    minutesLoading,
    generateMinutes,
    modelId,
    t,
    generatedMinutes,
  ]);

  // Auto-generation countdown setup
  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (!autoGenerate || generationFrequency <= 0) {
      setCountdownSeconds(0);
      return;
    }

    const totalSeconds = generationFrequency * 60;
    setCountdownSeconds(totalSeconds);

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        const newValue = prev - 1;
        if (newValue <= 0) {
          shouldGenerateRef.current = true;
          return totalSeconds;
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

  // Manual generation handler
  const handleManualGeneration = useCallback(() => {
    if (
      minutesStyle === 'custom' &&
      (!customPrompt || customPrompt.trim() === '')
    ) {
      toast.error(t('meetingMinutes.custom_prompt_placeholder'));
      return;
    }

    if (hasTranscriptText && !minutesLoading) {
      generateMinutes(
        transcriptText,
        modelId,
        (status) => {
          if (status === 'success') {
            toast.success(t('meetingMinutes.generation_success'));
          } else if (status === 'error') {
            toast.error(t('meetingMinutes.generation_error'));
          }
        },
        generatedMinutes
      );
    }
  }, [
    hasTranscriptText,
    transcriptText,
    minutesLoading,
    modelId,
    generateMinutes,
    t,
    minutesStyle,
    customPrompt,
    generatedMinutes,
  ]);

  // Clear minutes handler
  const handleClearMinutes = useCallback(() => {
    clearMinutes();
  }, [clearMinutes]);

  // Get system prompt for preview
  const getSystemPrompt = useCallback(
    (
      style: MeetingMinutesParams['style'],
      customPromptOverride?: string,
      diagramOptionsOverride?: DiagramOption[]
    ) => {
      const params: MeetingMinutesParams = {
        style,
        customPrompt: customPromptOverride || customPrompt,
        diagramOptions: diagramOptionsOverride || diagramOptions,
      };
      return claudePrompter.meetingMinutesPrompt(params);
    },
    [customPrompt, diagramOptions]
  );

  // Open the generated minutes in the Writer use case for editing
  // (navigates to the existing /writer route; the old /edit route was removed)
  const handleEditInWriter = useCallback(() => {
    if (!generatedMinutes) return;
    navigate(
      `/writer?${queryString.stringify({ sentence: generatedMinutes })}`
    );
  }, [generatedMinutes, navigate]);

  // Download minutes as markdown file
  const handleDownload = useCallback(() => {
    if (!generatedMinutes) return;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const filename = `${now.getFullYear().toString().slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}-meeting-minutes.md`;
    const blob = new Blob([generatedMinutes], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedMinutes]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Compact header with settings button and action buttons */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ButtonIcon onClick={() => setIsSettingsOpen(true)}>
            <PiGearSix className="text-xl" />
          </ButtonIcon>
          {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
          <span
            onClick={() => setIsSettingsOpen(true)}
            className="cursor-pointer text-sm text-gray-600">
            {`${styleLabel} / ${modelDisplayName(modelId)}`}
          </span>
          {autoGenerate && countdownSeconds > 0 && (
            // eslint-disable-next-line @shopify/jsx-no-hardcoded-content
            <span className="text-sm text-gray-500">
              {`(${t('meetingMinutes.next_generation')}${t('common.colon')} ${Math.floor(countdownSeconds / 60)}:${(countdownSeconds % 60).toString().padStart(2, '0')})`}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            disabled={!hasTranscriptText || minutesLoading}
            onClick={handleManualGeneration}
            loading={minutesLoading}>
            {t('meetingMinutes.generate')}
          </Button>
          <Button outlined onClick={handleClearMinutes}>
            {t('meetingMinutes.clear_minutes')}
          </Button>
        </div>
      </div>

      {/* Generated minutes display - now takes most of the space */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <div className="font-bold">
            {t('meetingMinutes.generated_minutes')}
          </div>
          {generatedMinutes && (
            <div className="flex gap-1">
              <ButtonCopy text={generatedMinutes} interUseCasesKey="minutes" />
              {enabled('writer') && (
                <ButtonIcon
                  title={t('meetingMinutes.edit_in_writer')}
                  onClick={handleEditInWriter}>
                  <PiPencilLine className="text-xl" />
                </ButtonIcon>
              )}
              <ButtonIcon onClick={handleDownload}>
                <PiDownloadSimple className="text-xl" />
              </ButtonIcon>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded border border-black/30 p-3">
          {generatedMinutes ? (
            <Markdown>{generatedMinutes}</Markdown>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">
              {t('meetingMinutes.minutes_placeholder')}
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <MeetingMinutesSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        minutesStyle={minutesStyle}
        setMinutesStyle={setMinutesStyle}
        modelId={modelId}
        setModelId={setModelId}
        availableModels={availableModels}
        modelDisplayName={modelDisplayName}
        customPrompt={customPrompt}
        setCustomPrompt={setCustomPrompt}
        diagramOptions={diagramOptions}
        toggleDiagramOption={toggleDiagramOption}
        autoGenerate={autoGenerate}
        setAutoGenerate={setAutoGenerate}
        generationFrequency={generationFrequency}
        setGenerationFrequency={setGenerationFrequency}
        getSystemPrompt={getSystemPrompt}
        savedPrompts={savedPrompts}
        onCreatePrompt={handleCreatePrompt}
        onUpdatePrompt={handleUpdatePrompt}
        onDeletePrompt={handleDeletePrompt}
      />
    </div>
  );
};

export default MeetingMinutesGeneration;
