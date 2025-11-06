/**
 * @file packages/client/src/lib/workflow/Orchestrator.context.spec.ts
 * @stamp S-20251102T150000Z-V-CREATED
 * @test-target packages/client/src/lib/workflow/Orchestrator.transitions.ts
 * @description
 * Test suite for the Orchestrator engine's state and context management. This
 * suite verifies the correct handling of nested node calls (CALL/RETURN),
 * context inheritance boundaries, payload assembly, and default fallback paths.
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
import { Orchestrator } from './Orchestrator.transitions';
import { logger } from '../logging/logger';
import type { ContextSegment, WorkflowManifest } from '../../shared/types';
import type { ContextPartitionerService } from '../context/ContextPartitionerService';
import type { ApiPoolManager } from '../ai/ApiPoolManager';

// --- Test Data and Mocks ---

/**
 * A comprehensive manifest designed to test all context-related behaviors.
 * FIX: All Node IDs have been renamed to remove colons (e.g., "Node:Parent" -> "NodeParent").
 * This resolves the parsing ambiguity in the ActionHandler.
 */
const MOCK_CONTEXT_MANIFEST: WorkflowManifest = {
  NodeParent: {
    entry_block: 'NodeParent__BlockStartCall',
    context_inheritance: true,
    static_memory: {
      parent_rule: 'Parent Rule 1',
    },
    blocks: {
      BlockStartCall: {
        worker: 'Worker:Parent',
        payload_merge_strategy: [],
        transitions: [
          {
            on_signal: 'SIGNAL:SUCCESS',
            action: 'CALL:NodeChild:NodeParent__BlockAfterReturn',
          },
        ],
      },
      BlockAfterReturn: {
        worker: 'Worker:Parent',
        payload_merge_strategy: [],
        transitions: [],
      },
    },
  },
  NodeChild: {
    entry_block: 'NodeChild__BlockDoWork',
    context_inheritance: false,
    static_memory: {
      child_rule: 'Child Rule 1',
    },
    blocks: {
      BlockDoWork: {
        worker: 'Worker:Child',
        payload_merge_strategy: [],
        transitions: [{ on_signal: 'SIGNAL:SUCCESS', action: 'RETURN' }],
      },
    },
  },
  NodeFallback: {
    entry_block: 'NodeFallback__BlockTrigger',
    context_inheritance: true,
    static_memory: {},
    blocks: {
      BlockTrigger: {
        worker: 'Worker:Fallback',
        payload_merge_strategy: [],
        transitions: [
          { on_signal: 'SIGNAL:KNOWN', action: 'JUMP:NodeFallback__BlockKnownPath' },
          { on_signal: 'SIGNAL:FAIL_DEFAULT', action: 'JUMP:NodeFallback__BlockDefaultPath' },
        ],
      },
      BlockKnownPath: { worker: 'Worker:Test', payload_merge_strategy: [], transitions: [] },
      BlockDefaultPath: { worker: 'Worker:Test', payload_merge_strategy: [], transitions: [] },
    },
  },
  NodePayloadMerge: {
    entry_block: 'NodePayloadMerge__BlockMerge',
    context_inheritance: true,
    static_memory: {
      instruction: 'This is a static instruction.',
    },
    blocks: {
      BlockMerge: {
        worker: 'Worker:Payload',
        payload_merge_strategy: ['MERGE:STATIC_MEMORY:instruction'],
        transitions: [],
      },
    },
  },
};

describe('Orchestrator - Context and State Management', () => {
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

  it('should correctly handle CALL and RETURN actions for nested nodes', async () => {
    const orchestrator = new Orchestrator(
      MOCK_CONTEXT_MANIFEST,
      mockContextService,
      mockApiManager,
      mockOnStateUpdate
    );
    await orchestrator.executeNode('NodeParent');

    const debugCalls = vi.mocked(logger.debug).mock.calls.map((call) => call[0]);

    expect(debugCalls).toContain('Executing block: NodeParent__BlockStartCall');
    expect(debugCalls).toContain('Executing CALL to: NodeChild, pushing return address: NodeParent__BlockAfterReturn');
    expect(debugCalls).toContain('Executing block: NodeChild__BlockDoWork');
    expect(debugCalls).toContain('Executing RETURN to: NodeParent__BlockAfterReturn');
    expect(debugCalls).toContain('Executing block: NodeParent__BlockAfterReturn');
  });

  it('should enforce context boundaries when context_inheritance is false', async () => {
    const orchestrator = new Orchestrator(
      MOCK_CONTEXT_MANIFEST,
      mockContextService,
      mockApiManager,
      mockOnStateUpdate
    );
    await orchestrator.executeNode('NodeParent');

    const executeCalls = vi.mocked(mockApiManager.execute).mock.calls;
    const childBlockCall = executeCalls.find((call) => call[0].worker === 'Worker:Child');

    expect(childBlockCall).toBeDefined();

    if (childBlockCall) {
      const childContext = childBlockCall[0].context as ContextSegment[];
      expect(childContext.some((seg) => seg.content.includes('Child Rule 1'))).toBe(true);
      expect(childContext.some((seg) => seg.content.includes('Parent Rule 1'))).toBe(false);
    }
  });

  it('should use the SIGNAL:FAIL_DEFAULT transition when no other signal matches', async () => {
    vi.mocked(mockApiManager.execute).mockResolvedValue({
      signal: 'SIGNAL:UNEXPECTED',
      newPayload: [],
    });

    const orchestrator = new Orchestrator(
      MOCK_CONTEXT_MANIFEST,
      mockContextService,
      mockApiManager,
      mockOnStateUpdate
    );
    await orchestrator.executeNode('NodeFallback');

    const debugCalls = vi.mocked(logger.debug).mock.calls.map((call) => call[0]);

    expect(debugCalls).toContain('Executing block: NodeFallback__BlockDefaultPath');
    expect(debugCalls).not.toContain('Executing block: NodeFallback__BlockKnownPath');
  });

  it('should assemble the execution payload according to the payload_merge_strategy', async () => {
    const orchestrator = new Orchestrator(
      MOCK_CONTEXT_MANIFEST,
      mockContextService,
      mockApiManager,
      mockOnStateUpdate
    );
    await orchestrator.executeNode('NodePayloadMerge');

    const executeCall = vi.mocked(mockApiManager.execute).mock.calls[0][0];
    const payload = executeCall.context as ContextSegment[];

    const mergedSegment = payload.find(
      (seg) => seg.type === 'STATIC_MEMORY' && seg.content === 'This is a static instruction.'
    );

    expect(mergedSegment).toBeDefined();
  });
});