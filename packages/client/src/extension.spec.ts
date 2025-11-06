/**
 * @file packages/client/src/extension.spec.ts
 * @stamp S-20251106T153000Z-V-FINAL-PASSING-FIX
 * @test-target packages/client/src/extension.ts
 * @description Verifies the extension's activation logic, including service
 * initialization using the new dependency injection pattern, command registration,
 * and critical failure paths in a type-safe manner.
 * @criticality The test target is CRITICAL as it is the application's entry point.
 * @testing-layer Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import { activate } from './extension';
import { SecureStorageService } from './lib/ai/SecureStorageService';
import { logger } from './lib/logging/logger';
import { ApiPoolManager } from './lib/ai/ApiPoolManager';
import { ContextPartitionerService } from './lib/context/ContextPartitionerService';
import { R_Mcp_ServerManager } from './lib/context/R_Mcp_ServerManager';
import { RealProcessSpawner } from './lib/context/RealProcessSpawner';

// --- Hoisting-Safe Mocks for Dependencies ---

vi.mock('./lib/context/ContextPartitionerService');
vi.mock('./lib/context/R_Mcp_ServerManager');
vi.mock('./lib/context/RealProcessSpawner');
vi.mock('./lib/ai/SecureStorageService');
vi.mock('./lib/ai/ApiPoolManager', () => ({
  ApiPoolManager: {
    getInstance: vi.fn(), // We still mock getInstance because the source file calls it
  },
}));
vi.mock('./lib/logging/logger', () => ({
  logger: { initialize: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('vscode', () => {
  const mockReadFile = vi.fn();
  const mockOnDidReceiveMessage = vi.fn();
  const mockCreateWebviewPanel = vi.fn(() => ({
    webview: { onDidReceiveMessage: mockOnDidReceiveMessage, html: '' },
  }));
  
  return {
    ExtensionMode: { Test: 3 },
    commands: { registerCommand: vi.fn() },
    window: { createWebviewPanel: mockCreateWebviewPanel, showErrorMessage: vi.fn() },
    workspace: { workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }] , fs: { readFile: mockReadFile }},
    Uri: { joinPath: vi.fn((base, ...parts) => ({ fsPath: `${base.fsPath}/${parts.join('/')}` }))},
    ViewColumn: { One: 1 },
    __mocks: { readFile: mockReadFile, onDidReceiveMessage: mockOnDidReceiveMessage },
  };
});

type VscodeWithMocks = typeof vscode & { __mocks: { readFile: Mock; onDidReceiveMessage: Mock } };
const mockReadFile = (vscode as VscodeWithMocks).__mocks.readFile;

describe('activate', () => {
  let mockContext: vscode.ExtensionContext;
  // THIS IS THE FIX: Declare the mock manager here, in the scope of the whole `describe` block.
  let mockApiManager: { initialize: Mock };

  beforeEach(() => {
    vi.clearAllMocks();

    // ASSIGN the mock here. Now it's a fresh mock for each test, but accessible to all.
    mockApiManager = { initialize: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(ApiPoolManager.getInstance).mockReturnValue(mockApiManager as unknown as ApiPoolManager);

    mockContext = {
      extensionMode: vscode.ExtensionMode.Test,
      secrets: {} as vscode.SecretStorage,
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    mockReadFile.mockResolvedValue(Buffer.from(JSON.stringify({})));
  });

  it('should initialize all services using constructors (the new DI pattern)', async () => {
    await activate(mockContext);

    expect(logger.initialize).toHaveBeenCalledWith(mockContext.extensionMode);

    expect(RealProcessSpawner).toHaveBeenCalledOnce();
    expect(SecureStorageService).toHaveBeenCalledOnce();
    expect(R_Mcp_ServerManager).toHaveBeenCalledOnce();
    expect(ContextPartitionerService).toHaveBeenCalledOnce();
    
    expect(vi.mocked(R_Mcp_ServerManager).mock.calls[0][0]).toBeInstanceOf(RealProcessSpawner);

    expect(ApiPoolManager.getInstance).toHaveBeenCalledOnce();
    // This assertion now correctly references the variable in the parent scope.
    expect(mockApiManager.initialize).toHaveBeenCalledOnce();
  });

  // The rest of the tests are now correct and will pass.
  it('should register the roboSmith.showPanel command', async () => {
    await activate(mockContext);
    expect(vi.mocked(vscode.commands.registerCommand)).toHaveBeenCalledWith('roboSmith.showPanel', expect.any(Function));
  });

  it('should create a webview panel when the command is executed', async () => {
    await activate(mockContext);
    const commandCallback = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1];
    commandCallback();
    expect(vi.mocked(vscode.window.createWebviewPanel)).toHaveBeenCalledOnce();
  });

  it('should log an error if the manifest file cannot be read', async () => {
    const readError = new Error('File not found');
    mockReadFile.mockRejectedValue(readError);
    await activate(mockContext);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to read or parse workflow manifest.', { error: readError }
    );
  });
});