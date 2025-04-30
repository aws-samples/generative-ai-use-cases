import { noJpString } from './rules/no-japanese-strings';
import { noJpComment } from './rules/no-jp-comment';

export = {
  rules: {
    'no-jp-string': noJpString,
    'no-jp-comment': noJpComment,
  },
  configs: {
    recommended: {
      plugins: ['i18nhelper'],
      rules: {
        'i18nhelper/no-jp-string': 'warn',
        'i18nhelper/no-jp-comment': 'warn',
      },
    },
  },
};
