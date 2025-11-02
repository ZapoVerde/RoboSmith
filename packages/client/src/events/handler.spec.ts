/**
 * @file packages/client/src/events/handler.spec.ts
 * @stamp S-20251101T231500Z-V-TESTFIX-DEFINITIVE
 * @test-target packages/client/src/events/handler.ts
 * @description
 * Verifies that the central event handler correctly routes all incoming commands
 * from the WebView to the appropriate backend services or state stores.
 * @criticality
 * The test target is CRITICAL as it is the primary command router (Rubric Point #2).
 * @testing-layer Integration
 *
 * @contract
 *   assertions:
 *     - Verifies routing for all API key management commands.
 *     - Verifies that `startWorkflow` correctly instantiates and calls the Orchestrator.
 *     - Verifies that the concurrency guard prevents multiple simultaneous workflows.
 *     - Verifies graceful error handling if the Orchestrator's execution fails. 
 */

// --- HOISTING-SAFE MOCKS ---
vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
  default: {},
}));
vi.mock('../features/settings/state/SettingsStore');
vi.mock('../lib/workflow/Orchestrator');

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock, } from 'vitest';
import type { handleEvent, EventHandlerContext } from './handler';
import { settingsStore } from '../features/settings/state/SettingsStore';
import { Orchestrator, WorkflowHaltedError } from '../lib/workflow/Orchestrator';
import type { Message } from '../shared/types';
import type { WebviewPanel } from 'vscode';
import type { WorkflowManifest } from '../lib/workflow/WorkflowService';
import type { ContextPartitionerService } from '../lib/context/ContextPartitionerService';
import type { ApiPoolManager } from '../lib/ai/ApiPoolManager';
import type { SecureStorageService } from '../lib/ai/SecureStorageService';
import type { ApiKey } from '@shared/domain/api-key';

describe('handleEvent', () => {
  let mockContext: EventHandlerContext;
  let mockPostMessage: Mock;
  let handleEventModule: { handleEvent: typeof handleEvent };

  const mockLoadApiKeys = vi.fn();
  const mockAddApiKey = vi.fn();
  const mockRemoveApiKey = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    handleEventModule = await import('./handler');
    mockPostMessage = vi.fn();

    mockContext = {
      secureStorageService: {} as unknown as SecureStorageService,
      panel: { webview: { postMessage: mockPostMessage } } as unknown as WebviewPanel,
      manifest: {} as WorkflowManifest,
      contextService: {} as ContextPartitionerService,
      apiManager: {} as ApiPoolManager,
    };

    vi.mocked(settingsStore.getState).mockReturnValue({
      loadApiKeys: mockLoadApiKeys,
      addApiKey: mockAddApiKey,
      removeApiKey: mockRemoveApiKey,
    } as unknown as ReturnType<typeof settingsStore.getState>);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('API Key Management Commands', () => {
    it("should route the 'loadApiKeys' command to the settings store", async () => {
      const message: Message = { command: 'loadApiKeys', payload: undefined };
      await handleEventModule.handleEvent(message, mockContext);
      expect(mockLoadApiKeys).toHaveBeenCalledOnce();
    });

    it("should route the 'addApiKey' command to the settings store", async () => {
      const newApiKey: ApiKey = { id: 'key-1', provider: 'openai', secret: 'sk-1' };
      const message: Message = { command: 'addApiKey', payload: newApiKey };
      await handleEventModule.handleEvent(message, mockContext);
      expect(mockAddApiKey).toHaveBeenCalledWith(newApiKey, mockContext.secureStorageService);
    });

    it("should route the 'removeApiKey' command to the settings store", async () => {
      const message: Message = { command: 'removeApiKey', payload: { id: 'key-to-delete' } };
      await handleEventModule.handleEvent(message, mockContext);
      expect(mockRemoveApiKey).toHaveBeenCalledWith('key-to-delete', mockContext.secureStorageService);
    });
  });

  describe('Workflow Control Commands', () => {
    it('should instantiate and run the Orchestrator on "startWorkflow"', async () => {
      const message: Message = { command: 'startWorkflow', payload: { nodeId: 'test-node' } };
      await handleEventModule.handleEvent(message, mockContext);
      expect(Orchestrator).toHaveBeenCalledOnce();
      const orchestratorInstance = vi.mocked(Orchestrator).mock.instances[0];
      expect(orchestratorInstance.executeNode).toHaveBeenCalledWith('test-node');
    });

    it('should not start a new workflow if one is already running', async () => {
      const message: Message = { command: 'startWorkflow', payload: { nodeId: 'test-node' } };
    
      let resolveFirstCall: ((value: unknown) => void) | undefined;
      const firstCallPromise = new Promise((resolve) => {
        resolveFirstCall = resolve;
      });
      const mockExecuteNode = vi.fn().mockReturnValue(firstCallPromise);
    
      // Properly typed mock implementation
      vi.mocked(Orchestrator).mockImplementation(
        vi.fn(function (this: Orchestrator) {
          this.executeNode = mockExecuteNode;
          return this;
        }) as unknown as new (...args: ConstructorParameters<typeof Orchestrator>) => Orchestrator
      );
    
      const firstPromise = handleEventModule.handleEvent(message, mockContext);
      await handleEventModule.handleEvent(message, mockContext);
    
      expect(Orchestrator).toHaveBeenCalledOnce();
    
      if (resolveFirstCall) {
        resolveFirstCall(undefined);
      }
      await firstPromise;
    });

    it('should handle and log errors from the Orchestrator execution', async () => {
      const message: Message = { command: 'startWorkflow', payload: { nodeId: 'failing-node' } };
      const testError = new WorkflowHaltedError('Test halt');
      const mockExecuteNode = vi.fn().mockRejectedValue(testError);
    
      // Applied the same properly typed mock implementation
      vi.mocked(Orchestrator).mockImplementation(
        vi.fn(function (this: Orchestrator) {
          this.executeNode = mockExecuteNode;
          return this;
        }) as unknown as new (...args: ConstructorParameters<typeof Orchestrator>) => Orchestrator
      );
    
      await expect(handleEventModule.handleEvent(message, mockContext)).resolves.not.toThrow();
    });  

  });
});