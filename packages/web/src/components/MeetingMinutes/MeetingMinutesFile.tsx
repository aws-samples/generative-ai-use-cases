import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import useUserSetting from '../../hooks/useUserSetting';
import useTranscribeLanguageLabels, {
  TranscribeAutoDetectLanguage,
} from '../../hooks/useTranscribeLanguageLabels';
import Button from '../Button';
import ButtonCopy from '../ButtonCopy';
import ButtonSendToUseCase from '../ButtonSendToUseCase';
import Select from '../Select';
import Switch from '../Switch';
import RangeSlider from '../RangeSlider';
import ExpandableField from '../ExpandableField';
import Textarea from '../Textarea';
import useTranscribe from '../../hooks/useTranscribe';

interface MeetingMinutesFileProps {
  /** Callback when transcript text changes */
  onTranscriptChange?: (text: string) => void;
}

const MeetingMinutesFile: React.FC<MeetingMinutesFileProps> = ({
  onTranscriptChange,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transcription hook
  const { loading, transcriptData, file, setFile, transcribe, clear } =
    useTranscribe();

  // Internal state management
  const [fileTranscriptText, setFileTranscriptText] = useState('');
  const [languageCode, setLanguageCode] = useState('auto');
  // Default to automatic language identification; the candidates are the
  // user's choice on the Settings page, shown under the selector.
  const { settingTranscribeLanguageOptions } = useUserSetting();
  const transcribeLanguageLabels = useTranscribeLanguageLabels();
  const [speakerLabel, setSpeakerLabel] = useState(false);
  const [maxSpeakers, setMaxSpeakers] = useState(4);
  const [speakers, setSpeakers] = useState('');

  // Language options
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

  // Speaker mapping
  const speakerMapping = useMemo(() => {
    return Object.fromEntries(
      speakers.split(',').map((speaker, idx) => [`spk_${idx}`, speaker.trim()])
    );
  }, [speakers]);

  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setFile(files[0]);
    }
  };

  // Process transcript data when available
  useEffect(() => {
    if (transcriptData && transcriptData.transcripts) {
      const fileText = transcriptData.transcripts
        .map((transcript) => {
          const speakerLabel = transcript.speakerLabel
            ? `${speakerMapping[transcript.speakerLabel] || transcript.speakerLabel}: `
            : '';
          return `${speakerLabel}${transcript.transcript}`;
        })
        .join('\n');

      setFileTranscriptText(fileText);
      onTranscriptChange?.(fileText);
    }
  }, [transcriptData, speakerMapping, onTranscriptChange]);

  // Text existence check
  const hasTranscriptText = useMemo(() => {
    return fileTranscriptText.trim() !== '';
  }, [fileTranscriptText]);

  // Execution states
  const disabledExec = useMemo(() => {
    return !file || loading;
  }, [file, loading]);

  const disableClearExec = useMemo(() => {
    const hasData = file || hasTranscriptText;
    return !hasData || loading;
  }, [file, hasTranscriptText, loading]);

  // Execute transcription
  const onClickExec = useCallback(() => {
    if (loading) return;
    const langCode = languageCode === 'auto' ? undefined : languageCode;
    transcribe(speakerLabel, maxSpeakers, langCode);
  }, [loading, languageCode, speakerLabel, maxSpeakers, transcribe]);

  // Clear function
  const onClickClear = useCallback(() => {
    setFileTranscriptText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    clear();
    onTranscriptChange?.('');
  }, [clear, onTranscriptChange]);

  return (
    <div>
      {/* File Upload Content */}
      <div className="mb-4">
        <div className="p-2">
          <input
            className="border-aws-font-color/20 block h-10 w-full cursor-pointer rounded-lg border
              text-sm text-gray-900 file:mr-4 file:cursor-pointer file:border-0 file:bg-gray-500
              file:px-4 file:py-2.5 file:text-white focus:outline-none"
            onChange={handleFileChange}
            aria-describedby="file_input_help"
            id="file_input"
            type="file"
            accept=".mp3, .mp4, .wav, .flac, .ogg, .amr, .webm, .m4a"
            ref={fileInputRef}></input>
          <p className="ml-0.5 mt-1 text-xs text-gray-500" id="file_input_help">
            {t('transcribe.supported_files')}
          </p>
        </div>
      </div>

      {/* Language Selection */}
      <div className="mb-4 px-2">
        <label className="mb-2 block font-bold">
          {t('meetingMinutes.language')}
        </label>
        <Select
          value={languageCode}
          onChange={setLanguageCode}
          options={languageOptions}
        />
        {languageCode === 'auto' && (
          <div className="mt-1 text-xs text-gray-500">
            {t('meetingMinutes.auto_detect_candidates', {
              languages: settingTranscribeLanguageOptions
                .map(
                  (code) =>
                    transcribeLanguageLabels[
                      code as TranscribeAutoDetectLanguage
                    ] ?? code
                )
                .join(', '),
            })}{' '}
            <Link to="/setting" className="underline">
              {t('meetingMinutes.auto_detect_change')}
            </Link>
          </div>
        )}
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

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button outlined disabled={disableClearExec} onClick={onClickClear}>
          {t('common.clear')}
        </Button>
        <Button disabled={disabledExec} onClick={onClickExec}>
          {t('meetingMinutes.speech_recognition')}
        </Button>
      </div>

      {/* Transcript Panel */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-bold">{t('meetingMinutes.transcript')}</div>
          {hasTranscriptText && (
            <div className="flex">
              <ButtonCopy
                text={fileTranscriptText}
                interUseCasesKey="transcript"></ButtonCopy>
              <ButtonSendToUseCase text={fileTranscriptText} />
            </div>
          )}
        </div>
        <textarea
          value={fileTranscriptText}
          placeholder={t('transcribe.result_placeholder')}
          rows={10}
          className="min-h-96 w-full resize-none rounded border border-black/30 p-1.5 outline-none"
          readOnly
        />
        {loading && (
          <div className="border-aws-sky size-5 animate-spin rounded-full border-4 border-t-transparent"></div>
        )}
      </div>
    </div>
  );
};

export default MeetingMinutesFile;
