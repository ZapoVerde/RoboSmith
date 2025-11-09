/**
 * @file packages/client/src/lib/workflow/Orchestrator.spec.ts
 * @stamp S-20251107T130200Z-C-REFACTOR-FINALIZE
 * @test-target packages/client/src/lib/workflow/Orchestrator.ts
 * @description
 * A comprehensive, consolidated integration test suite for the main Orchestrator class.
 * It verifies all integrated behaviors, including state transitions (JUMP, CALL, RETURN),
 * context boundary enforcement, payload merging, default fallbacks, error handling,
 * and the correct emission of the `WorkflowViewState` object and completion signal.
 * @criticality The test target is CRITICAL, as it is the central execution engine of the application.
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
  import type { Mock } from 'vitest';
  import { Orchestrator } from './Orchestrator';
  import { logger } from '../logging/logger';
  import type { ContextSegment, WorkflowManifest, WorkflowViewState } from '../../shared/types';
  import type { ContextPartitionerService } from '../context/ContextPartitionerService';
  import type { ApiPoolManager } from '../ai/ApiPoolManager';
  
  // --- Test Data and Mocks ---
  
  const MOCK_TRANSITION_MANIFEST: WorkflowManifest = {
    NodeJump: {
      entry_block: 'NodeJump__Start',
      context_inheritance: true,
      static_memory: {},
      blocks: {
        Start: {
          worker: 'Worker:JumpStart',
          payload_merge_strategy: [],
          transitions: [{ on_signal: 'SIGNAL:SUCCESS', action: 'JUMP:NodeJump__End' }],
        },
        End: { worker: 'Worker:JumpEnd', payload_merge_strategy: [], transitions: [] },
      },
    },
    NodeParent: {
      entry_block: 'NodeParent__StartCall',
      context_inheritance: true,
      static_memory: {},
      blocks: {
        StartCall: {
          worker: 'Worker:Parent',
          payload_merge_strategy: [],
          transitions: [{ on_signal: 'SIGNAL:SUCCESS', action: 'CALL:NodeChild:NodeParent__AfterReturn' }],
        },
        AfterReturn: { worker: 'Worker:ParentAfterReturn', payload_merge_strategy: [], transitions: [] },
      },
    },
    NodeChild: {
      entry_block: 'NodeChild__DoWork',
      context_inheritance: false,
      static_memory: {},
      blocks: {
        DoWork: {
          worker: 'Worker:Child',
          payload_merge_strategy: [],
          transitions: [{ on_signal: 'SIGNAL:SUCCESS', action: 'RETURN' }],
        },
      },
    },
    NodeFallback: {
      entry_block: 'NodeFallback__Trigger',
      context_inheritance: true,
      static_memory: {},
      blocks: {
        Trigger: {
          worker: 'Worker:Fallback',
          payload_merge_strategy: [],
          transitions: [
            { on_signal: 'SIGNAL:KNOWN', action: 'JUMP:NodeFallback__KnownPath' },
            { on_signal: 'SIGNAL:FAIL_DEFAULT', action: 'JUMP:NodeFallback__DefaultPath' },
          ],
        },
        KnownPath: { worker: 'Worker:Test', payload_merge_strategy: [], transitions: [] },
        DefaultPath: { worker: 'Worker:Default', payload_merge_strategy: [], transitions: [] },
      },
    },
    NodeTerminate: {
      entry_block: 'NodeTerminate__Start',
      context_inheritance: true,
      static_memory: {},
      blocks: {
        Start: {
          worker: 'Worker:Test',
          payload_merge_strategy: [],
          transitions: [{ on_signal: 'SIGNAL:SUCCESS', action: 'RETURN' }], // Return from empty stack
        },
      },
    },
  };
  
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
  
  describe('Orchestrator', () => {
    let mockApiManager: ApiPoolManager;
    let mockOnStateUpdate: Mock;
    let mockOnCompletion: Mock;
    const mockContextService = {} as ContextPartitionerService;
    const MOCK_WORKTREE_PATH = '/mock/worktree/path-123';
  
    beforeEach(() => {
      vi.clearAllMocks();
      mockOnStateUpdate = vi.fn();
      mockOnCompletion = vi.fn();
      mockApiManager = {
        execute: vi.fn().mockResolvedValue({
          signal: 'SIGNAL:SUCCESS',
          newPayload: [],
        }),
      } as unknown as ApiPoolManager;
    });
  
    describe('Initialization and Error Handling', () => {
      it('should throw an error if the startNodeId is not in the manifest', async () => {
        const orchestrator = new Orchestrator(MOCK_TRANSITION_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await expect(orchestrator.executeNode('Node:DoesNotExist', MOCK_WORKTREE_PATH)).rejects.toThrow(
          'Start node "Node:DoesNotExist" not found in manifest.'
        );
      });
  
      it('should throw WorkflowHaltedError if a block ID is malformed', async () => {
        const malformedManifest: WorkflowManifest = {
          NodeMalformed: {
            entry_block: 'NodeMalformedStart',
            context_inheritance: true,
            static_memory: {},
            blocks: {
              Start: { worker: 'Worker:Test', payload_merge_strategy: [], transitions: [] },
            },
          },
        };
        const orchestrator = new Orchestrator(malformedManifest, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await expect(orchestrator.executeNode('NodeMalformed', MOCK_WORKTREE_PATH)).rejects.toThrow(
          'Invalid blockId format: "NodeMalformedStart". Must be "NodeId__BlockName".'
        );
      });
  
      it('should throw WorkflowHaltedError if a JUMP target is invalid', async () => {
        const invalidManifest: WorkflowManifest = {
          NodeInvalidJump: {
            entry_block: 'NodeInvalidJump__Start',
            context_inheritance: true,
            static_memory: {},
            blocks: {
              Start: {
                worker: 'Worker:Test',
                payload_merge_strategy: [],
                transitions: [{ on_signal: 'SIGNAL:SUCCESS', action: 'JUMP:NodeInvalidJump__DoesNotExist' }],
              },
            },
          },
        };
        const orchestrator = new Orchestrator(invalidManifest, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await expect(orchestrator.executeNode('NodeInvalidJump', MOCK_WORKTREE_PATH)).rejects.toThrow(
          'Block "DoesNotExist" not found in node "NodeInvalidJump".'
        );
      });
    });
  
    describe('Worktree Path Propagation', () => {
      it('should include the worktreePath in the WorkOrder for every block execution', async () => {
        const orchestrator = new Orchestrator(MOCK_TRANSITION_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await orchestrator.executeNode('NodeJump', MOCK_WORKTREE_PATH);
  
        expect(mockApiManager.execute).toHaveBeenCalledTimes(2);
        expect(vi.mocked(mockApiManager.execute).mock.calls[0][0]).toEqual(
          expect.objectContaining({ worktreePath: MOCK_WORKTREE_PATH, worker: 'Worker:JumpStart' })
        );
        expect(vi.mocked(mockApiManager.execute).mock.calls[1][0]).toEqual(
          expect.objectContaining({ worktreePath: MOCK_WORKTREE_PATH, worker: 'Worker:JumpEnd' })
        );
      });
    });
  
    describe('Execution Failure Handling', () => {
      it('should halt and propagate the error if a worker execution fails', async () => {
        const workerError = new Error('Worker API Failed');
        vi.mocked(mockApiManager.execute).mockRejectedValue(workerError);
        const orchestrator = new Orchestrator(MOCK_TRANSITION_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await expect(orchestrator.executeNode('NodeJump', MOCK_WORKTREE_PATH)).rejects.toThrow(workerError);
        expect(mockApiManager.execute).toHaveBeenCalledOnce();
        expect(mockOnStateUpdate).toHaveBeenCalledOnce();
        expect(mockOnStateUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                statuses: expect.objectContaining({ 'NodeJump__Start': 'active' }),
            })
        );
      });
    });
  
    describe('JUMP Action', () => {
      it('should correctly transition to the next block within the same node', async () => {
        const orchestrator = new Orchestrator(MOCK_TRANSITION_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await orchestrator.executeNode('NodeJump', MOCK_WORKTREE_PATH);
  
        const executedWorkers = vi.mocked(mockApiManager.execute).mock.calls.map(call => call[0].worker);
        expect(executedWorkers).toEqual(['Worker:JumpStart', 'Worker:JumpEnd']);
      });
  
      it('should publish state updates for each executed block in WorkflowViewState format', async () => {
        const orchestrator = new Orchestrator(MOCK_TRANSITION_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await orchestrator.executeNode('NodeJump', MOCK_WORKTREE_PATH);
    
        expect(mockOnStateUpdate).toHaveBeenCalledTimes(3);
    
        // Check the first state update (Start block is active)
        const firstCallPayload = mockOnStateUpdate.mock.calls[0][0] as WorkflowViewState;
        expect(firstCallPayload).toHaveProperty('graph');
        expect(firstCallPayload).toHaveProperty('statuses');
        expect(firstCallPayload).toHaveProperty('executionLog');
        expect(firstCallPayload).toHaveProperty('allWorkflowsStatus');
        expect(firstCallPayload.statuses['NodeJump__Start']).toBe('active');
        expect(firstCallPayload.statuses['NodeJump__End']).toBe('pending');
    
        // Check the second state update (End block is active)
        const secondCallPayload = mockOnStateUpdate.mock.calls[1][0] as WorkflowViewState;
        expect(secondCallPayload.statuses['NodeJump__Start']).toBe('complete');
        expect(secondCallPayload.statuses['NodeJump__End']).toBe('active');
        expect(secondCallPayload.lastTransition).toEqual({
            fromBlock: 'NodeJump__Start',
            toBlock: 'NodeJump__End',
            signal: 'SIGNAL:SUCCESS',
        });
    
        // Check the final state update (termination)
        const finalCallPayload = mockOnStateUpdate.mock.calls[2][0] as WorkflowViewState;
        expect(finalCallPayload.statuses['NodeJump__End']).toBe('complete');
        expect(finalCallPayload.lastTransition).toBeNull();
      });
    });
  
    describe('CALL and RETURN Actions', () => {
      it('should correctly execute a subroutine and return to the caller', async () => {
        const orchestrator = new Orchestrator(MOCK_TRANSITION_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await orchestrator.executeNode('NodeParent', MOCK_WORKTREE_PATH);
  
        const executedWorkers = vi.mocked(mockApiManager.execute).mock.calls.map(call => call[0].worker);
        expect(executedWorkers).toEqual(['Worker:Parent', 'Worker:Child', 'Worker:ParentAfterReturn']);
  
        const debugCalls = vi.mocked(logger.debug).mock.calls.map(call => call[0]);
        expect(debugCalls).toContain('Executing CALL to: NodeChild, pushing return address: NodeParent__AfterReturn');
        expect(debugCalls).toContain('Executing RETURN to: NodeParent__AfterReturn');
      });
    });
  
    describe('Default Fallback Logic', () => {
      it('should use the SIGNAL:FAIL_DEFAULT transition when no direct signal matches', async () => {
        vi.mocked(mockApiManager.execute).mockResolvedValue({
          signal: 'SIGNAL:SOMETHING_UNEXPECTED',
          newPayload: [],
        });
        const orchestrator = new Orchestrator(MOCK_TRANSITION_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await orchestrator.executeNode('NodeFallback', MOCK_WORKTREE_PATH);
  
        const executedWorkers = vi.mocked(mockApiManager.execute).mock.calls.map(call => call[0].worker);
        expect(executedWorkers).toEqual(['Worker:Fallback', 'Worker:Default']);
      });
    });
  
    describe('Termination Conditions', () => {
      it('should terminate gracefully when a RETURN is called on an empty stack', async () => {
        const orchestrator = new Orchestrator(MOCK_TRANSITION_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await orchestrator.executeNode('NodeTerminate', MOCK_WORKTREE_PATH);
  
        expect(mockApiManager.execute).toHaveBeenCalledOnce();
        expect(logger.info).toHaveBeenCalledWith('Workflow execution finished.');
        expect(logger.warn).toHaveBeenCalledWith('RETURN action executed on an empty stack. Workflow will terminate.');
      });
  
      it('should terminate gracefully if no transition matches and no default is provided', async () => {
        vi.mocked(mockApiManager.execute).mockResolvedValue({
          signal: 'SIGNAL:UNKNOWN',
          newPayload: [],
        });
        const orchestrator = new Orchestrator(MOCK_TRANSITION_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await orchestrator.executeNode('NodeJump', MOCK_WORKTREE_PATH);
  
        expect(mockApiManager.execute).toHaveBeenCalledOnce();
        expect(logger.debug).toHaveBeenCalledWith('No transition for signal "SIGNAL:UNKNOWN" and no default. Terminating.');
        expect(logger.info).toHaveBeenCalledWith('Workflow execution finished.');
      });

      it('should call onCompletion when the workflow terminates gracefully', async () => {
        const orchestrator = new Orchestrator(MOCK_TRANSITION_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await orchestrator.executeNode('NodeTerminate', MOCK_WORKTREE_PATH);
    
        expect(mockOnCompletion).toHaveBeenCalledOnce();
    
        // Verify it was called after the final state update
        const finalStateUpdateCallOrder = mockOnStateUpdate.mock.invocationCallOrder[mockOnStateUpdate.mock.calls.length - 1];
        const completionCallOrder = mockOnCompletion.mock.invocationCallOrder[0];
        expect(completionCallOrder).toBeGreaterThan(finalStateUpdateCallOrder);
      });
    });
  
    it('should correctly handle CALL and RETURN actions for nested nodes', async () => {
      const orchestrator = new Orchestrator(
        MOCK_CONTEXT_MANIFEST,
        mockContextService,
        mockApiManager,
        mockOnStateUpdate,
        mockOnCompletion
      );
      await orchestrator.executeNode('NodeParent', '/mock/worktree');
  
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
        mockOnStateUpdate,
        mockOnCompletion
      );
      await orchestrator.executeNode('NodeParent', '/mock/worktree');
  
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
        mockOnStateUpdate,
        mockOnCompletion
      );
      await orchestrator.executeNode('NodeFallback', '/mock/worktree');
  
      const debugCalls = vi.mocked(logger.debug).mock.calls.map((call) => call[0]);
  
      expect(debugCalls).toContain('Executing block: NodeFallback__BlockDefaultPath');
      expect(debugCalls).not.toContain('Executing block: NodeFallback__BlockKnownPath');
    });
  
    it('should assemble the execution payload according to the payload_merge_strategy', async () => {
      const orchestrator = new Orchestrator(
        MOCK_CONTEXT_MANIFEST,
        mockContextService,
        mockApiManager,
        mockOnStateUpdate,
        mockOnCompletion
      );
  await orchestrator.executeNode('NodePayloadMerge', '/mock/worktree');
  
      const executeCall = vi.mocked(mockApiManager.execute).mock.calls[0][0];
      const payload = executeCall.context as ContextSegment[];
  
      const mergedSegment = payload.find(
        (seg) => seg.type === 'STATIC_MEMORY' && seg.content === 'This is a static instruction.'
      );
  
      expect(mergedSegment).toBeDefined();
    });
  });