import useLocalStorageBoolean from './useLocalStorageBoolean';

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

  return {
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
