import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TRANSCRIBE_AUTO_DETECT_LANGUAGES } from '@generative-ai-use-cases/common';

export type TranscribeAutoDetectLanguage =
  (typeof TRANSCRIBE_AUTO_DETECT_LANGUAGES)[number];

/** Display names of the languages a user can choose for auto-detection. */
const useTranscribeLanguageLabels = (): Record<
  TranscribeAutoDetectLanguage,
  string
> => {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      'ja-JP': t('meetingMinutes.language_japanese'),
      'en-US': t('meetingMinutes.language_english'),
      'zh-CN': t('meetingMinutes.language_chinese'),
      'ko-KR': t('meetingMinutes.language_korean'),
      'th-TH': t('meetingMinutes.language_thai'),
      'vi-VN': t('meetingMinutes.language_vietnamese'),
    }),
    [t]
  );
};

export default useTranscribeLanguageLabels;
