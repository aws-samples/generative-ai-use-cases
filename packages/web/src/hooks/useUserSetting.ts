import useLocalStorageBoolean from './useLocalStorageBoolean';

const useUserSetting = () => {
  const [settingTypingAnimation, setSettingTypingAnimation] =
    useLocalStorageBoolean('typingAnimation', true);

  return {
    settingTypingAnimation,
    setSettingTypingAnimation,
  };
};

export default useUserSetting;
