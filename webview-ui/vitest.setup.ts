/**
 * @file webview-ui/vitest.setup.ts
 * @stamp S-20251031-T154000Z-C-WEBVIEW-SETUP
 * @architectural-role Configuration
 * @description
 * Setup file for the Vitest test runner. It is executed before any tests run
 * and extends Vitest's `expect` with global DOM-specific matchers.
 * @core-principles
 * 1. MUST be run before all test suites via the `setupFiles` configuration.
 * 2. OWNS the responsibility of importing and applying global test utilities.
 * 3. MUST NOT contain any test suites or application logic itself.
 *
 * @api-declaration
 *   (No exports; this file has side effects on the test environment)
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"
 *     - external_io: "none"
 *     - state_ownership: "none"
 */

import '@testing-library/jest-dom/vitest';
