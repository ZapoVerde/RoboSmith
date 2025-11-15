// ----- vitest.config.mts -----
/**
 * @file vitest.config.mts
 * @stamp {"timestamp":"2025-11-09T11:05:00.000Z"}
 * @architectural-role Configuration
 * @description The single, authoritative Vitest configuration for the entire monorepo. It defines a unified test environment, including test file discovery, environment-switching rules, and monorepo path aliases.
 * @core-principles
 * 1. IS the single source of truth for the project-wide Vitest configuration.
 * 2. OWNS the registration of all Vite plugins (e.g., Svelte) required for the test environment.
 * 3. ORCHESTRATES test discovery and environment selection across all packages.
 *
 * @api-declaration
 *   - export default defineConfig(...)
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # Configures the test runner, which is a side effect.
 *     - external_io: "none"     # This file itself performs no I/O.
 *     - state_ownership: "none" # Does not own application state.
 */

import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'packages/client/src/**/*.spec.ts',
      'webview-ui/src/**/*.spec.ts',
    ],
    environmentMatchGlobs: [
      ['packages/**', 'node'],
      ['webview-ui/**', 'jsdom'],
    ],
    setupFiles: 'packages/client/vitest.setup.ts',
    server: {
      deps: {
        inline: [
          'parse5',
          '@testing-library/jest-dom',
          'execa',
          'uuid',
        ],
      },
    },
  },
});