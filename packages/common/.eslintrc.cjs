module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['cdk.out', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'i18nhelper', '@shopify'],
  rules: {
    '@typescript-eslint/no-namespace': 'off',
    // Detect Japanese strings
    'i18nhelper/no-jp-string': 'warn',
    'i18nhelper/no-jp-comment': 'warn',
    // Apply JSX rules
    '@shopify/jsx-no-hardcoded-content': 'warn',
  },
};
