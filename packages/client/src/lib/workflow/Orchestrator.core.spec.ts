/**
 * @file packages/client/src/lib/workflow/Orchestrator.core.spec.ts
 * @stamp 2025-11-30T15:00:00.000Z
 * @test-target packages/client/src/lib/workflow/Orchestrator.ts
 * @description
 * Integration tests for the Core Engine Mechanics.
 * Covers: Initialization, JUMP/CALL/RETURN, Context Integration, and Failure Handling.
 * @criticality CRITICAL
 * @testing-layer Integration
 */

vi.mock('vscode', () => ({
    window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
    default: {},
  }));
  vi.mock('../logging/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }));
  vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid-core') }));
  
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import type { Mock } from 'vitest';
  import { Orchestrator } from './Orchestrator';
  import { logger } from '../logging/logger';
  import type { WorkflowManifest } from '../../shared/types';
  import type { ContextPartitionerService } from '../context/ContextPartitionerService';
  import type { ApiPoolManager } from '../ai/ApiPoolManager';
  
  // Combined manifest covering all core mechanics
  const MOCK_MANIFEST: WorkflowManifest = {
    NodeJump: {
      entry_block: 'NodeJump__Start',
      context_inheritance: true,
      static_memory: {},
      blocks: {
        Start: {
          worker: 'Worker:A',
          payload_merge_strategy: [],
          transitions: [{ on_signal: 'SIGNAL:SUCCESS', action: 'JUMP:NodeJump__End' }],
        },
        End: { worker: 'Worker:B', payload_merge_strategy: [], transitions: [] },
      },
    },
    NodeParent: {
      entry_block: 'NodeParent__Start',
      context_inheritance: true,
      static_memory: { parent_rule: 'Parent Rule' },
      blocks: {
        Start: {
          worker: 'Worker:Parent',
          payload_merge_strategy: [],
          transitions: [{ on_signal: 'SIGNAL:SUCCESS', action: 'CALL:NodeChild:NodeParent__End' }],
        },
        End: { worker: 'Worker:ParentEnd', payload_merge_strategy: [], transitions: [] },
      },
    },
    NodeChild: {
      entry_block: 'NodeChild__Start',
      context_inheritance: false, // Context Boundary
      static_memory: { child_rule: 'Child Rule' },
      blocks: {
        Start: {
          worker: 'Worker:Child',
          payload_merge_strategy: [],
          transitions: [{ on_signal: 'SIGNAL:SUCCESS', action: 'RETURN' }],
        },
      },
    },
    NodeFallback: {
      entry_block: 'NodeFallback__Start',
      context_inheritance: true,
      static_memory: {},
      blocks: {
        Start: {
          worker: 'Worker:Fallback',
          payload_merge_strategy: [],
          transitions: [
            { on_signal: 'SIGNAL:FAIL_DEFAULT', action: 'JUMP:NodeFallback__End' }
          ],
        },
        End: { worker: 'Worker:End', payload_merge_strategy: [], transitions: [] },
      },
    },
  };
  
  describe('Orchestrator Core Mechanics', () => {
    let mockApiManager: ApiPoolManager;
    let mockOnStateUpdate: Mock;
    let mockOnCompletion: Mock;
    const mockContextService = {} as ContextPartitionerService;
    const WORKTREE = '/mock/path';
  
    beforeEach(() => {
      vi.clearAllMocks();
      mockOnStateUpdate = vi.fn();
      mockOnCompletion = vi.fn();
      mockApiManager = {
        execute: vi.fn().mockResolvedValue({ signal: 'SIGNAL:SUCCESS', newPayload: [] }),
      } as unknown as ApiPoolManager;
    });
  
    describe('Initialization Validation', () => {
      it('should throw if startNodeId is missing', async () => {
        const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await expect(orchestrator.executeNode('MissingNode', WORKTREE)).rejects.toThrow('Start node "MissingNode" not found');
      });
    });
  
    describe('Control Flow', () => {
      it('should execute JUMP transitions', async () => {
        const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await orchestrator.executeNode('NodeJump', WORKTREE);
        
        const calls = vi.mocked(mockApiManager.execute).mock.calls;
        expect(calls.map(c => c[0].worker)).toEqual(['Worker:A', 'Worker:B']);
        expect(mockOnCompletion).toHaveBeenCalled();
      });
  
      it('should execute CALL/RETURN transitions', async () => {
        const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await orchestrator.executeNode('NodeParent', WORKTREE);
        
        const calls = vi.mocked(mockApiManager.execute).mock.calls;
        expect(calls.map(c => c[0].worker)).toEqual(['Worker:Parent', 'Worker:Child', 'Worker:ParentEnd']);
      });
  
      it('should use FAIL_DEFAULT transition when signal matches nothing', async () => {
        vi.mocked(mockApiManager.execute).mockResolvedValueOnce({ signal: 'SIGNAL:UNKNOWN', newPayload: [] });
        const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        
        await orchestrator.executeNode('NodeFallback', WORKTREE);
        
        const calls = vi.mocked(mockApiManager.execute).mock.calls;
        expect(calls.map(c => c[0].worker)).toEqual(['Worker:Fallback', 'Worker:End']);
      });
    });
  
    describe('Context Integration', () => {
      it('should enforce context boundaries (context_inheritance: false)', async () => {
        const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        await orchestrator.executeNode('NodeParent', WORKTREE);
  
        const calls = vi.mocked(mockApiManager.execute).mock.calls;
        const childCall = calls.find(c => c[0].worker === 'Worker:Child');
        
        if (!childCall) throw new Error('Child worker not called');
        
        const contextContent = childCall[0].context.map(s => s.content).join(' ');
        expect(contextContent).toContain('Child Rule');
        expect(contextContent).not.toContain('Parent Rule');
      });
    });
  
    describe('Error Handling', () => {
      it('should halt execution if the Worker API fails', async () => {
        const error = new Error('API Failure');
        vi.mocked(mockApiManager.execute).mockRejectedValue(error);
        
        const orchestrator = new Orchestrator(MOCK_MANIFEST, mockContextService, mockApiManager, mockOnStateUpdate, mockOnCompletion);
        
        // Should not throw, but should stop
        await orchestrator.executeNode('NodeJump', WORKTREE);
        
        expect(mockApiManager.execute).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Worker execution failed'), expect.anything());
        // Should publish state (showing halt) but not complete
        expect(mockOnStateUpdate).toHaveBeenCalled();
        expect(mockOnCompletion).not.toHaveBeenCalled();
      });
    });
  });