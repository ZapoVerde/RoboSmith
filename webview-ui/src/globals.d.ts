/**
 * @file webview-ui/src/globals.d.ts
 * @stamp S-20251031-T154500Z-C-CREATED
 * @architectural-role Type Definition
 * @description Provides global TypeScript module declarations for the Svelte webview UI. This file allows TypeScript to understand non-standard file imports, such as `.svelte` components, and extends Vitest's `expect` with DOM-specific matchers.
 * @core-principles
 * 1. IS the single source of truth for ambient module declarations within the webview-ui package.
 * 2. MUST NOT contain any executable code or concrete implementations.
 * 3. ENFORCES type safety by teaching the compiler how to handle custom module types and test matchers.
 *
 * @api-declaration
 * - declare module '*.svelte'
 *
 * @contract
 * assertions:
 * - purity: "pure"
 * - external_io: "none"
 * - state_ownership: "none"
 */
// This import extends the global Vitest expect type with
// the matchers from jest-dom, solving the TypeScript error.
import '@testing-library/jest-dom/vitest';
declare module '*.svelte' {
  import type { SvelteComponent } from 'svelte';
  export default SvelteComponent;
}
