/**
 * @file packages/client/src/extension.spec.ts
 * @stamp 2025-11-30T19:40:00.000Z
 * @test-target packages/client/src/extension.ts
 * @description
 * Verifies the behavior of the extension's Composition Root (`activate` function).
 * Confirms that services are instantiated and that the ApiPoolManager receives
 * the correct logging configuration.
 * @criticality CRITICAL
 * @testing-layer Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import * as path from 'path'; // Imported for path verification
import { activate } from './extension';
import { logger } from './lib/logging/logger';
import { GitWorktreeManager } from './lib/git/GitWorktreeManager';
import { StatusBarNavigatorService } from './features/navigator/StatusBarNavigatorService';
import { ApiPoolManager } from './lib/ai/ApiPoolManager';

// --- 1. Hoisted Mocks (Available to factory functions) ---
const { mockGwmInitialize, mockSbnInitialize, mockApmInitialize } = vi.hoisted(() => {
  return {
    mockGwmInitialize: vi.fn(),
    mockSbnInitialize: vi.fn(),
    mockApmInitialize: vi.fn(),
  };
});

// Robust UUID mock
vi.mock('uuid', () => ({
  v1: vi.fn(),
  v3: vi.fn(),
  v4: vi.fn(() => 'mock-uuid-extension'),
  v5: vi.fn(),
}));

// --- 2. VS Code API Mock ---
vi.mock('vscode', () => {
  const mockShowErrorMessage = vi.fn();
  const mockRegisterCommand = vi.fn();
  const mockCreateWebviewPanel = vi.fn(() => ({
    webview: { html: '', onDidReceiveMessage: vi.fn(), asWebviewUri: vi.fn() },
    onDidDispose: vi.fn(),
    reveal: vi.fn(),
  }));
  
  const mockWorkspaceFolders: { uri: { fsPath: string }; name: string; index: number }[] = [];

  return {
    window: {
      showErrorMessage: mockShowErrorMessage,
      createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
      createWebviewPanel: mockCreateWebviewPanel,
    },
    workspace: {
      get workspaceFolders() { return mockWorkspaceFolders; }
    },
    commands: { registerCommand: mockRegisterCommand },
    ViewColumn: { Two: 2 },
    Uri: { file: vi.fn((f) => ({ fsPath: f })) },
    ExtensionMode: { Development: 1, Production: 2, Test: 3 },
    __mocks: { mockShowErrorMessage, mockWorkspaceFolders, mockRegisterCommand, mockCreateWebviewPanel },
    default: {},
  };
});

// --- 3. Service Mocks ---

vi.mock('./lib/git/GitWorktreeManager', () => ({
  GitWorktreeManager: vi.fn(function() {
    return {
      initialize: mockGwmInitialize,
      getAllSessions: vi.fn(() => [])
    };
  }),
}));

vi.mock('./features/navigator/StatusBarNavigatorService', () => ({
  StatusBarNavigatorService: vi.fn(function() {
    return {
      initialize: mockSbnInitialize
    };
  }),
}));

vi.mock('./lib/ai/ApiPoolManager', () => ({
  ApiPoolManager: {
    getInstance: vi.fn().mockReturnValue({ initialize: mockApmInitialize }),
  },
}));

vi.mock('./lib/workflow/WorkflowService', () => ({
  WorkflowService: {
    getInstance: vi.fn().mockReturnValue({ loadWorkflow: vi.fn() }),
  },
}));

vi.mock('./lib/context/ContextPartitionerService', () => ({
  ContextPartitionerService: {
    getInstance: vi.fn().mockReturnValue({}),
  },
}));

vi.mock('./lib/logging/logger', () => ({
  logger: { initialize: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('./lib/git/RealGitAdapter', () => ({ 
  RealGitAdapter: vi.fn(function() { return {}; }) 
}));
vi.mock('./lib/context/RealProcessSpawner', () => ({ 
  RealProcessSpawner: vi.fn(function() { return {}; }) 
}));
vi.mock('./lib/ai/SecureStorageService', () => ({ 
  SecureStorageService: vi.fn(function() { return {}; }) 
}));
vi.mock('./lib/context/R_Mcp_ServerManager', () => ({ 
  R_Mcp_ServerManager: vi.fn(function() { return {}; }) 
}));
vi.mock('./lib/workflow/WorktreeQueueManager', () => ({ 
  WorktreeQueueManager: vi.fn(function() { return {}; }) 
}));
vi.mock('./events/handler', () => ({ 
  createEventHandler: vi.fn(() => vi.fn()) 
}));

// --- 4. Test Suite ---

type MockedVSCode = typeof vscode & {
  __mocks: { 
    mockShowErrorMessage: Mock; 
    mockWorkspaceFolders: { uri: { fsPath: string }; name: string; index: number }[]; 
    mockRegisterCommand: Mock;
  };
};
const { mockShowErrorMessage, mockWorkspaceFolders, mockRegisterCommand } = (vscode as MockedVSCode).__mocks;

describe('Extension Activation', () => {
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset workspace state
    mockWorkspaceFolders.length = 0;
    mockWorkspaceFolders.push({ uri: { fsPath: '/mock/workspace' }, name: 'mock-project', index: 0 });
    
    // Mock extension context
    mockContext = {
      subscriptions: [],
      extensionMode: vscode.ExtensionMode.Test,
      extensionPath: '/mock/extension/path',
      secrets: {} as vscode.SecretStorage,
      globalState: {
        get: vi.fn(),
        update: vi.fn(),
      } as unknown as vscode.Memento,
    } as unknown as vscode.ExtensionContext;
  });

  it('should instantiate and initialize all core services with correct configuration', async () => {
    mockGwmInitialize.mockResolvedValue(undefined);
    mockApmInitialize.mockResolvedValue(undefined);

    await activate(mockContext);

    // 1. Verify Logger Init
    expect(logger.initialize).toHaveBeenCalledWith(vscode.ExtensionMode.Test);

    // 2. Verify Service Instantiation & Initialization
    expect(GitWorktreeManager).toHaveBeenCalled();
    expect(mockGwmInitialize).toHaveBeenCalled();
    
    expect(StatusBarNavigatorService).toHaveBeenCalled();
    expect(mockSbnInitialize).toHaveBeenCalled();

    expect(ApiPoolManager.getInstance).toHaveBeenCalled();
    
    // STRICT ASSERTION: Verify the log path is passed correctly
    const expectedLogPath = path.join('/mock/workspace', '.vision', 'logs');
    expect(mockApmInitialize).toHaveBeenCalledWith(expectedLogPath);

    // 3. Verify Command Registration
    expect(mockRegisterCommand).toHaveBeenCalledWith('roboSmith.openCockpit', expect.any(Function));

    // 4. Verify No Errors
    expect(mockShowErrorMessage).not.toHaveBeenCalled();
  });

  it('should show an error and halt if no workspace folder is open', async () => {
    mockWorkspaceFolders.length = 0; // Empty workspace

    await activate(mockContext);

    expect(mockShowErrorMessage).toHaveBeenCalledWith(
      'RoboSmith failed to start: No workspace folder open. RoboSmith requires a project to be open.'
    );
    expect(mockGwmInitialize).not.toHaveBeenCalled();
  });

  it('should show an error if a critical service fails to initialize', async () => {
    const initError = new Error('Database locked');
    mockGwmInitialize.mockRejectedValue(initError);

    await activate(mockContext);

    expect(logger.error).toHaveBeenCalledWith('Failed to activate RoboSmith extension: Database locked');
    expect(mockShowErrorMessage).toHaveBeenCalledWith('RoboSmith failed to start: Database locked');
    
    expect(mockSbnInitialize).not.toHaveBeenCalled();
  });
});