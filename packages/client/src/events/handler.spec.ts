/**
 * @file packages/client/src/events/handler.spec.ts
 * @stamp S-20251107T121500Z-C-LINT-COMPLIANT
 * @test-target packages/client/src/events/handler.ts
 * @description Verifies that the event handler correctly routes the 'startWorkflow' command and passes the new `worktreePath` argument to the Orchestrator upon successful task submission.
 * @criticality The test target is CRITICAL as it is a core orchestrator.
 * @testing-layer Unit
 */

// --- HOISTING-SAFE MOCKS ---
const mockExecuteNode = vi.fn();

vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
  default: {},
}));
vi.mock('../features/settings/state/SettingsStore');
vi.mock('../lib/workflow/Orchestrator', () => ({
  Orchestrator: vi.fn(function() { // <-- DEFINITIVE FIX: Use 'function' keyword
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
import { createEventHandler, type EventHandlerContext } from './handler';
import { settingsStore } from '../features/settings/state/SettingsStore';
import { Orchestrator } from '../lib/workflow/Orchestrator';
import type { Message, WorkflowManifest, PlanningState } from '../shared/types';
import type { WebviewPanel } from 'vscode';
import type { ContextPartitionerService } from '../lib/context/ContextPartitionerService';
import type { ApiPoolManager } from '../lib/ai/ApiPoolManager';
import type { SecureStorageService } from '../lib/ai/SecureStorageService';
import type { ApiKey } from '@shared/domain/api-key';
import { WorktreeQueueManager } from '../lib/workflow/WorktreeQueueManager';
import { GitWorktreeManager } from '../lib/git/GitWorktreeManager';
import type { CreateWorktreeArgs, WorktreeSession } from '../lib/git/GitWorktreeManager';
import { logger } from '../lib/logging/logger';
// Import the dependency's type definition
import type { GitAdapter } from '../lib/git/IGitAdapter';


describe('handleEvent', () => {
  let mockContext: EventHandlerContext;
  let mockPostMessage: Mock;
  let handleEvent: (message: Message, context: EventHandlerContext) => Promise<void>;
  let mockWorktreeQueueManager: Mocked<WorktreeQueueManager>;
  let mockGitWorktreeManager: Mocked<GitWorktreeManager>;

  const mockLoadApiKeys = vi.fn();
  const mockAddApiKey = vi.fn();
  const mockRemoveApiKey = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteNode.mockClear();
    handleEvent = createEventHandler();
    mockPostMessage = vi.fn();

    // Create a minimal, type-safe stub object.
    const mockAdapterStub = {} as GitAdapter;
    // The module is already mocked, so `new` returns a mock instance. We pass the
    // stub to satisfy the constructor's type signature without using 'any'.
    mockGitWorktreeManager = new GitWorktreeManager(mockAdapterStub) as Mocked<GitWorktreeManager>;

    // Inject the type-safe mock dependency.
    mockWorktreeQueueManager = new WorktreeQueueManager(mockGitWorktreeManager) as Mocked<WorktreeQueueManager>;

    mockContext = {
      secureStorageService: {} as unknown as SecureStorageService,
      panel: { webview: { postMessage: mockPostMessage } } as unknown as WebviewPanel,
      manifest: {} as WorkflowManifest,
      contextService: {} as ContextPartitionerService,
      apiManager: {} as ApiPoolManager,
      worktreeQueueManager: mockWorktreeQueueManager,
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
    // Force cast to pass an invalid command that satisfies the Message shape at runtime
    const message = { command: 'unknownCommand', payload: {} } as unknown as Message;
    await handleEvent(message, mockContext);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[EventHandler] Received unhandled command:'),
      message
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
      // Arrange
      const mockSession: WorktreeSession = { sessionId: 's1', worktreePath: '/path/to/worktree', branchName: 'b1', changePlan: [], status: 'Running' };
      mockWorktreeQueueManager.submitTask.mockResolvedValue(mockSession);
      const mockArgs: CreateWorktreeArgs = { baseBranch: 'main', changePlan: ['file.ts'] };
      const message: Message = { command: 'startWorkflow', payload: { args: mockArgs, nodeId: 'test-node' } };
    
      // Act
      await handleEvent(message, mockContext);
      
      // Assert 1: Queue and Orchestrator execution
      expect(mockWorktreeQueueManager.submitTask).toHaveBeenCalledWith(mockArgs);
      expect(mockExecuteNode).toHaveBeenCalledWith('test-node', '/path/to/worktree');
      expect(Orchestrator).toHaveBeenCalledOnce();
    
      // Assert 2: Grab the Orchestrator instance created
      const orchestratorCallArgs = vi.mocked(Orchestrator).mock.calls[0];
      // Extract the onStateUpdate callback (it's the 4th argument)
      const onStateUpdateCallback = orchestratorCallArgs[3];
    
      // Act 2: Simulate the Orchestrator sending a type-safe state update
      const mockState: PlanningState = {
          currentNodeId: 'test-node',
          currentBlockId: 'test-node__BlockStart',
          executionPayload: [],
          isHalted: false,
          errorMessage: null,
      };
      onStateUpdateCallback(mockState);
    
      // Assert 3: Verify the panel received the message correctly
      expect(mockPostMessage).toHaveBeenCalledWith({
        command: 'planningStateUpdate',
        payload: mockState,
      });
    });

    it('should log an error if the queue manager fails', async () => {
      // Arrange
      const testError = new Error('Queue submission failed');
      mockWorktreeQueueManager.submitTask.mockRejectedValue(testError);
      const mockArgs: CreateWorktreeArgs = { baseBranch: 'main', changePlan: ['file.ts'] };
      const message: Message = { command: 'startWorkflow', payload: { args: mockArgs, nodeId: 'test-node' } };

      // Act
      await handleEvent(message, mockContext);

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Workflow task submission or execution failed.', { error: testError });
      expect(Orchestrator).not.toHaveBeenCalled();
    });
  });
});