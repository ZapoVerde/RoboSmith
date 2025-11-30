/**
 * @file packages/client/src/extension.spec.ts
 * @stamp 2025-11-30T23:45:00.000Z
 * @test-target packages/client/src/extension.ts
 * @description
 * Verifies the behavior of the extension's Composition Root.
 * Confirms service instantiation, initialization, and Command functionality
 * (specifically the new AI Inspector command).
 * @criticality CRITICAL
 * @testing-layer Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import * as path from 'path';
import { activate } from './extension';

// --- 1. Hoisted Mocks ---
const { 
  mockGwmInitialize, 
  mockSbnInitialize, 
  mockApmInitialize, 
  mockApmGetHistory 
} = vi.hoisted(() => {
  return {
    mockGwmInitialize: vi.fn(),
    mockSbnInitialize: vi.fn(),
    mockApmInitialize: vi.fn(),
    mockApmGetHistory: vi.fn().mockResolvedValue([]),
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
const mockPostMessage = vi.fn();
const mockWebviewReveal = vi.fn();

vi.mock('vscode', () => {
  const mockShowErrorMessage = vi.fn();
  const mockRegisterCommand = vi.fn();
  
  const mockCreateWebviewPanel = vi.fn(() => ({
    webview: { 
      html: '', 
      onDidReceiveMessage: vi.fn(), 
      asWebviewUri: vi.fn(),
      postMessage: mockPostMessage 
    },
    onDidDispose: vi.fn(),
    reveal: mockWebviewReveal,
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
    getInstance: vi.fn().mockReturnValue({ 
      initialize: mockApmInitialize,
      getHistory: mockApmGetHistory
    }),
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
    mockCreateWebviewPanel: Mock;
  };
};
const { 
  mockShowErrorMessage, 
  mockWorkspaceFolders, 
  mockRegisterCommand, 
  mockCreateWebviewPanel 
} = (vscode as MockedVSCode).__mocks;

// Define tuple type for command registration: [commandId, callback]
type RegisterCommandCall = [string, (...args: unknown[]) => unknown];

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

    // Verify Log Path Initialization
    const expectedLogPath = path.join('/mock/workspace', '.vision', 'logs');
    expect(mockApmInitialize).toHaveBeenCalledWith(expectedLogPath);

    // Verify Service Calls
    expect(mockGwmInitialize).toHaveBeenCalled();
    expect(mockSbnInitialize).toHaveBeenCalled();
  });

  describe('Command: showAiCallInspector', () => {
    it('should open webview, fetch logs, and post message', async () => {
      // Arrange
      await activate(mockContext);
      
      const mockLogs = [{ callId: '123', timestamp: 'now' }];
      mockApmGetHistory.mockResolvedValue(mockLogs);

      // Extract the registered command callback safely
      const calls = mockRegisterCommand.mock.calls as RegisterCommandCall[];
      const inspectorCommand = calls.find((call) => call[0] === 'roboSmith.showAiCallInspector');
      
      // Assertion Guard: Ensure command was registered
      expect(inspectorCommand).toBeDefined();
      if (!inspectorCommand) throw new Error('Command not found');
      
      const commandCallback = inspectorCommand[1];

      // Act
      await commandCallback();

      // Assert
      expect(mockCreateWebviewPanel).toHaveBeenCalled(); // Opens UI
      expect(mockApmGetHistory).toHaveBeenCalled();    // Fetches Data
      
      // We check that the mocked webview's postMessage was called
      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'showAiCallInspector',
        payload: { logs: mockLogs }
      });
    });

    it('should reveal existing panel if already open', async () => {
      await activate(mockContext);
      
      // Extract commands safely
      const calls = mockRegisterCommand.mock.calls as RegisterCommandCall[];
      
      const openCockpitEntry = calls.find((c) => c[0] === 'roboSmith.openCockpit');
      expect(openCockpitEntry).toBeDefined();
      if (!openCockpitEntry) throw new Error('openCockpit command not registered');
      const openCockpitCall = openCockpitEntry[1];

      const showInspectorEntry = calls.find((c) => c[0] === 'roboSmith.showAiCallInspector');
      expect(showInspectorEntry).toBeDefined();
      if (!showInspectorEntry) throw new Error('showAiCallInspector command not registered');
      const showInspectorCall = showInspectorEntry[1];

      // Act 1: Open Cockpit (creates panel)
      openCockpitCall();
      expect(mockCreateWebviewPanel).toHaveBeenCalledTimes(1);

      // Act 2: Show Inspector (should reuse panel)
      await showInspectorCall();
      expect(mockCreateWebviewPanel).toHaveBeenCalledTimes(1); // Count unchanged
      expect(mockWebviewReveal).toHaveBeenCalled(); // Reveal called
    });
  });

  it('should show an error if initialization fails', async () => {
    const initError = new Error('Database locked');
    mockGwmInitialize.mockRejectedValue(initError);

    await activate(mockContext);

    expect(mockShowErrorMessage).toHaveBeenCalledWith('RoboSmith failed to start: Database locked');
  });
});