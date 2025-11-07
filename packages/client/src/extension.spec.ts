/**
 * @file packages/client/src/extension.spec.ts
 * @stamp S-20251107T094500Z-C-QUEUE-COMPOSITION-TEST
 * @test-target packages/client/src/extension.ts
 * @description Verifies the extension's activation logic, ensuring that new services like the WorktreeQueueManager are correctly instantiated and provided to downstream consumers.
 * @criticality The test target is CRITICAL as it is the application's entry point.
 * @testing-layer Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock,  } from 'vitest';
import * as vscode from 'vscode';
import { activate } from './extension';
import { SecureStorageService } from './lib/ai/SecureStorageService';
import { logger } from './lib/logging/logger';
import { ApiPoolManager } from './lib/ai/ApiPoolManager';
import { ContextPartitionerService } from './lib/context/ContextPartitionerService';
import { R_Mcp_ServerManager } from './lib/context/R_Mcp_ServerManager';
import { RealProcessSpawner } from './lib/context/RealProcessSpawner';
import { GitWorktreeManager } from './lib/git/GitWorktreeManager';
import { WorktreeQueueManager } from './lib/workflow/WorktreeQueueManager';
import { RealGitAdapter } from './lib/git/RealGitAdapter';
import { createEventHandler } from './events/handler';

// --- Hoisting-Safe Mocks for Dependencies ---

vi.mock('./lib/context/ContextPartitionerService');
vi.mock('./lib/context/R_Mcp_ServerManager');
vi.mock('./lib/context/RealProcessSpawner');
vi.mock('./lib/ai/SecureStorageService');
vi.mock('./lib/ai/ApiPoolManager', () => ({
  ApiPoolManager: { getInstance: vi.fn() },
}));
vi.mock('./lib/git/GitWorktreeManager');
vi.mock('./lib/git/RealGitAdapter');
vi.mock('./lib/workflow/WorktreeQueueManager');
vi.mock('./lib/logging/logger', () => ({
  logger: { initialize: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock the event handler factory to inspect the context it receives
const mockHandleEvent = vi.fn();
vi.mock('./events/handler', () => ({
  createEventHandler: vi.fn(() => mockHandleEvent),
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
  let mockApiManager: { initialize: Mock };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApiManager = { initialize: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(ApiPoolManager.getInstance).mockReturnValue(mockApiManager as unknown as ApiPoolManager);

    // This is the critical fix. We are no longer incorrectly overriding the
    // mock implementation. Instead, we will let Vitest's auto-mocking handle
    // the `new GitWorktreeManager()` call, and we will inspect the created
    // instance's methods in the test itself.
    // The faulty `mockImplementation` call has been removed.

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
    expect(RealGitAdapter).toHaveBeenCalledOnce();
    expect(SecureStorageService).toHaveBeenCalledOnce();
    expect(R_Mcp_ServerManager).toHaveBeenCalledOnce();
    expect(ContextPartitionerService).toHaveBeenCalledOnce();
    expect(GitWorktreeManager).toHaveBeenCalledOnce();
    expect(WorktreeQueueManager).toHaveBeenCalledOnce();
    
    expect(vi.mocked(R_Mcp_ServerManager).mock.calls[0][0]).toBeInstanceOf(RealProcessSpawner);
    expect(vi.mocked(GitWorktreeManager).mock.calls[0][0]).toBeInstanceOf(RealGitAdapter);
    expect(vi.mocked(WorktreeQueueManager).mock.calls[0][0]).toBeInstanceOf(GitWorktreeManager);

    expect(ApiPoolManager.getInstance).toHaveBeenCalledOnce();
    expect(mockApiManager.initialize).toHaveBeenCalledOnce();

    // This is the corrected assertion. We get the instance that was created
    // inside `activate()` from the mock's history and check its methods.
    const gitManagerInstance = vi.mocked(GitWorktreeManager).mock.instances[0];
    expect(gitManagerInstance.initialize).toHaveBeenCalledOnce();
  });

  it('should register the roboSmith.showPanel command', async () => {
    await activate(mockContext);
    expect(vi.mocked(vscode.commands.registerCommand)).toHaveBeenCalledWith('roboSmith.showPanel', expect.any(Function));
  });

  it('should create a webview panel and provide WorktreeQueueManager to the event handler context', async () => {
    await activate(mockContext);
    const commandCallback = vi.mocked(vscode.commands.registerCommand).mock.calls[0][1];
    commandCallback();
    
    expect(vi.mocked(vscode.window.createWebviewPanel)).toHaveBeenCalledOnce();
    
    // Simulate a message to trigger the handler and capture its context
    const onDidReceiveMessageCallback = (vscode as VscodeWithMocks).__mocks.onDidReceiveMessage.mock.calls[0][0];
    onDidReceiveMessageCallback({ command: 'test', payload: null }); // Fake message

    expect(createEventHandler).toHaveBeenCalledOnce();
    expect(mockHandleEvent).toHaveBeenCalledOnce();

    const contextArgument = mockHandleEvent.mock.calls[0][1];
    expect(contextArgument).toHaveProperty('worktreeQueueManager');
    expect(contextArgument.worktreeQueueManager).toBeInstanceOf(WorktreeQueueManager);
  });

  it('should log an error if the manifest file cannot be read', async () => {
    const readError = new Error('File not found');
    mockReadFile.mockRejectedValue(readError);
    await activate(mockContext);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to read or parse workflow manifest.', { error: readError }
    );
  });

  it('should log an error and stop if a service fails to initialize', async () => {
    // Arrange
    const initError = new Error('Initialization failed');
    
    // Use a proper constructor function instead of an arrow function
    vi.mocked(GitWorktreeManager).mockImplementationOnce(function(this: GitWorktreeManager) {
      return {
        initialize: vi.fn().mockRejectedValue(initError),
      } as unknown as GitWorktreeManager;
    });

    // Act
    await activate(mockContext);

    // Assert that the 'catch' block in 'activate' was executed correctly.
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to initialize a core service. Aborting activation.',
      { error: initError }
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('RoboSmith failed to start: Initialization failed');
    
    // Assert that activation was aborted before commands were registered.
    expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
  });

  it('should show an error and stop if no workspace folder is open', async () => {
    // Arrange
    // Override the global mock for this specific test
    vi.mocked(vscode.workspace, true).workspaceFolders = undefined;

    // Act
    await activate(mockContext);

    // Assert
    expect(logger.error).toHaveBeenCalledWith('No workspace folder is open. Cannot find workflow manifest.');
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('RoboSmith: No workspace folder open.');
    // Crucially, no commands should be registered
    expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
  });
});