/**
 * @file packages/client/src/lib/workflow/OrchestratorState.ts
 * @stamp 2025-11-30T14:30:00.000Z
 * @architectural-role Utility
 * @description A pure function module responsible for projecting the internal
 * runtime state of the Orchestrator into the public `WorkflowViewState`
 * consumed by the UI.
 * @core-principles
 * 1. IS a pure transformation layer.
 * 2. OWNS the logic for graph generation and status mapping.
 * 3. MUST NOT contain any side effects or execution logic.
 *
 * @api-declaration
 *   - export function deriveViewState(...): WorkflowViewState
 */

import type {
    WorkflowManifest,
    WorkflowViewState,
    ContextSegment,
  } from '../../shared/types';
  
  export function deriveViewState(
    manifest: WorkflowManifest,
    currentBlockId: string | null,
    lastNodeId: string,
    completedBlocks: Set<string>,
    executionLog: Record<string, { context: ContextSegment[]; conversation: ContextSegment[] }>,
    lastTransition: WorkflowViewState['lastTransition']
  ): WorkflowViewState {
    // 1. Determine the active Node scope
    // If we are between blocks (currentBlockId is null), use the last known node
    const activeNodeId = currentBlockId ? currentBlockId.split('__')[0] : lastNodeId;
    const nodeDef = manifest[activeNodeId];
  
    // 2. Initialize the View Structure
    const statuses: WorkflowViewState['statuses'] = {};
    const graph: WorkflowViewState['graph'] = {
      nodeId: activeNodeId || 'root',
      blocks: {},
      transitions: [],
    };
  
    // 3. Build Graph & Statuses
    if (nodeDef) {
      // Generate static graph nodes
      graph.blocks = Object.fromEntries(
        Object.keys(nodeDef.blocks).map((name) => [
          `${activeNodeId}__${name}`,
          { name },
        ])
      );
  
      // Calculate dynamic status for each block
      for (const blockId in graph.blocks) {
        if (blockId === currentBlockId) {
          statuses[blockId] = 'active';
        } else if (completedBlocks.has(blockId)) {
          statuses[blockId] = 'complete';
        } else {
          statuses[blockId] = 'pending';
        }
      }
    }
  
    // 4. Return Immutable State Object
    return {
      graph,
      statuses,
      lastTransition,
      executionLog,
      allWorkflowsStatus: [], // Placeholder for future multi-tab support
    };
  }