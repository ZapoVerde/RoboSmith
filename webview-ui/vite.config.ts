/**
 * @file webview-ui/vite.config.ts
 * @stamp S-20251101-T021900Z-C-WEBVIEW-CONFIG
 * @architectural-role Configuration
 * @description
 * Configures Vite and Vitest for Svelte 5 webview UI with explicit transformation
 * rules. Uses a unified plugin configuration that works in both dev and test modes.
 * @core-principles
 * 1. ENFORCES proper Svelte file transformation before import analysis.
 * 2. OWNS the unified Vite plugin configuration for dev and test.
 * 3. MUST disable CSS emission in tests to prevent side effects.
 * 4. ORCHESTRATES test environment setup via setupFiles.
 *
 * @api-declaration
 *   - export default defineConfig(...)
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # Configures build/test with side effects.
 *     - external_io: "none"     # No direct I/O.
 *     - state_ownership: "none" # No application state.
 */

import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    // The svelte plugin is now configured with an option.
    // We check for the VITEST environment variable, which Vitest sets automatically.
    // If it's running, we disable the 'hot' (HMR) option.
    svelte({ hot: !process.env.VITEST })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});