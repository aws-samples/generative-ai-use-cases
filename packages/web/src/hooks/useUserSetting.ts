import useLocalStorageBoolean from './useLocalStorageBoolean';

const useUserSetting = () => {
  const [settingTypingAnimation, setSettingTypingAnimation] =
    useLocalStorageBoolean('typingAnimation', true);
  const [settingShowUseCaseBuilder, setSettingShowUseCaseBuilder] =
    useLocalStorageBoolean('showUseCaseBuilder', true);
  const [settingShowTools, setSettingShowTools] = useLocalStorageBoolean(
    'showTools',
    true
  );

  return {
    settingTypingAnimation,
    setSettingTypingAnimation,
    settingShowUseCaseBuilder,
    setSettingShowUseCaseBuilder,
    settingShowTools,
    setSettingShowTools,
  };
};

export default useUserSetting;
