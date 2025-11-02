// @ts-check
import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default defineConfig(
  // Global ignores (equivalent to .eslintignore)
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.svelte-kit/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.d.ts',
      'context-slicer/**',
    ],
  },

  // Base configs for all files
  eslint.configs.recommended,
  
  // Global language options
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2021,
      },
    },
  },

  // TypeScript-specific configuration
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    extends: [
      ...tseslint.configs.recommended,
    ],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // Enforce TypeScript Strictness - forbid 'any'
      '@typescript-eslint/no-explicit-any': 'error',

      // Enforce TypeScript Strictness - forbid non-null assertions ('!')
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Prevent unhandled promises
      '@typescript-eslint/no-floating-promises': 'error',

      // Allow unused variables if prefixed with underscore
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // JavaScript-specific configuration
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    // Disable type-checked rules for JavaScript files
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      // Allow unused variables if prefixed with underscore
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Universal rules for all files
  {
    rules: {
      // Logging Standard - flag console.log but allow warn, error, info, debug
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
    },
  }
);