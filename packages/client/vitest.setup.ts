/**
 * @file vitest.setup.ts
 * @description Setup file for the Vitest test runner.
 * This file is executed before each test file. It mocks the
 * 'vscode' API, which is not available in the Node.js test environment.
 */

import { vi } from 'vitest';

// Mock the VS Code API
vi.mock('vscode', () => {
  return {
    window: {
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn(),
        clear: vi.fn(),
        name: 'mockOutputChannel',
      })),
    },
    ExtensionMode: {
      Production: 1,
      Development: 2,
      Test: 3,
    },
  };
});