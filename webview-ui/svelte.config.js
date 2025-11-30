/**
 * @file webview-ui/svelte.config.js
 * @stamp 2025-11-30T18:41:00.000Z
 * @architectural-role Configuration
 * @description Local Svelte configuration for the webview-ui package.
 * @core-principles
 * 1. IS the definitive configuration for Svelte compilation in this package.
 * 2. ENFORCES usage of `vitePreprocess` to enable TypeScript support in `.svelte` files.
 */

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};