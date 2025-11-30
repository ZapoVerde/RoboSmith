/**
 * @file webview-ui/vitest.setup.ts
 * @stamp S-20251130T082000Z-C-PREAMBLE-FIX
 * @architectural-role Configuration
 * @description
 * Global setup for the WebView UI test environment. It extends Vitest with
 * DOM-specific matchers (like toBeInTheDocument) and ensures the DOM is
 * cleaned up after every test to prevent state leaks.
 * @core-principles
 * 1. MUST run before every UI test file.
 * 2. OWNS the registration of `jest-dom` matchers.
 * 3. ENFORCES automatic DOM cleanup via the `afterEach` hook.
 *
 * @contract
 *   assertions:
 *     purity: mutates          # Modifies the global test environment.
 *     external_io: none
 *     state_ownership: none
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';

// Automatically clean up the DOM after each test
afterEach(() => {
  cleanup();
});