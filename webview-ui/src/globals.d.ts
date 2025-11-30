/**
 * @file webview-ui/src/globals.d.ts
 * @stamp S-20251130T082000Z-C-PREAMBLE-FIX
 * @architectural-role Type Definition
 * @description Provides global TypeScript module declarations for the Svelte
 * environment. It teaches the compiler how to handle `.svelte` imports,
 * extends the global `expect` type with DOM matchers, and defines the VS Code API.
 * @core-principles
 * 1. IS the single source of truth for ambient UI types.
 * 2. ENFORCES type safety for Svelte components in tests.
 * 3. MUST include the `@testing-library/jest-dom/vitest` import for IntelliSense.
 *
 * @api-declaration
 *   - declare function acquireVsCodeApi(): ...
 *   - declare module '*.svelte'
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 *     state_ownership: none
 */
import '@testing-library/jest-dom/vitest';

declare global {
  /**
   * Global function provided by the VS Code WebView environment.
   */
  function acquireVsCodeApi(): {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
  };
}

declare module '*.svelte' {
  import type { SvelteComponent } from 'svelte';
  export default SvelteComponent;
}