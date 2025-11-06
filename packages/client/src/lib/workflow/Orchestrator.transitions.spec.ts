/**
 * @file packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts
 * @test-target packages/client/src/lib/workflow/Orchestrator.transitions.ts
 * @description Verifies the core state transition logic of the Orchestrator by providing mocked service dependencies (ApiPoolManager, ContextPartitionerService).
 * @criticality The test target is CRITICAL.
 * @testing-layer Integration
 */

// --- Environment Mocks (Essential) ---
vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
  default: {},
}));

vi.mock('../logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// --- Imports ---
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from './Orchestrator.transitions';
import { logger } from '../logging/logger';
import type { WorkflowManifest } from '../../shared/types';
import type { ContextPartitionerService } from '../context/ContextPartitionerService';
import type { ApiPoolManager } from '../ai/ApiPoolManager';

// --- Test Data and Mocks ---
const MOCK_MANIFEST: WorkflowManifest = {
  'Node:SingleStep': {
    entry_block: 'Node:SingleStep__Block:Start',
    context_inheritance: true,
    static_memory: {},
    blocks: {
      'Block:Start': {
        worker: 'Worker:Test',
        payload_merge_strategy: [],
        transitions: [],
      },
    },
  },
  'Node:MultiStep': {
    entry_block: 'Node:MultiStep__Block:Start',
    context_inheritance: true,
    static_memory: {},
    blocks: {
      'Block:Start': {
        worker: 'Worker:Test',
        payload_merge_strategy: [],
        transitions: [
          { on_signal: 'SIGNAL:SUCCESS', action: 'JUMP:Node:MultiStep__Block:End' },
        ],
      },
      'Block:End': {
        worker: 'Worker:Test',
        payload_merge_strategy: [],
        transitions: [],
      },
    },
  },
};

describe('Orchestrator', () => {
  let mockApiManager: ApiPoolManager;
  const mockContextService = {} as ContextPartitionerService;
  const mockOnStateUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiManager = {
      execute: vi.fn().mockResolvedValue({
        signal: 'SIGNAL:SUCCESS',
        newPayload: [],
      }),
    } as unknown as ApiPoolManager;
  });

  it('should throw an error if the initial nodeId is not found', async () => {
    // Arrange
    const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
    
    // Act & Assert
    await expect(orchestrator.executeNode('Node:DoesNotExist')).rejects.toThrow(
      'Start node "Node:DoesNotExist" not found in manifest.'
    );
  });

  it('should execute a single-step node successfully', async () => {
    // Arrange
    const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
    
    // Act
    await orchestrator.executeNode('Node:SingleStep');

    // Assert
    expect(logger.debug).toHaveBeenCalledWith('Executing block: Node:SingleStep__Block:Start');
  });

  it('should follow a JUMP transition to the next block in the same node', async () => {
    // Arrange
    const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
    
    // Act
    await orchestrator.executeNode('Node:MultiStep');

    // Assert
    const debugCalls = vi.mocked(logger.debug).mock.calls.map(call => call[0]);
    expect(debugCalls).toContain('Executing block: Node:MultiStep__Block:Start');
    expect(debugCalls).toContain('Executing JUMP to: Node:MultiStep__Block:End');
    expect(debugCalls).toContain('Executing block: Node:MultiStep__Block:End');
  });

  it('should call the correct worker via the ApiPoolManager', async () => {
    // Arrange
    const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
    
    // Act
    await orchestrator.executeNode('Node:SingleStep');

    // Assert
    expect(mockApiManager.execute).toHaveBeenCalledOnce();
    expect(mockApiManager.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        worker: 'Worker:Test',
      })
    );
  });
});