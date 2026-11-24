import js from '@eslint/js';
import globals from 'globals';

const rules = {
  // Incremental: avisos OK; no bloquear PRs el primer día.
  'no-unused-vars': ['warn', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
  }],
  'no-empty': ['warn', { allowEmptyCatch: true }],
  'no-constant-condition': ['warn', { checkLoops: false }],
  'no-prototype-builtins': 'warn',
  'no-useless-assignment': 'warn',
  'no-useless-escape': 'warn',
  'no-sparse-arrays': 'warn',
  'no-cond-assign': 'warn',
  'no-fallthrough': 'warn',
  'no-redeclare': 'warn',
  'no-undef': 'error',
  'no-regex-spaces': 'warn',
};

/** ESLint recommended en el cliente, la API Node y las pruebas. */
export default [
  {
    ignores: [
      'node_modules/**',
      'tamp/dist/**',
      'tamp/public/**',
      '.vercel/**',
      'eslint.config.js',
    ],
  },
  {
    files: ['tamp/src/**/*.{js,mjs}', 'tests/**/*.{js,mjs}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        __APP_VERSION__: 'readonly',
        katex: 'readonly',
      },
    },
    rules,
  },
  {
    files: ['api/**/*.{js,mjs}', 'scripts/**/*.{js,mjs}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules,
  },
];
