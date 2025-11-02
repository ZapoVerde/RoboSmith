/**
 * @file packages/client/src/extension.spec.ts
 * @stamp S-20251102-T083000Z-V-FINAL-FIX
 * @test-target packages/client/src/extension.ts
 * @description Verifies the extension's activation logic, ensuring services are initialized and commands are registered correctly.
 * @criticality The test target is CRITICAL as it is the application's entry point.
 * @testing-layer Integration
 *
 * @contract
 *   assertions:
 *     - Mocks all external dependencies (vscode, services, logger).
 *     - Verifies correct instantiation and initialization of services.
 *     - Verifies registration of the primary user-facing command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import { activate } from './extension';
import { SecureStorageService } from './lib/ai/SecureStorageService';
import { logger } from './lib/logging/logger';
import { ApiPoolManager } from './lib/ai/ApiPoolManager';

// --- Hoisting-Safe Mocks for Dependencies ---

vi.mock('./lib/ai/ApiPoolManager', () => ({
  ApiPoolManager: {
    getInstance: vi.fn().mockReturnValue({
      initialize: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('./lib/logging/logger', () => ({
  logger: {
    initialize: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('./lib/ai/SecureStorageService');

// DEFINITIVE FIX: The vscode mock is now comprehensive.
vi.mock('vscode', () => ({
  ExtensionMode: { Production: 1, Development: 2, Test: 3 },
  commands: { registerCommand: vi.fn() },
  window: {
    createWebviewPanel: vi.fn(() => ({
      webview: {
        onDidReceiveMessage: vi.fn(),
        html: '',
      },
    })),
    createOutputChannel: vi.fn(),
  },
  workspace: {
    // It now includes the properties needed by the activate function.
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
    fs: {
      readFile: vi.fn().mockResolvedValue(
        Buffer.from(JSON.stringify({
          'Node:Test': { // A minimal valid manifest
            entry_block: 'Block:Test',
            context_inheritance: true,
            static_memory: {},
            blocks: {},
          }
        }))
      ),
    },
  },
  Uri: {
    joinPath: vi.fn((base, ...parts) => ({ ...base, path: `${base.fsPath}/${parts.join('/')}` })),
  },
  ViewColumn: { One: 1 },
  default: {},
}));

describe('activate', () => {
  let mockContext: vscode.ExtensionContext;
  let mockApiManager: { initialize: Mock };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApiManager = { initialize: vi.fn() };
    vi.mocked(ApiPoolManager.getInstance).mockReturnValue(mockApiManager as unknown as ApiPoolManager);

    mockContext = {
      extensionMode: vscode.ExtensionMode.Test,
      secrets: {} as vscode.SecretStorage,
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;
  });

  it('should initialize the logger and services on activation', async () => {
    await activate(mockContext);

    expect(logger.initialize).toHaveBeenCalledWith(mockContext.extensionMode);

    const secureStorageInstance = vi.mocked(SecureStorageService).mock.instances[0];
    expect(SecureStorageService).toHaveBeenCalledWith(mockContext.secrets);
    expect(ApiPoolManager.getInstance).toHaveBeenCalledWith(secureStorageInstance);
    expect(mockApiManager.initialize).toHaveBeenCalledOnce();
  });

  it('should register the roboSmith.showPanel command', async () => {
    await activate(mockContext);

    const mockedRegisterCommand = vi.mocked(vscode.commands.registerCommand);
    expect(mockedRegisterCommand).toHaveBeenCalledOnce();
    expect(mockedRegisterCommand).toHaveBeenCalledWith(
      'roboSmith.showPanel',
      expect.any(Function)
    );
  });
});