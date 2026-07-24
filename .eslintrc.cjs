module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  globals: {
    __APP_VERSION__: 'readonly',
    __APP_BUILD_DATE__: 'readonly',
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'vite.config.js'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off',
    // `_foo` is the codebase's existing convention for "intentionally unused"
    // (e.g. a param kept for API-shape/future use — see fetchTicketTypesForEvent).
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Intentional `while (true) { ... if (cond) break/return ... }` loops
    // (e.g. generationTaskPoll.js) are a deliberate pattern, not a mistake —
    // only flag constant conditions outside of loops.
    'no-constant-condition': ['error', { checkLoops: false }],
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        // Same "no-unused-vars" role as eslint:recommended, but TS-aware
        // (doesn't flag types/interfaces only used in annotations).
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        // recommended ships this as "error"; the existing .ts/.tsx files
        // (which were entirely unlinted until now) use `any` ~40 times.
        // Downgraded to warn so turning on TS linting doesn't instantly
        // break `npm run lint`'s exit code — tighten to error once those
        // are cleaned up.
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ],
}
