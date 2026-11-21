import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  TRANSCRIBE_AUTO_DETECT_LANGUAGES,
  MIN_TRANSCRIBE_LANGUAGE_OPTIONS,
  MAX_TRANSCRIBE_LANGUAGE_OPTIONS,
} from '@generative-ai-use-cases/common';
import Switch from '../Switch';
import SettingItem from './SettingItem';
import useUserSetting from '../../hooks/useUserSetting';
import useTranscribeLanguageLabels from '../../hooks/useTranscribeLanguageLabels';
import { supportedLngs } from '../../i18n/config';

const SettingGeneralTab: React.FC = () => {
  const { i18n, t } = useTranslation();
  const {
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
  } = useUserSetting();

  const transcribeLanguageLabels = useTranscribeLanguageLabels();

  return (
    <div className="text-sm">
      <SettingItem
        name={t('setting.items.language')}
        value={
          <select
            value={i18n.resolvedLanguage}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="rounded border border-gray-300 py-1 pr-8 focus:border-gray-300 focus:outline-none focus:ring-0">
            {Object.entries(supportedLngs).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        }
        helpMessage={t('setting.items.language_help')}
        top={true}
      />

      <SettingItem
        name={t('setting.items.transcribe_languages')}
        value={
          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
            {TRANSCRIBE_AUTO_DETECT_LANGUAGES.map((code) => {
              const checked = settingTranscribeLanguageOptions.includes(code);
              // Keep between the minimum and maximum Transcribe accepts
              const disabled = checked
                ? settingTranscribeLanguageOptions.length <=
                  MIN_TRANSCRIBE_LANGUAGE_OPTIONS
                : settingTranscribeLanguageOptions.length >=
                  MAX_TRANSCRIBE_LANGUAGE_OPTIONS;
              return (
                <label
                  key={code}
                  className={`flex items-center gap-1 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                      setSettingTranscribeLanguageOptions(
                        TRANSCRIBE_AUTO_DETECT_LANGUAGES.filter((c) =>
                          c === code
                            ? !checked
                            : settingTranscribeLanguageOptions.includes(c)
                        )
                      )
                    }
                  />
                  {transcribeLanguageLabels[code]}
                </label>
              );
            })}
          </div>
        }
        helpMessage={t('setting.items.transcribe_languages_help')}
      />

      <SettingItem
        name={t('setting.items.line_break_enter')}
        value={
          <Switch
            checked={settingSubmitCmdOrCtrlEnter}
            label=""
            onSwitch={setSettingSubmitCmdOrCtrlEnter}
          />
        }
      />

      <SettingItem
        name={t('setting.items.typing_animation')}
        value={
          <Switch
            checked={settingTypingAnimation}
            label=""
            onSwitch={setSettingTypingAnimation}
          />
        }
      />

      <SettingItem
        name={t('setting.items.show_use_case_builder')}
        value={
          <Switch
            checked={settingShowUseCaseBuilder}
            label=""
            onSwitch={setSettingShowUseCaseBuilder}
          />
        }
      />

      <SettingItem
        name={t('setting.items.show_tools')}
        value={
          <Switch
            checked={settingShowTools}
            label=""
            onSwitch={setSettingShowTools}
          />
        }
      />

      <SettingItem
        name={t('setting.items.show_email')}
        value={
          <Switch
            checked={settingShowEmail}
            label=""
            onSwitch={setSettingShowEmail}
          />
        }
      />
    </div>
  );
};

export default SettingGeneralTab;
