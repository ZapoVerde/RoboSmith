/**
 * @file webview-ui/src/main.ts
 * @stamp 2025-11-30T18:45:00.000Z
 * @architectural-role Feature Entry Point
 * @description The bootstrapping entry point for the Svelte frontend application.
 * @core-principles
 * 1. IS the composition root for the WebView UI.
 * 2. OWNS the mounting of the root `App` component to the DOM.
 * 3. DELEGATES all subsequent UI logic to the Svelte component tree.
 *
 * @contract
 *   assertions:
 *     purity: mutates          # Mutates the global DOM.
 *     external_io: none
 *     state_ownership: none
 */

import { mount } from 'svelte';
import App from './App.svelte';

const targetElement = document.getElementById('app');

if (!targetElement) {
  throw new Error('Root element #app not found');
}

const app = mount(App, {
  target: targetElement,
});

export default app;