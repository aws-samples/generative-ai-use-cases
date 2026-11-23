import { useCallback, useMemo } from 'react';
import useLocalStorageBoolean from './useLocalStorageBoolean';
import useLocalStorage from './useLocalStorage';
import {
  TRANSCRIBE_LANGUAGE_OPTIONS_STORAGE_KEY,
  parseTranscribeLanguageOptions,
} from '../utils/AudioUtils';

const useUserSetting = () => {
  const [settingSubmitCmdOrCtrlEnter, setSettingSubmitCmdOrCtrlEnter] =
    useLocalStorageBoolean('submitCmdOrCtrlEnter', false);
  const [settingTypingAnimation, setSettingTypingAnimation] =
    useLocalStorageBoolean('typingAnimation', true);
  const [settingShowUseCaseBuilder, setSettingShowUseCaseBuilder] =
    useLocalStorageBoolean('showUseCaseBuilder', true);
  const [settingShowTools, setSettingShowTools] = useLocalStorageBoolean(
    'showTools',
    true
  );
  const [settingShowEmail, setSettingShowEmail] = useLocalStorageBoolean(
    'showEmail',
    true
  );

  // Candidate languages for automatic language identification in
  // transcription, stored as a JSON array like the other settings
  const [transcribeLanguageOptionsRaw, setTranscribeLanguageOptionsRaw] =
    useLocalStorage(TRANSCRIBE_LANGUAGE_OPTIONS_STORAGE_KEY, '');
  const settingTranscribeLanguageOptions = useMemo(
    () => parseTranscribeLanguageOptions(transcribeLanguageOptionsRaw),
    [transcribeLanguageOptionsRaw]
  );
  const setSettingTranscribeLanguageOptions = useCallback(
    (codes: string[]) => {
      setTranscribeLanguageOptionsRaw(JSON.stringify(codes));
    },
    [setTranscribeLanguageOptionsRaw]
  );

  return {
    settingTranscribeLanguageOptions,
    setSettingTranscribeLanguageOptions,
    settingSubmitCmdOrCtrlEnter,
    setSettingSubmitCmdOrCtrlEnter,
    settingTypingAnimation,
    setSettingTypingAnimation,
    settingShowUseCaseBuilder,
    setSettingShowUseCaseBuilder,
    settingShowTools,
    setSettingShowTools,
    settingShowEmail,
    setSettingShowEmail,
  };
};

export default useUserSetting;
