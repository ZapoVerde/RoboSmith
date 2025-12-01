/**
 * @file webview-ui/vite.config.ts
 * @stamp 2025-12-01T08:00:00.000Z
 * @architectural-role Configuration
 * @description Vite build configuration for the WebView UI.
 * @core-principles
 * 1. IS the build controller for the Svelte frontend.
 * 2. ENFORCES deterministic output filenames to ensure the Extension Host can locate assets.
 * 3. OWNS the mapping of shared path aliases for the frontend build context.
 *
 * @contract
 *   assertions:
 *     purity: pure          # Returns a static configuration object.
 *     external_io: none     # Does not perform runtime I/O.
 *     state_ownership: none # Stateless configuration definition.
 */

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte({
    // Point to the shared config in the root (../svelte.config.mjs)
    configFile: '../svelte.config.mjs'
  })],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../packages/shared/src'),
    },
  },
  build: {
    // Output to the extension's 'out' directory
    outDir: '../out/webview-ui',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
      },
      output: {
        // Force deterministic names so extension.ts can find them
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});