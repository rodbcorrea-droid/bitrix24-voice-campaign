import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'data/', 'coverage/'],
  },
];
