/**
 * @file packages/client/src/lib/workflow/OrchestratorState.spec.ts
 * @stamp 2025-11-30T15:00:00.000Z
 * @test-target packages/client/src/lib/workflow/OrchestratorState.ts
 * @description
 * Unit tests for the state projection logic. Verifies that the internal
 * runtime state is correctly mapped to the public WorkflowViewState.
 * @criticality CRITICAL (UI correctness)
 * @testing-layer Unit
 */

import { describe, it, expect } from 'vitest';
import { deriveViewState } from './OrchestratorState';
import type { WorkflowManifest } from '../../shared/types';

const MOCK_MANIFEST: WorkflowManifest = {
  NodeA: {
    entry_block: 'NodeA__Block1',
    context_inheritance: true,
    static_memory: {},
    blocks: {
      Block1: { worker: 'W1', payload_merge_strategy: [], transitions: [] },
      Block2: { worker: 'W2', payload_merge_strategy: [], transitions: [] },
    }
  }
};

describe('deriveViewState', () => {
  it('should generate a correct graph structure from the manifest', () => {
    const state = deriveViewState(MOCK_MANIFEST, 'NodeA__Block1', 'NodeA', new Set(), {}, null);
    
    expect(state.graph.nodeId).toBe('NodeA');
    expect(Object.keys(state.graph.blocks)).toEqual(['NodeA__Block1', 'NodeA__Block2']);
  });

  it('should correctly map statuses based on current and completed blocks', () => {
    const completed = new Set(['NodeA__Block1']);
    const current = 'NodeA__Block2';
    
    const state = deriveViewState(MOCK_MANIFEST, current, 'NodeA', completed, {}, null);
    
    expect(state.statuses['NodeA__Block1']).toBe('complete');
    expect(state.statuses['NodeA__Block2']).toBe('active');
  });

  it('should default unknown blocks to pending', () => {
    const state = deriveViewState(MOCK_MANIFEST, 'NodeA__Block1', 'NodeA', new Set(), {}, null);
    expect(state.statuses['NodeA__Block2']).toBe('pending');
  });
});