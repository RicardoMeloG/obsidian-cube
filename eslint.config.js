import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `infra/` (AWS CDK) is a separate package with its own toolchain.
  globalIgnores(['dist', 'infra']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // The content kernel is pure (ADR 005): zod and its own files only.
  {
    files: ['src/kernel/**/*.ts'],
    ignores: ['src/kernel/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!zod$|\\.{1,2}/)',
              message: 'The content kernel depends on zod only (ADR 005).',
            },
            {
              regex: '^(\\.\\./)+(features|app|ui|styles)(/|$)',
              message: 'The content kernel must not import the site (ADR 005).',
            },
          ],
        },
      ],
    },
  },
  // The local NestJS admin (CommonJS, Node) reaches the site only through the
  // kernel (ADR 005, spec 010 H-04b).
  {
    files: ['server/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(\\.\\./)+src/(?!kernel/)',
              message: 'The admin server may import only src/kernel (ADR 005).',
            },
          ],
        },
      ],
    },
  },
])
