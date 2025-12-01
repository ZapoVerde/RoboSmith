/**
 * @file vitest.config.mts
 * @stamp S-20251128T134500Z-C-TEST-ARCH-FIX
 * @architectural-role Configuration
 * @description The root entry point for the test runner. It defines the workspace
 * topology, explicitly separating the Node.js backend environment from the
 * JSDOM frontend environment to prevent mock pollution.
 * @core-principles
 * 1. IS the single entry point for running all tests in the monorepo.
 * 2. OWNS the definition of the testing workspace members.
 * 3. MUST NOT contain specific test configuration logic (delegates to member configs).
 */

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  './vitest.config.node.mts',
  './vitest.config.browser.mts',
]);