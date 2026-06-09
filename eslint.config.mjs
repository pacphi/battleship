import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/', '*.lock', '**/*.test.js', '**/*.astro'] },

  // Base JS rules
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2024,
        ...globals.node,
      },
    },
    rules: {
      // Strict mode
      'no-var': 'error',
      'prefer-const': 'error',
      'no-param-reassign': 'warn',

      // Readability
      'max-depth': ['error', 4],
      'max-lines-per-function': ['warn', 150],
      'no-unused-expressions': 'off',

      // Style
      'comma-dangle': ['error', 'only-multiline'],
      semi: ['error', 'always'],
    },
  },

  // Game page (browser module inline)
  {
    files: ['src/pages/game.astro'],
    languageOptions: {
      globals: {
        ...globals.browser,
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'writable',
        clearTimeout: 'writable',
        setInterval: 'writable',
        clearInterval: 'writable',
        requestAnimationFrame: 'writable',
        URLSearchParams: 'readonly',
        alert: 'writable',
      },
    },
  },

  // Test files
  {
    files: ['**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        test: 'readonly',
        describe: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        expect: 'readonly',
      },
    },
  },
];
