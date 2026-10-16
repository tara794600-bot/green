import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// 서버 JS에는 Node 전역을, TS/TSX에는 브라우저·React 규칙을 적용합니다.
export default defineConfig([
  globalIgnores(['dist', 'svg', 'design-reference', '.local', 'artifacts', 'test-results']),
  {
    files: ['server/**/*.mjs', 'scripts/**/*.mjs', 'api/**/*.js', 'tests/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
