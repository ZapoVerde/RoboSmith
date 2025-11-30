/**
 * @file vitest.config.browser.mts
 * @stamp S-20251130T083000Z-C-FIX-SVELTE-RES
 * @architectural-role Configuration
 * @description Configures the test environment for the WebView UI (Frontend).
 * @core-principles
 * 1. IS the dedicated test configuration for frontend/browser-based tests.
 * 2. ENFORCES `browser` resolution conditions to ensure Svelte 5 client-side entry points are used.
 * 3. OWNS the integration of the Svelte Vite plugin into the test runner.
 *
 * @contract
 *   assertions:
 *     purity: pure          # Returns a static configuration object.
 *     external_io: none     # Does not perform runtime I/O.
 *     state_ownership: none # Stateless configuration definition.
 */

import { defineProject } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { fileURLToPath } from 'url';

// Derive __dirname for ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineProject({
  plugins: [svelte()],
  resolve: {
    // CRITICAL: Force resolution of "browser" exports in package.json.
    // This ensures Svelte resolves to its client-side entry point (index-client.js)
    // instead of the server-side one (index-server.js) which lacks `mount`.
    conditions: ['browser'],
    alias: {
      '@shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
  test: {
    name: 'browser',
    // Use happy-dom for better ESM support and performance
    environment: 'happy-dom',
    globals: true,
    include: ['webview-ui/src/**/*.spec.ts'],
    setupFiles: ['webview-ui/vitest.setup.ts'],
    server: {
      deps: {
        // CRITICAL: Force 'svelte' and '@testing-library/svelte' to be processed by Vite.
        // This is required for:
        // 1. `resolve.conditions` to apply (Vite resolution).
        // 2. Svelte 5 runes to be transformed by the plugin.
        inline: ['@testing-library/svelte', 'svelte'],
      },
    },
  },
});