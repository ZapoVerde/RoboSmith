/**
 * @file packages/client/src/lib/workflow/Orchestrator.context.spec.ts
 * @stamp S-20251107T130300Z-C-REFACTOR-FINALIZE
 * @test-target packages/client/src/lib/workflow/Orchestrator.context.ts
 * @description A focused unit test suite for the pure `assembleContext` helper function. It verifies the five-layer memory model assembly, context inheritance rules, and payload merge strategy execution in complete isolation.
 * @criticality The test target is not independently critical, but it provides a core capability to a CRITICAL component.
 * @testing-layer Unit
 */

// --- Environment Mocks (Essential for transitive dependencies) ---
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
  
  import { describe, it, expect, vi } from 'vitest';
  import { assembleContext } from './Orchestrator.context';
  import type { WorkflowManifest, ContextSegment, BlockDefinition } from '../../shared/types';
  
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
  
  describe('assembleContext', () => {
    it('should enforce context boundaries when context_inheritance is false', () => {
      // Arrange
      const currentBlockId = 'NodeChild__BlockDoWork';
      const returnStack = ['NodeParent__BlockStartCall'];
      const executionPayload: ContextSegment[] = [];
      const block = MOCK_CONTEXT_MANIFEST['NodeChild'].blocks['BlockDoWork'] as BlockDefinition;
  
      // Act
      const result = assembleContext(MOCK_CONTEXT_MANIFEST, block, executionPayload, currentBlockId, returnStack);
  
      // Assert
      const resultContentStrings = result.map(seg => seg.content);
      expect(resultContentStrings.some(content => content.includes('Child Rule 1'))).toBe(true);
      expect(resultContentStrings.some(content => content.includes('Parent Rule 1'))).toBe(false);
    });
  
    it('should assemble the execution payload according to the payload_merge_strategy', () => {
      // Arrange
      const currentBlockId = 'NodePayloadMerge__BlockMerge';
      const returnStack: string[] = [];
      const executionPayload: ContextSegment[] = [];
      const block = MOCK_CONTEXT_MANIFEST['NodePayloadMerge'].blocks['BlockMerge'] as BlockDefinition;
  
      // Act
      const result = assembleContext(MOCK_CONTEXT_MANIFEST, block, executionPayload, currentBlockId, returnStack);
  
      // Assert
      const mergedSegment = result.find(
        (seg) => seg.type === 'STATIC_MEMORY' && seg.content === 'This is a static instruction.'
      );
      expect(mergedSegment).toBeDefined();
      expect(mergedSegment).toMatchObject({
          type: 'STATIC_MEMORY',
          content: 'This is a static instruction.'
      });
    });
  });