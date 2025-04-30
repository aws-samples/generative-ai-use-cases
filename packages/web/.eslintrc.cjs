module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:tailwindcss/recommended',
    'plugin:yml/standard',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  overrides: [
    {
      files: ['*.yaml', '*.yml'],
      parser: 'yaml-eslint-parser',
    },
  ],
  plugins: ['react-refresh', 'i18nhelper', '@shopify', 'yml'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Disable ESLint rules because Prettier will handle them
    'tailwindcss/classnames-order': ['off'],
    // There is a bug that x-screen h-screen is written as size-screen, but size-screen does not exist.
    // So this rule is temporarily disabled.
    // https://github.com/francoismassart/eslint-plugin-tailwindcss/issues/307
    'tailwindcss/enforces-shorthand': ['off'],
    // Detect Japanese strings
    'i18nhelper/no-jp-string': 'warn',
    'i18nhelper/no-jp-comment': 'warn',
    // Apply JSX rules
    '@shopify/jsx-no-hardcoded-content': 'warn',
    // Yaml
    'yml/sort-keys': 'error',
    'yml/quotes': ['error', { prefer: 'single', avoidEscape: true }],
  },
  settings: {
    tailwindcss: {
      // The following warnings are suppressed
      // Classname 'w-' is not a Tailwind CSS class!
      // Classname 'h-' is not a Tailwind CSS class!
      whitelist: ['w-', 'h-'],
    },
  },
};
