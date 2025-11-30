/**
 * @file vitest.config.node.mts
 * @stamp S-20251128T134500Z-C-TEST-ARCH-FIX
 * @architectural-role Configuration
 * @description Configures the test environment for the Extension Host (Backend).
 * It enforces a pure Node.js environment and handles the path aliases for
 * the 'client' package.
 * @core-principles
 * 1. ENFORCES the 'node' environment for all backend tests.
 * 2. OWNS the mapping of '@shared' aliases for backend consumption.
 * 3. EXCLUDES any UI-related tests to prevent JSDOM conflicts.
 */

import { defineProject } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

// Derive __dirname for ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineProject({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
  test: {
    name: 'node',
    environment: 'node',
    globals: true,
    include: ['packages/client/src/**/*.spec.ts'],
    setupFiles: ['packages/client/vitest.setup.ts'],
    // Inline uuid to force Vite to transform it instead of using native Node.js import
    server: {
      deps: {
        inline: ['uuid'],
      },
    },
  },
});