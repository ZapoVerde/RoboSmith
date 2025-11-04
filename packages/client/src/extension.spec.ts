/**
 * @file packages/client/src/extension.spec.ts
 * @stamp S-20251104-T17:25:00Z-V-TYPE-SAFE
 * @test-target packages/client/src/extension.ts
 * @description Verifies the extension's activation logic, including service initialization, command registration, and critical failure paths in a type-safe manner.
 * @criticality The test target is CRITICAL as it is the application's entry point.
 * @testing-layer Integration
 *
 * @contract
 *   assertions:
 *     - Mocks all external dependencies (vscode, services, logger).
 *     - Verifies correct instantiation and initialization of all core services.
 *     - Verifies registration of the primary user-facing command.
 *     - Verifies the command's callback logic for creating a webview panel.
 *     - Verifies graceful error handling if the workflow manifest is missing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import { activate } from './extension';
import { SecureStorageService } from './lib/ai/SecureStorageService';
import { logger } from './lib/logging/logger';
import { ApiPoolManager } from './lib/ai/ApiPoolManager';
import { ContextPartitionerService } from './lib/context/ContextPartitionerService';

// --- Hoisting-Safe Mocks for Dependencies ---

vi.mock('./lib/context/ContextPartitionerService', () => ({
  ContextPartitionerService: {
    getInstance: vi.fn().mockReturnValue({}),
  },
}));

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

vi.mock('vscode', () => {
  const mockReadFile = vi.fn();
  const mockOnDidReceiveMessage = vi.fn();

  return {
    ExtensionMode: { Production: 1, Development: 2, Test: 3 },
    commands: { registerCommand: vi.fn() },
    window: {
      createWebviewPanel: vi.fn(() => ({
        webview: {
          onDidReceiveMessage: mockOnDidReceiveMessage,
          html: '',
        },
      })),
      createOutputChannel: vi.fn(),
      showErrorMessage: vi.fn(),
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
      fs: {
        readFile: mockReadFile,
      },
    },
    Uri: {
      joinPath: vi.fn((base, ...parts) => ({ ...base, path: `${base.fsPath}/${parts.join('/')}` })),
    },
    ViewColumn: { One: 1 },
    default: {},
    __mocks: {
        readFile: mockReadFile,
        onDidReceiveMessage: mockOnDidReceiveMessage,
    },
  };
});

// TYPE-SAFETY FIX: Define a type that accurately represents our mocked vscode module.
// This new type includes the custom `__mocks` property, eliminating the need for `as any`.
type VscodeWithMocks = typeof vscode & {
  __mocks: {
    readFile: Mock;
    onDidReceiveMessage: Mock;
  };
};

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
    
    // Default happy path for readFile, accessed in a type-safe way.
    (vscode as VscodeWithMocks).__mocks.readFile.mockResolvedValue(
        Buffer.from(JSON.stringify({ 'Node:Test': { entry_block: 'Block:Test', context_inheritance: true, static_memory: {}, blocks: {} }}))
    );
  });

  it('should initialize the logger and all services on activation', async () => {
    await activate(mockContext);

    expect(logger.initialize).toHaveBeenCalledWith(mockContext.extensionMode);

    const secureStorageInstance = vi.mocked(SecureStorageService).mock.instances[0];
    expect(SecureStorageService).toHaveBeenCalledWith(mockContext.secrets);
    expect(ApiPoolManager.getInstance).toHaveBeenCalledWith(secureStorageInstance);
    expect(mockApiManager.initialize).toHaveBeenCalledOnce();
    expect(ContextPartitionerService.getInstance).toHaveBeenCalledOnce();
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

  it('should create a webview panel and set up its listener when the showPanel command is executed', async () => {
    await activate(mockContext);

    const mockedRegisterCommand = vi.mocked(vscode.commands.registerCommand);
    const commandCallback = mockedRegisterCommand.mock.calls[0][1];
    
    commandCallback();

    const mockCreateWebviewPanel = vi.mocked(vscode.window.createWebviewPanel);
    expect(mockCreateWebviewPanel).toHaveBeenCalledOnce();
    expect(mockCreateWebviewPanel).toHaveBeenCalledWith(
      'roboSmithPanel',
      'RoboSmith',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    
    // TYPE-SAFETY FIX: Access the mock property through our new, specific type.
    const mockOnDidReceiveMessage = (vscode as VscodeWithMocks).__mocks.onDidReceiveMessage;
    expect(mockOnDidReceiveMessage).toHaveBeenCalledOnce();
  });

  it('should log an error if the manifest file cannot be read', async () => {
    const readError = new Error('File not found');
    // TYPE-SAFETY FIX: Access the mock property through our new, specific type.
    (vscode as VscodeWithMocks).__mocks.readFile.mockRejectedValue(readError);

    await activate(mockContext);

    expect(logger.error).toHaveBeenCalledWith(
        'Failed to read or parse workflow manifest.',
        { error: readError }
    );
  });
});