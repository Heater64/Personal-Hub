import js from '@eslint/js';
import globals from 'globals';

/** ESLint mínimo — día 1: recommended en warn sobre el frontend + tests. */
export default [
  {
    ignores: [
      'node_modules/**',
      'personal-hub/dist/**',
      'personal-hub/public/**',
      'api/**',
      'scripts/**',
      '.vercel/**',
      'eslint.config.js',
    ],
  },
  {
    files: ['personal-hub/src/**/*.{js,mjs}', 'tests/**/*.{js,mjs}'],
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
    rules: {
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
    },
  },
];
