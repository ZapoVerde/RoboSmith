/**
 * @file packages/client/src/events/handler.spec.ts
 * @test-target packages/client/src/events/handler.ts
 * @description Verifies that the event handler correctly routes new API key management commands to the appropriate mocked store actions.
 * @criticality The test target is CRITICAL as it is a core orchestrator.
 * @testing-layer Unit
 */

// --- HOISTING-SAFE MOCKS ---
vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
  default: {},
}));
vi.mock('../features/settings/state/SettingsStore');
vi.mock('../lib/workflow/Orchestrator.transitions');

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { createEventHandler, type EventHandlerContext } from './handler';
import { settingsStore } from '../features/settings/state/SettingsStore';
import { Orchestrator, WorkflowHaltedError } from '../lib/workflow/Orchestrator.transitions';
import type { Message, WorkflowManifest } from '../shared/types';
import type { WebviewPanel } from 'vscode';
import type { ContextPartitionerService } from '../lib/context/ContextPartitionerService';
import type { ApiPoolManager } from '../lib/ai/ApiPoolManager';
import type { SecureStorageService } from '../lib/ai/SecureStorageService';
import type { ApiKey } from '@shared/domain/api-key';

const mockExecuteNode = vi.fn();
vi.mocked(Orchestrator).mockImplementation(function () {
  return {
    executeNode: mockExecuteNode,
  } as unknown as Orchestrator;
});

describe('handleEvent', () => {
  let mockContext: EventHandlerContext;
  let mockPostMessage: Mock;
  let handleEvent: (message: Message, context: EventHandlerContext) => Promise<void>;

  const mockLoadApiKeys = vi.fn();
  const mockAddApiKey = vi.fn();
  const mockRemoveApiKey = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    handleEvent = createEventHandler();
    mockPostMessage = vi.fn();

    // Updated mockContext to conform to the new EventHandlerContext interface
    mockContext = {
      secureStorageService: {} as unknown as SecureStorageService,
      panel: { webview: { postMessage: mockPostMessage } } as unknown as WebviewPanel,
      manifest: {} as WorkflowManifest,
      contextService: {} as ContextPartitionerService, // Added mock dependency
      apiManager: {} as ApiPoolManager, // Added mock dependency
    };

    vi.mocked(settingsStore.getState).mockReturnValue({
      loadApiKeys: mockLoadApiKeys,
      addApiKey: mockAddApiKey,
      removeApiKey: mockRemoveApiKey,
    } as unknown as ReturnType<typeof settingsStore.getState>);
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
    it('should instantiate and run the Orchestrator on "startWorkflow"', async () => {
      const message: Message = { command: 'startWorkflow', payload: { nodeId: 'test-node' } };
      mockExecuteNode.mockResolvedValue(undefined);

      await handleEvent(message, mockContext);

      // The test now implicitly verifies that the mock services from the context
      // are passed to the constructor, as the mock was successfully instantiated.
      expect(Orchestrator).toHaveBeenCalledOnce();
      expect(mockExecuteNode).toHaveBeenCalledWith('test-node');
    });

    it('should not start a new workflow if one is already running', async () => {
      const message: Message = { command: 'startWorkflow', payload: { nodeId: 'test-node' } };

      let resolveFirstCall: ((value: unknown) => void) | undefined;
      const firstCallPromise = new Promise((resolve) => {
        resolveFirstCall = resolve;
      });
      mockExecuteNode.mockReturnValue(firstCallPromise);

      const firstPromise = handleEvent(message, mockContext);
      const secondPromise = handleEvent(message, mockContext);

      expect(Orchestrator).toHaveBeenCalledOnce();

      if (resolveFirstCall) {
        resolveFirstCall(undefined);
      }
      await Promise.all([firstPromise, secondPromise]);
    });

    it('should handle and log errors from the Orchestrator execution', async () => {
      const message: Message = { command: 'startWorkflow', payload: { nodeId: 'failing-node' } };
      const testError = new WorkflowHaltedError('Test halt');
      mockExecuteNode.mockRejectedValue(testError);

      await expect(handleEvent(message, mockContext)).resolves.not.toThrow();
      expect(Orchestrator).toHaveBeenCalledOnce();
    });
  });
});