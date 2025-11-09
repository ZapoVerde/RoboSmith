/**
 * @file packages/client/src/events/handler.spec.ts
 * @stamp S-20251107T161000Z-C-HOISTING-FIX
 * @test-target packages/client/src/events/handler.ts
 * @description Verifies that the event handler correctly routes all commands,
 * including the new `acceptAndMerge`, `rejectAndDiscard`, etc., to the
 * correct backend service methods.
 * @criticality The test target is CRITICAL as it is a core orchestrator.
 * @testing-layer Unit
 */

// --- HOISTING-SAFE MOCKS ---
vi.mock('vscode', () => {
  // All mock functions MUST be created INSIDE the factory to avoid hoisting errors.
  const mockCreateTerminal = vi.fn();
  const mockUpdateWorkspaceFolders = vi.fn();

  return {
    window: { 
      createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
      createTerminal: mockCreateTerminal,
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
      updateWorkspaceFolders: mockUpdateWorkspaceFolders,
    },
    default: {},
    // Expose the internal mocks for test access in a hoisting-safe way.
    __mocks: {
      mockCreateTerminal,
      mockUpdateWorkspaceFolders,
    },
  };
});

const mockExecuteNode = vi.fn();

vi.mock('../features/settings/state/SettingsStore');
vi.mock('../lib/workflow/Orchestrator', () => ({
  Orchestrator: vi.fn(function() {
    return {
      executeNode: mockExecuteNode,
    };
  }),
}));
vi.mock('../lib/workflow/WorktreeQueueManager');
vi.mock('../lib/git/GitWorktreeManager');
vi.mock('../lib/logging/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock, Mocked } from 'vitest';
import * as vscode from 'vscode';
import { createEventHandler, type EventHandlerContext } from './handler';
import { settingsStore } from '../features/settings/state/SettingsStore';
import { Orchestrator } from '../lib/workflow/Orchestrator';
import type { Message, WorkflowManifest, WorkflowViewState } from '../shared/types';
import type { WebviewPanel } from 'vscode';
import type { ContextPartitionerService } from '../lib/context/ContextPartitionerService';
import type { ApiPoolManager } from '../lib/ai/ApiPoolManager';
import type { SecureStorageService } from '../lib/ai/SecureStorageService';
import type { ApiKey } from '@shared/domain/api-key';
import { WorktreeQueueManager } from '../lib/workflow/WorktreeQueueManager';
import { GitWorktreeManager } from '../lib/git/GitWorktreeManager';
import type { CreateWorktreeArgs, WorktreeSession } from '../lib/git/GitWorktreeManager';
import { logger } from '../lib/logging/logger';
import type { GitAdapter } from '../lib/git/IGitAdapter';


describe('handleEvent', () => {
  let mockContext: EventHandlerContext;
  let mockPostMessage: Mock;
  let handleEvent: (message: Message, context: EventHandlerContext) => Promise<void>;
  let mockWorktreeQueueManager: Mocked<WorktreeQueueManager>;
  let mockGitWorktreeManager: Mocked<GitWorktreeManager>;
  
  // These will be populated from the hoisted mock in beforeEach
  let mockCreateTerminal: Mock;
  let mockUpdateWorkspaceFolders: Mock;

  const mockLoadApiKeys = vi.fn();
  const mockAddApiKey = vi.fn();
  const mockRemoveApiKey = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a specific type for our mocked vscode module to avoid using 'any'.
    type VscodeWithMocks = typeof vscode & {
      __mocks: {
        mockCreateTerminal: Mock;
        mockUpdateWorkspaceFolders: Mock;
      };
    };

    // Retrieve the hoisted mocks in a type-safe way.
    mockCreateTerminal = (vscode as VscodeWithMocks).__mocks.mockCreateTerminal;
    mockUpdateWorkspaceFolders = (vscode as VscodeWithMocks).__mocks.mockUpdateWorkspaceFolders;
    
    handleEvent = createEventHandler();
    mockPostMessage = vi.fn();

    const mockAdapterStub = {} as GitAdapter;
    mockGitWorktreeManager = new GitWorktreeManager(mockAdapterStub) as Mocked<GitWorktreeManager>;
    mockWorktreeQueueManager = new WorktreeQueueManager(mockGitWorktreeManager) as Mocked<WorktreeQueueManager>;

    mockContext = {
      secureStorageService: {} as unknown as SecureStorageService,
      panel: { webview: { postMessage: mockPostMessage } } as unknown as WebviewPanel,
      manifest: {} as WorkflowManifest,
      contextService: {} as ContextPartitionerService,
      apiManager: {} as ApiPoolManager,
      worktreeQueueManager: mockWorktreeQueueManager,
      gitWorktreeManager: mockGitWorktreeManager,
    };

    vi.mocked(settingsStore.getState).mockReturnValue({
      loadApiKeys: mockLoadApiKeys,
      addApiKey: mockAddApiKey,
      removeApiKey: mockRemoveApiKey,
    } as unknown as ReturnType<typeof settingsStore.getState>);
  });

  it('should log info for currently unimplemented "userAction" command', async () => {
    const message: Message = { command: 'userAction', payload: { action: 'proceed', sessionId: 's1' } };
    await handleEvent(message, mockContext);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('User action received but not yet implemented'),
      expect.anything()
    );
  });
  
  it('should log a warning for unknown commands (safety fallback)', async () => {
    const message = { command: 'unknownCommand', payload: {} } as unknown as Message;
    await handleEvent(message, mockContext);
    expect(logger.warn).toHaveBeenCalledWith(
      '[EventHandler] Received unhandled command:',
      message.command
    );
  });

  describe('API Key Management Commands', () => {
    it("should route the 'loadApiKeys' command to the settings store", async () => {
      const message: Message = { command: 'loadApiKeys', payload: undefined };
      await handleEvent(message, mockContext);
      expect(mockLoadApiKeys).toHaveBeenCalledOnce();
    });

    it("should route the 'addApiKey' command to the settings store", async () => {
      const newApiKey: ApiKey = { id: 'key-1', provider: 'openai', secret: 'sk-1' };
      const message: Message = { command: 'addApiKey', payload: newApiKey };
      await handleEvent(message, mockContext);
      expect(mockAddApiKey).toHaveBeenCalledWith(newApiKey, mockContext.secureStorageService);
    });

    it("should route the 'removeApiKey' command to the settings store", async () => {
      const message: Message = { command: 'removeApiKey', payload: { id: 'key-to-delete' } };
      await handleEvent(message, mockContext);
      expect(mockRemoveApiKey).toHaveBeenCalledWith('key-to-delete', mockContext.secureStorageService);
    });
  });

  describe('Workflow Control Commands', () => {
    it('should delegate to the queue manager, start the orchestrator, and wire up the UI feedback loop', async () => {
        const mockSession: WorktreeSession = { sessionId: 's1', worktreePath: '/path/to/worktree', branchName: 'b1', changePlan: [], status: 'Running' };
        mockWorktreeQueueManager.submitTask.mockResolvedValue(mockSession);
        const mockArgs: CreateWorktreeArgs = { baseBranch: 'main', changePlan: ['file.ts'] };
        const message: Message = { command: 'startWorkflow', payload: { args: mockArgs, nodeId: 'test-node' } };
      
        await handleEvent(message, mockContext);
        
        expect(mockWorktreeQueueManager.submitTask).toHaveBeenCalledWith(mockArgs);
        expect(Orchestrator).toHaveBeenCalledOnce();
        
        const orchestratorCallArgs = vi.mocked(Orchestrator).mock.calls[0];
        const onStateUpdateCallback = orchestratorCallArgs[3] as (state: WorkflowViewState) => void;
        const onCompletionCallback = orchestratorCallArgs[4] as () => void;
        expect(mockExecuteNode).toHaveBeenCalledWith('test-node', '/path/to/worktree');
      
        const mockState: WorkflowViewState = {
            graph: { nodeId: 'test-node', blocks: {}, transitions: [] },
            statuses: { 'test-node__BlockStart': 'active' },
            lastTransition: null,
            executionLog: {},
            allWorkflowsStatus: [],
        };
        onStateUpdateCallback(mockState);
      
        expect(mockPostMessage).toHaveBeenCalledWith({
          command: 'workflowStateUpdate',
          payload: mockState,
        });

        expect(onCompletionCallback).toBeInstanceOf(Function);
    });

    it('should log an error if the queue manager fails', async () => {
      const testError = new Error('Queue submission failed');
      mockWorktreeQueueManager.submitTask.mockRejectedValue(testError);
      const mockArgs: CreateWorktreeArgs = { baseBranch: 'main', changePlan: ['file.ts'] };
      const message: Message = { command: 'startWorkflow', payload: { args: mockArgs, nodeId: 'test-node' } };

      await handleEvent(message, mockContext);

      expect(logger.error).toHaveBeenCalledWith('Workflow task submission or execution failed.', { error: testError });
      expect(Orchestrator).not.toHaveBeenCalled();
    });
  });

  describe('Integration Panel Commands', () => {
    it('should delegate to GitWorktreeManager and WorktreeQueueManager on acceptAndMerge', async () => {
      const message: Message = { command: 'acceptAndMerge', payload: { sessionId: 's1' } };
      await handleEvent(message, mockContext);

      expect(mockGitWorktreeManager.removeWorktree).toHaveBeenCalledWith('s1');
      expect(mockWorktreeQueueManager.markTaskComplete).toHaveBeenCalledWith('s1');
      expect(mockUpdateWorkspaceFolders).toHaveBeenCalled();
    });

    it('should delegate to GitWorktreeManager and WorktreeQueueManager on rejectAndDiscard', async () => {
      const message: Message = { command: 'rejectAndDiscard', payload: { sessionId: 's1' } };
      await handleEvent(message, mockContext);

      expect(mockGitWorktreeManager.removeWorktree).toHaveBeenCalledWith('s1');
      expect(mockWorktreeQueueManager.markTaskComplete).toHaveBeenCalledWith('s1');
      expect(mockUpdateWorkspaceFolders).toHaveBeenCalled();
    });

    it('should NOT remove worktree but should switch workspace on finishAndHold', async () => {
      const message: Message = { command: 'finishAndHold', payload: { sessionId: 's1' } };
      await handleEvent(message, mockContext);

      expect(logger.warn).toHaveBeenCalledWith('Session status update to "Held" is not yet implemented in GitWorktreeManager.');
      expect(mockGitWorktreeManager.removeWorktree).not.toHaveBeenCalled();
      expect(mockWorktreeQueueManager.markTaskComplete).not.toHaveBeenCalled();
      expect(mockUpdateWorkspaceFolders).toHaveBeenCalled();
    });

    it('should create a terminal with the correct CWD on openTerminalInWorktree', async () => {
      const mockSession: WorktreeSession = { sessionId: 's1', worktreePath: '/path/to/s1', branchName: 'feat/s1', changePlan: [], status: 'Running' };
      mockGitWorktreeManager.getAllSessions.mockReturnValue([mockSession]);
      const message: Message = { command: 'openTerminalInWorktree', payload: { sessionId: 's1' } };
      
      await handleEvent(message, mockContext);

      expect(mockCreateTerminal).toHaveBeenCalledWith({
        name: expect.stringContaining(mockSession.branchName),
        cwd: mockSession.worktreePath,
      });
    });
  });
});