// src/i18n/config.ts

import i18n from 'i18next';
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import yaml from 'js-yaml';

/* eslint-disable i18nhelper/no-jp-string */
/* eslint-disable i18nhelper/no-jp-comment */

// Define the supported languages as an object.
// This is for use when the user manually switches languages.
export const supportedLngs = {
  en: 'English',
  ja: '日本語',
  th: 'ไทย',
  // zh: '中文',
  // ko: '한국어',
};

i18n
  .use(HttpApi)
  .use(LanguageDetector) // To detect the user's language setting
  .use(initReactI18next) // Initialize the i18next instance
  .init({
    backend: {
      loadPath: '/locales/{{ns}}/{{lng}}.yaml',
      parse: (data: string) => yaml.load(data),
    },
    defaultNS: 'translation',
    ns: ['translation', 'prompts'],
    fallbackLng: 'en', // The fallback language. This language is used if no specified language file exists.
    returnEmptyString: false, // Allow definition with empty strings
    supportedLngs: Object.keys(supportedLngs),
    debug: true, // Messages will be displayed in the development console if true

    // The default is `escapeValue: true`
    // 18next escapes code in translation messages to protect against XSS attacks.
    // React does this escape for us, so we turn it off this time.
    interpolation: {
      escapeValue: false,
      format: (value, format) => {
        if (format === 'uppercase') return value.toUpperCase();
        if (format === 'lowercase') return value.toLowerCase();
        return value;
      },
    },
    react: {
      transKeepBasicHtmlNodesFor: ['wbr'],
    },
  });

export default i18n;
