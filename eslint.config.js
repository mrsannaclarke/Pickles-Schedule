import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'app', 'scripts', 'lib/*.tsx', 'lib/useScheduleData.ts', 'lib/art-upload.ts', 'lib/auth.tsx', 'lib/audit-log.ts', 'lib/claim-spot.ts', 'lib/game-opt-out.ts', 'lib/notify.ts', 'lib/staff-actions.ts', 'lib/staff-colors.tsx', 'lib/fancy-feedback.tsx'] },
  { extends: [js.configs.recommended, ...tseslint.configs.recommended], files: ['src/**/*.{ts,tsx}', 'lib/schedule.ts'], languageOptions: { ecmaVersion: 2022, globals: globals.browser }, plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh }, rules: { ...reactHooks.configs.recommended.rules, 'react-refresh/only-export-components': 'off' } },
);
