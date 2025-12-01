/**
 * @file vitest.config.browser.mts
 * @stamp 2025-12-01T08:00:00.000Z
 * @architectural-role Configuration
 * @description Configures the test environment for the WebView UI (Frontend).
 * @core-principles
 * 1. IS the dedicated test configuration for frontend/browser-based tests.
 * 2. ENFORCES `browser` resolution conditions to ensure Svelte 5 client-side entry points are used.
 * 3. OWNS the integration of the Svelte Vite plugin into the test runner.
 * 4. EXPLICITLY configures `vitePreprocess` to handle TypeScript in Svelte files without relying on external config loading.
 *
 * @contract
 *   assertions:
 *     purity: pure          # Returns a static configuration object.
 *     external_io: none     # Does not perform runtime I/O.
 *     state_ownership: none # Stateless configuration definition.
 */

import { defineProject } from 'vitest/config';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { fileURLToPath } from 'url';

// Derive __dirname for ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineProject({
  plugins: [
    svelte({
      // CRITICAL: Explicitly define the preprocessor here.
      preprocess: vitePreprocess(),
      configFile: false
    })
  ],
  resolve: {
    // CRITICAL: Force resolution of "browser" exports in package.json.
    conditions: ['browser'],
    alias: {
      '@shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
  test: {
    name: 'browser',
    // SWITCH: Using jsdom for better Svelte 5 compatibility
    environment: 'jsdom',
    globals: true,
    include: ['webview-ui/src/**/*.spec.ts'],
    setupFiles: ['webview-ui/vitest.setup.ts'],
    server: {
      deps: {
        inline: ['@testing-library/svelte', 'svelte'],
      },
    },
  },
});