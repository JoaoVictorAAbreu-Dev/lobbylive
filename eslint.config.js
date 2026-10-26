import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'web/dist/**', 'web/node_modules/**'] },
  js.configs.recommended,
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', fetch: 'readonly', AbortSignal: 'readonly' } } },
  ...tseslint.configs.recommended,
  { files: ['**/*.ts'], rules: { '@typescript-eslint/consistent-type-imports': 'off' } },
  { files: ['*.cjs'], languageOptions: { sourceType: 'commonjs' }, rules: { '@typescript-eslint/no-require-imports': 'off' } },
);
