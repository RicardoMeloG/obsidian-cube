import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Module boundaries (ADR 005, ADR 006, spec 010 H-04). Each layer lists what
// it may not import; the table is in docs/architecture.md. Imports across
// top-level modules use the `@/` alias, so a relative path that climbs into
// another module is itself an error and the rules below cannot be bypassed
// with `../`. Proved by scripts/checks/boundaries.test.ts.
const THREE = ['^three($|/)', '^@react-three/']
const CROSS_MODULE = [
  { regex: '^(\\.\\./)+(app|features|ui|lib|styles|kernel)(/|$)', message: 'Import another top-level module through @/ (ADR 006).' },
  { regex: '^(\\.\\./)+(scene|faces|navigation|stage|content|experience|audio|dev)(/|$)', message: 'Import another feature through @/features/… (ADR 006).' },
]

function boundary(files, forbidden, message) {
  return {
    files,
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...CROSS_MODULE, ...forbidden.map((regex) => ({ regex, message }))] }],
    },
  }
}

// Interface code never compares locales (copy lives in the dictionary, AD-07)
// and loads nothing lazily (only the scene's worlds and the dev showcase do).
const LOCALE_LITERAL = {
  selector: "BinaryExpression[operator=/^[!=]==?$/] > Literal[value=/^(en|es)$/]",
  message: 'Read interface strings from src/features/content/copy.ts instead of comparing locales (ADR 006, AD-07).',
}
// The stage shows content only (spec 011, AD-07): no words written in its
// markup. Interface strings come from copy.ts, owner text from the content.
const STAGE_TEXT = [
  { selector: 'JSXText[value=/[A-Za-zÀ-ÿ]{2,}[ ]+[A-Za-zÀ-ÿ]{2,}/]', message: 'Stage text comes from the content or copy.ts, never from the markup (spec 011, AD-07).' },
  {
    selector: "JSXAttribute[name.name=/^(aria-label|title|alt|placeholder)$/] > Literal[value=/[A-Za-zÀ-ÿ]{2,}/]",
    message: 'Stage labels come from the content or copy.ts (spec 011, AD-07).',
  },
]
const DYNAMIC_IMPORT = {
  selector: 'ImportExpression',
  message: 'Only the scene (worlds) and the app (dev showcase) load code lazily (ADR 006).',
}

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

  boundary(['src/app/**/*.{ts,tsx}'], [], ''),
  boundary(['src/ui/**/*.{ts,tsx}'], ['^@/(features|app)/', ...THREE], 'ui/ holds presentational primitives: no features, app or 3D (ADR 006).'),
  boundary(['src/lib/**/*.{ts,tsx}'], ['^@/', ...THREE], 'lib/ holds React utilities any layer may use; it imports React only (ADR 006).'),
  boundary(['src/styles/**/*.{ts,tsx}'], ['^@/', ...THREE], 'styles/ is a leaf: tokens and layout modes only.'),
  boundary(
    ['src/features/experience/**/*.{ts,tsx}'],
    ['^@/features/(?!experience/)', '^@/(ui|app)/', ...THREE],
    'The experience store is shared by the scene and the DOM: it imports only the kernel and lib (ADR 006).',
  ),
  boundary(
    ['src/features/scene/**/*.{ts,tsx}'],
    ['^@/features/(faces|navigation|content|dev)/', '^@/(ui|app)/'],
    'The scene and the DOM meet only in the experience store (ADR 006).',
  ),
  boundary(
    ['src/features/{faces,navigation,stage}/**/*.{ts,tsx}'],
    ['^@/features/(scene|audio|dev)/', '^@/app/', ...THREE],
    'DOM features do not reach into the scene; they meet it in the experience store (ADR 006).',
  ),
  boundary(['src/features/content/**/*.{ts,tsx}'], ['^@/features/(?!content/)', '^@/(ui|app)/', ...THREE], 'content/ loads and words the content; it depends on the kernel only.'),
  boundary(['src/features/audio/**/*.{ts,tsx}'], ['^@/'], 'audio/ is a leaf used by the scene.'),
  boundary(['src/features/dev/**/*.{ts,tsx}'], ['^@/app/'], 'dev/ tools are reached from the app, never the reverse.'),

  {
    files: ['src/{ui,lib,styles}/**/*.{ts,tsx}', 'src/features/{experience,faces,navigation,audio,dev}/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', LOCALE_LITERAL, DYNAMIC_IMPORT] },
  },
  {
    files: ['src/features/stage/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { 'no-restricted-syntax': ['error', LOCALE_LITERAL, DYNAMIC_IMPORT, ...STAGE_TEXT] },
  },
  {
    // content/ resolves the locale, so it may compare it; it loads nothing lazily.
    files: ['src/features/content/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', DYNAMIC_IMPORT] },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/features/scene/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', LOCALE_LITERAL] },
  },

  // The content kernel is pure (ADR 005): zod and its own files only, plus the
  // committed example content it bundles as defaults.
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
              regex: '^(\\.\\./)+(features|app|ui|styles|lib|scripts|server|infra)(/|$)',
              message: 'The content kernel must not import the site or the tooling (ADR 005).',
            },
            {
              regex: '^(\\.\\./){2,}(?!public/content/)',
              message: 'The content kernel reaches outside itself only for the example content (ADR 005).',
            },
          ],
        },
      ],
      'no-restricted-syntax': ['error', DYNAMIC_IMPORT],
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
