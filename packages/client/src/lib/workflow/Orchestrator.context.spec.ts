/**
 * @file packages/client/src/lib/workflow/Orchestrator.context.spec.ts
 * @stamp S-20251102-T150000Z-V-CREATED
 * @test-target packages/client/src/lib/workflow/Orchestrator.ts
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
  import { Orchestrator,  } from './Orchestrator.transitions';
  import { logger } from '../logging/logger';
  import type { ContextSegment, WorkflowManifest } from '../../shared/types';
  import type { ContextPartitionerService } from '../context/ContextPartitionerService';
  import type { ApiPoolManager } from '../ai/ApiPoolManager';
  
  // --- Test Data and Mocks ---
  
  /**
   * A comprehensive manifest designed to test context-related behaviors.
   */
  const MOCK_CONTEXT_MANIFEST: WorkflowManifest = {
    'Node:Parent': {
      entry_block: 'Node:Parent__Block:StartCall',
      context_inheritance: true,
      static_memory: {
        parent_rule: 'Parent Rule 1',
      },
      blocks: {
        'Block:StartCall': {
          worker: 'Worker:Parent',
          payload_merge_strategy: [],
          transitions: [{ on_signal: 'SIGNAL:SUCCESS', action: 'CALL:Node:Child' }],
        },
        // This block is the return address after the CALL completes.
        'Block:AfterReturn': {
          worker: 'Worker:Parent',
          payload_merge_strategy: [],
          transitions: [],
        },
      },
    },
    'Node:Child': {
      entry_block: 'Node:Child__Block:DoWork',
      // This is the key setting for testing context boundaries.
      context_inheritance: false,
      static_memory: {
        child_rule: 'Child Rule 1',
      },
      blocks: {
        'Block:DoWork': {
          worker: 'Worker:Child',
          payload_merge_strategy: [],
          transitions: [{ on_signal: 'SIGNAL:SUCCESS', action: 'RETURN' }],
        },
      },
    },
    'Node:Fallback': {
      entry_block: 'Node:Fallback__Block:Trigger',
      context_inheritance: true,
      static_memory: {},
      blocks: {
        'Block:Trigger': {
          worker: 'Worker:Fallback',
          payload_merge_strategy: [],
          transitions: [
            { on_signal: 'SIGNAL:KNOWN', action: 'JUMP:Node:Fallback__Block:KnownPath' },
            // This is the key setting for testing the fallback mechanism.
            { on_signal: 'SIGNAL:FAIL_DEFAULT', action: 'JUMP:Node:Fallback__Block:DefaultPath' },
          ],
        },
        'Block:KnownPath': { worker: 'Worker:Test', payload_merge_strategy: [], transitions: [] },
        'Block:DefaultPath': { worker: 'Worker:Test', payload_merge_strategy: [], transitions: [] },
      },
    },
    'Node:PayloadMerge': {
      entry_block: 'Node:PayloadMerge__Block:Merge',
      context_inheritance: true,
      static_memory: {
        instruction: 'This is a static instruction.',
      },
      blocks: {
        'Block:Merge': {
          worker: 'Worker:Payload',
          // This is the key setting for testing payload assembly.
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
      const orchestrator = new Orchestrator(MOCK_CONTEXT_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
      await orchestrator.executeNode('Node:Parent');
  
      const debugCalls = vi.mocked(logger.debug).mock.calls.map(call => call[0]);
  
      // Verify the execution flow: Parent starts -> Child is called -> Child finishes -> Parent continues
      expect(debugCalls).toContain('Executing block: Node:Parent__Block:StartCall');
      expect(debugCalls).toContain('Calling node: Node:Child');
      expect(debugCalls).toContain('Executing block: Node:Child__Block:DoWork');
      expect(debugCalls).toContain('Returning from node call.');
      expect(debugCalls).toContain('Executing block: Node:Parent__Block:AfterReturn');
    });
  
    it('should enforce context boundaries when context_inheritance is false', async () => {
        const orchestrator = new Orchestrator(MOCK_CONTEXT_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
        await orchestrator.executeNode('Node:Parent');
    
        const executeCalls = vi.mocked(mockApiManager.execute).mock.calls;
    
        // Find the call made for the child's block
        const childBlockCall = executeCalls.find(
          (call) => call[0].worker === 'Worker:Child'
        );
    
        // This assertion is a robust guard. It makes the test's expectation clear
        // and will cause a clean failure if the call is not found.
        expect(childBlockCall).toBeDefined();
    
        // This 'if' check acts as a type guard for TypeScript. After this check,
        // the compiler knows `childBlockCall` cannot be undefined, making the `!`
        // unnecessary and the code compliant with the standard.
        if (childBlockCall) {
          const childContext = childBlockCall[0].context as ContextSegment[];
    
          // Assert that the child's own static memory IS present
          expect(childContext.some((seg) => seg.content.includes('Child Rule 1'))).toBe(true);
    
          // Assert that the parent's static memory IS NOT present due to the boundary
          expect(childContext.some((seg) => seg.content.includes('Parent Rule 1'))).toBe(false);
        }
      });
  
    it('should use the SIGNAL:FAIL_DEFAULT transition when no other signal matches', async () => {
      // Override the mock to return an unhandled signal for this specific test
      vi.mocked(mockApiManager.execute).mockResolvedValue({
        signal: 'SIGNAL:UNEXPECTED',
        newPayload: [],
      });
  
      const orchestrator = new Orchestrator(MOCK_CONTEXT_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
      await orchestrator.executeNode('Node:Fallback');
  
      const debugCalls = vi.mocked(logger.debug).mock.calls.map(call => call[0]);
  
      // Verify it executed the correct default path and not the known path
      expect(debugCalls).toContain('Executing block: Node:Fallback__Block:DefaultPath');
      expect(debugCalls).not.toContain('Executing block: Node:Fallback__Block:KnownPath');
    });
  
    it('should assemble the execution payload according to the payload_merge_strategy', async () => {
      const orchestrator = new Orchestrator(MOCK_CONTEXT_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate);
      await orchestrator.executeNode('Node:PayloadMerge');
  
      const executeCall = vi.mocked(mockApiManager.execute).mock.calls[0][0];
      const payload = executeCall.context as ContextSegment[];
  
      // Assert that the static memory content was correctly merged into the final payload
      const mergedSegment = payload.find(
        (seg) => seg.type === 'STATIC_MEMORY' && seg.content === 'This is a static instruction.'
      );
  
  
      expect(mergedSegment).toBeDefined();
    });
  });