/**
 * @file packages/client/src/lib/workflow/Orchestrator.spec.ts
 * @stamp S-20251102-T124500Z-V-COMPLETE
 * @test-target packages/client/src/lib/workflow/Orchestrator.ts
 * @description
 * Final test suite for the Orchestrator engine's core functionality.
 * @criticality CRITICAL
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
import { Orchestrator } from './Orchestrator';
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
    // Provide a default mock implementation for the ApiPoolManager for all tests.
    mockApiManager = {
      execute: vi.fn().mockResolvedValue({
        signal: 'SIGNAL:SUCCESS',
        newPayload: [],
      }),
    } as unknown as ApiPoolManager;
  });

  it('should throw an error if the initial nodeId is not found', async () => {
    const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
    await expect(orchestrator.executeNode('Node:DoesNotExist')).rejects.toThrow();
  });

  it('should execute a single-step node successfully', async () => {
    const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
    await orchestrator.executeNode('Node:SingleStep');
    expect(logger.debug).toHaveBeenCalledWith('Executing block: Node:SingleStep__Block:Start');
  });

  it('should follow a JUMP transition to the next block in the same node', async () => {
    const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
    await orchestrator.executeNode('Node:MultiStep');
    const debugCalls = vi.mocked(logger.debug).mock.calls;
    expect(debugCalls[0][0]).toBe('Executing block: Node:MultiStep__Block:Start');
    // Assert that the second log is the jump instruction, and the third is the final execution.
    expect(debugCalls[1][0]).toBe('Jumping to block: Node:MultiStep__Block:End');
    expect(debugCalls[2][0]).toBe('Executing block: Node:MultiStep__Block:End');
  });

  // This test is now enabled and will pass.
  it('should call the correct worker via the ApiPoolManager', async () => {
    const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
    await orchestrator.executeNode('Node:SingleStep');

    // Assert that the manager was called with the correct work order.
    expect(mockApiManager.execute).toHaveBeenCalledWith({
      worker: 'Worker:Test', // Correct property name
      context: [],           // Initial payload is empty
    });
  });
});