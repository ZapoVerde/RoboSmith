/**
 * @file packages/client/src/events/handler.spec.ts
 * @stamp 2025-11-30T22:30:00.000Z
 * @test-target packages/client/src/events/handler.ts
 * @description
 * Verifies that the event handler correctly parses incoming messages and routes
 * them to the appropriate backend services.
 * @criticality CRITICAL
 * @testing-layer Unit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock, Mocked } from 'vitest';

// --- 1. Hoisted Mocks ---
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mocked-uuid-v4'),
}));

const { mockCreateTerminal, mockUpdateWorkspaceFolders } = vi.hoisted(() => ({
  mockCreateTerminal: vi.fn(),
  mockUpdateWorkspaceFolders: vi.fn(),
}));

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
    createTerminal: mockCreateTerminal,
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
    updateWorkspaceFolders: mockUpdateWorkspaceFolders,
  },
}));

const mockExecuteNode = vi.fn();
const mockResumeManually = vi.fn();
const mockRetryBlock = vi.fn();

vi.mock('../lib/workflow/Orchestrator', () => ({
  Orchestrator: vi.fn(function() {
    return {
      executeNode: mockExecuteNode,
      resumeManually: mockResumeManually,
      retryBlock: mockRetryBlock,
    };
  }),
}));

vi.mock('../features/settings/state/SettingsStore');
vi.mock('../lib/workflow/WorktreeQueueManager');
vi.mock('../lib/git/GitWorktreeManager');
vi.mock('../lib/logging/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createEventHandler, type EventHandlerContext } from './handler';
import { settingsStore } from '../features/settings/state/SettingsStore';
import { Orchestrator } from '../lib/workflow/Orchestrator';
import type { Message, WorkflowManifest, AiCallLog } from '../shared/types';
import type { WebviewPanel } from 'vscode';
import type { ContextPartitionerService } from '../lib/context/ContextPartitionerService';
import type { ApiPoolManager, WorkerResult } from '../lib/ai/ApiPoolManager';
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
  
  // Mock API Manager specifically for this test suite
  const mockApiManager = {
    execute: vi.fn(),
  } as unknown as Mocked<ApiPoolManager>;

  const mockLoadApiKeys = vi.fn();
  const mockAddApiKey = vi.fn();
  const mockRemoveApiKey = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
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
      apiManager: mockApiManager,
      worktreeQueueManager: mockWorktreeQueueManager,
      gitWorktreeManager: mockGitWorktreeManager,
    };

    vi.mocked(settingsStore.getState).mockReturnValue({
      loadApiKeys: mockLoadApiKeys,
      addApiKey: mockAddApiKey,
      removeApiKey: mockRemoveApiKey,
    } as unknown as ReturnType<typeof settingsStore.getState>);
  });

  // --- Group 1: General & API Keys ---

  it('should log a warning for unknown commands', async () => {
    const message = { command: 'unknownCommand', payload: {} } as unknown as Message;
    
    await handleEvent(message, mockContext);
    
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Received unhandled command'),
      { command: 'unknownCommand' }
    );
  });

  describe('API Key Management', () => {
    it("should route 'loadApiKeys' to settings store", async () => {
      await handleEvent({ command: 'loadApiKeys', payload: undefined }, mockContext);
      expect(mockLoadApiKeys).toHaveBeenCalledOnce();
    });

    it("should route 'addApiKey' to settings store", async () => {
      const newApiKey: ApiKey = { id: 'key-1', provider: 'openai', secret: 'sk-1' };
      await handleEvent({ command: 'addApiKey', payload: newApiKey }, mockContext);
      expect(mockAddApiKey).toHaveBeenCalledWith(newApiKey, mockContext.secureStorageService);
    });

    it("should route 'removeApiKey' to settings store", async () => {
      await handleEvent({ command: 'removeApiKey', payload: { id: 'key-to-delete' } }, mockContext);
      expect(mockRemoveApiKey).toHaveBeenCalledWith('key-to-delete', mockContext.secureStorageService);
    });
  });

  describe('Workflow Lifecycle & Interactivity', () => {
    it('should submit task, register orchestrator, and start execution on startWorkflow', async () => {
        const mockSession: WorktreeSession = { sessionId: 's1', worktreePath: '/path', branchName: 'b1', changePlan: [], status: 'Running' };
        mockWorktreeQueueManager.submitTask.mockResolvedValue(mockSession);
        const mockArgs: CreateWorktreeArgs = { baseBranch: 'main', changePlan: ['file.ts'] };
        
        await handleEvent(
            { command: 'startWorkflow', payload: { args: mockArgs, nodeId: 'test-node' } }, 
            mockContext
        );
        
        expect(mockWorktreeQueueManager.submitTask).toHaveBeenCalledWith(mockArgs);
        expect(Orchestrator).toHaveBeenCalled();
        expect(mockExecuteNode).toHaveBeenCalledWith('test-node', '/path');
    });

    it('should route resumeWorkflow to the correct registered orchestrator', async () => {
        const sessionId = 's-resume';
        mockWorktreeQueueManager.submitTask.mockResolvedValue({ 
            sessionId, worktreePath: '/path', branchName: 'b' 
        } as WorktreeSession);

        await handleEvent(
            { command: 'startWorkflow', payload: { args: { baseBranch: 'm', changePlan: [] }, nodeId: 'N' } }, 
            mockContext
        );

        await handleEvent(
            { command: 'resumeWorkflow', payload: { sessionId, augmentedPrompt: 'Go' } },
            mockContext
        );

        expect(mockResumeManually).toHaveBeenCalledWith('Go');
    });

    it('should route retryBlock to the correct registered orchestrator', async () => {
        const sessionId = 's-retry';
        mockWorktreeQueueManager.submitTask.mockResolvedValue({ 
            sessionId, worktreePath: '/path', branchName: 'b' 
        } as WorktreeSession);

        await handleEvent(
            { command: 'startWorkflow', payload: { args: { baseBranch: 'm', changePlan: [] }, nodeId: 'N' } }, 
            mockContext
        );

        await handleEvent(
            { command: 'retryBlock', payload: { sessionId, augmentedPrompt: 'Fix it' } },
            mockContext
        );

        expect(mockRetryBlock).toHaveBeenCalledWith('Fix it');
    });

    it('should log error when resuming a non-existent session', async () => {
        await handleEvent(
            { command: 'resumeWorkflow', payload: { sessionId: 'ghost', augmentedPrompt: '' } },
            mockContext
        );
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Cannot resume: No active orchestrator'));
    });
  });

  describe('Integration Panel Commands', () => {
    it('should delegate to managers on acceptAndMerge', async () => {
      const message: Message = { command: 'acceptAndMerge', payload: { sessionId: 's1' } };
      await handleEvent(message, mockContext);

      expect(mockGitWorktreeManager.removeWorktree).toHaveBeenCalledWith('s1');
      expect(mockWorktreeQueueManager.markTaskComplete).toHaveBeenCalledWith('s1');
      expect(mockUpdateWorkspaceFolders).toHaveBeenCalled();
    });

    it('should delegate to managers on rejectAndDiscard', async () => {
      const message: Message = { command: 'rejectAndDiscard', payload: { sessionId: 's1' } };
      await handleEvent(message, mockContext);

      expect(mockGitWorktreeManager.removeWorktree).toHaveBeenCalledWith('s1');
      expect(mockWorktreeQueueManager.markTaskComplete).toHaveBeenCalledWith('s1');
      expect(mockUpdateWorkspaceFolders).toHaveBeenCalled();
    });

    it('should handle finishAndHold (cleanup registry but keep files)', async () => {
      const message: Message = { command: 'finishAndHold', payload: { sessionId: 's1' } };
      await handleEvent(message, mockContext);

      expect(mockGitWorktreeManager.removeWorktree).not.toHaveBeenCalled();
      expect(mockUpdateWorkspaceFolders).toHaveBeenCalled();
    });

    it('should open a terminal on openTerminalInWorktree', async () => {
      const mockSession: WorktreeSession = { 
          sessionId: 's1', worktreePath: '/path/to/s1', branchName: 'feat/s1', changePlan: [], status: 'Running' 
      };
      mockGitWorktreeManager.getAllSessions.mockReturnValue([mockSession]);
      
      await handleEvent({ command: 'openTerminalInWorktree', payload: { sessionId: 's1' } }, mockContext);

      expect(mockCreateTerminal).toHaveBeenCalledWith({
        name: expect.stringContaining(mockSession.branchName),
        cwd: mockSession.worktreePath,
      });
    });
  });

  describe('AI Call Inspector Commands', () => {
    it('should route "rerunCall" to ApiPoolManager and return the result', async () => {
      // Arrange
      const modifiedRequest: AiCallLog['request'] = {
        provider: 'openai',
        model: 'gpt-4o',
        prompt: 'New Prompt',
        temperature: 0.8
      };

      const mockResult: WorkerResult = {
        signal: 'SIGNAL:SUCCESS',
        newPayload: [{ id: '1', type: 'AI_RESPONSE', content: 'New Response Content', timestamp: '' }]
      };

      mockApiManager.execute.mockResolvedValue(mockResult);

      // Act
      await handleEvent({ command: 'rerunCall', payload: { modifiedRequest } }, mockContext);

      // Assert 1: Called execute with correct construction
      expect(mockApiManager.execute).toHaveBeenCalledWith(expect.objectContaining({
        context: expect.arrayContaining([
            expect.objectContaining({ content: 'New Prompt' })
        ]),
        worktreePath: expect.stringContaining('mock/workspace') // Fallback path
      }));

      // Assert 2: Posted result back to WebView
      expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'rerunComplete',
        payload: expect.objectContaining({
            content: 'New Response Content'
        })
      }));
    });

    it('should handle "rerunCall" failure', async () => {
        // Arrange
        mockApiManager.execute.mockRejectedValue(new Error('API Failure'));
  
        // Act
        await handleEvent({ 
            command: 'rerunCall', 
            payload: { modifiedRequest: { provider: 'openai', model: 'gpt-4o', prompt: 'test' } } 
        }, mockContext);
  
        // Assert
        expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
          command: 'rerunComplete',
          payload: expect.objectContaining({
              content: '',
              error: 'API Failure'
          })
        }));
      });
  });
});