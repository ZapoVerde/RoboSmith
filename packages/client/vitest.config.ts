/**
 * @file packages/client/vitest.config.ts
 * @stamp S-20251031-T153500Z-C-CONFIG
 * @architectural-role Configuration
 * @description
 * The single source of truth for configuring the Vitest test runner for the `client`
 * package. It defines the test environment, sets up global utilities, and resolves
 * critical module dependency conflicts.
 * @core-principles
 * 1. ENFORCES a consistent test environment (`jsdom`) for all UI-related tests.
 * 2. OWNS the global test runner configuration, including setup files.
 * 3. MUST enforce a module resolution alias for 'zustand' to prevent React-related
 *    errors in the Node.js test context.
 * 4. ORCHESTRATES the extension of the test assertion library (`expect`) with
 *    DOM-specific matchers via the `setupFiles` property.
 *
 * @api-declaration
 *   - export default defineConfig(...)
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # This file configures and has side effects on the test process.
 *     - external_io: "none"     # The configuration itself performs no I/O.
 *     - state_ownership: "none" # It does not own any application state.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    /**
     * Enable globals (describe, it, expect, etc.) for convenience.
     */
    globals: true,
    /**
     * Set the environment to 'jsdom' to simulate a browser for UI component testing.
     * This is REQUIRED for Svelte Testing Library and jest-dom matchers.
     */
    environment: 'jsdom',
    /**
     * A list of setup files to run before each test file. This line
     * imports our jest-dom matchers (like .toBeInTheDocument).
     */
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    /**
     * This alias is the definitive solution to the Zustand/React issue.
     * It instructs the test runner (Vite) that whenever any file tries to
     * `import 'zustand'`, it should be given the 'zustand/vanilla' module
     * instead. This completely avoids the React dependency in our pure
     * Node.js test environment.
     */
    alias: {
      zustand: 'zustand/vanilla',
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
