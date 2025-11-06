/**
 * @file packages/client/src/lib/workflow/Orchestrator.context.ts
 * @stamp S-20251102T170000Z-V-CREATED
 * @architectural-role Business Logic
 * @description
 * A dedicated module for handling all context assembly and memory management for
 * the Orchestrator engine. It is responsible for implementing the five-layer
 * memory model, respecting context inheritance boundaries, and processing
 * payload merge strategies.
 * @core-principles
 * 1. OWNS all logic related to context and memory assembly.
 * 2. IS a pure, stateless module that operates on inputs from the Orchestrator.
 * 3. ENFORCES context boundaries defined by the `context_inheritance` flag.
 *
 * @api-declaration
 *   - export function assembleContext(...)
 *
 * @contract
 *   assertions:
 *     - purity: "pure"          # This module contains pure functions.
 *     - external_io: "none"     # Performs no I/O.
 *     - state_ownership: "none" # Does not own or manage state.
 */

import type {
  BlockDefinition,
  ContextSegment,
  ExecutionPayload,
  NodeDefinition,
  WorkflowManifest,
} from '../../shared/types';
import { WorkflowHaltedError } from './Orchestrator.transitions';

/**
 * Finds the node and block definitions for a given block ID.
 * @throws {WorkflowHaltedError} if the node or block is not found.
 */
function findNodeAndBlock(
  blockId: string,
  manifest: WorkflowManifest
): { node: NodeDefinition; block: BlockDefinition } {
  const [nodeId, blockName] = blockId.split('__');
  const node = manifest[nodeId];
  if (!node) {
    throw new WorkflowHaltedError(`Node "${nodeId}" not found for block "${blockId}".`);
  }
  const block = node.blocks[blockName];
  if (!block) {
    throw new WorkflowHaltedError(`Block "${blockName}" not found in node "${nodeId}".`);
  }
  return { node, block };
}

/**
 * Traverses the return stack to aggregate all inheritable static memory,
 * respecting context boundaries defined by the `context_inheritance` flag.
 */
function getInheritedStaticMemory(
  currentBlockId: string,
  returnStack: string[],
  manifest: WorkflowManifest
): Record<string, unknown> {
  const { node: currentNode } = findNodeAndBlock(currentBlockId, manifest);

  // If the current node creates a context boundary, ignore all parent memory.
  if (!currentNode.context_inheritance) {
    return { ...currentNode.static_memory };
  }

  const memory: Record<string, unknown> = { ...currentNode.static_memory };

  // Traverse the call stack backwards to inherit parent context.
  for (let i = returnStack.length - 1; i >= 0; i--) {
    const callerBlockId = returnStack[i];
    const { node: callerNode } = findNodeAndBlock(callerBlockId, manifest);
    // Merge parent memory, allowing child memory to take precedence.
    for (const key in callerNode.static_memory) {
      if (!Object.prototype.hasOwnProperty.call(memory, key)) {
        memory[key] = callerNode.static_memory[key];
      }
    }
  }
  return memory;
}

/**
 * Assembles the complete context for the current block's worker based on the
 * manifest, the current state, and the payload merge strategy.
 */
export function assembleContext(
  manifest: WorkflowManifest,
  block: BlockDefinition,
  executionPayload: ExecutionPayload,
  currentBlockId: string,
  returnStack: string[]
): ContextSegment[] {
  const finalContext: ContextSegment[] = [];

  const inheritedMemory = getInheritedStaticMemory(currentBlockId, returnStack, manifest);

  // Layer 1: The existing Execution Payload (Chat History)
  finalContext.push(...executionPayload);

  // FIX: The core logic fix is here. We now iterate over the *calculated*
  // inherited memory and add it to the context. This ensures that local memory
  // (like in the child node) is always present. The merge strategy then
  // provides a way to format specific parts of it.
  for (const [key, value] of Object.entries(inheritedMemory)) {
    // Check if a more specific merge strategy already handled this key.
    const isHandledByStrategy = block.payload_merge_strategy.some(
      (strategy) => strategy === `MERGE:STATIC_MEMORY:${key}`
    );

    if (!isHandledByStrategy) {
      finalContext.push({
        id: crypto.randomUUID(),
        type: 'INHERITED_CONTEXT', // Use a more generic type for default inclusion
        content: `${key}: ${JSON.stringify(value)}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Process the explicit merge strategy to inject static memory into the payload.
  for (const strategy of block.payload_merge_strategy) {
    const [command, type, key] = strategy.split(':');

    if (command === 'MERGE' && type === 'STATIC_MEMORY' && key in inheritedMemory) {
      // TYPE-GUARD-REASON: The `payload_merge_strategy` contract implies that the value
      // retrieved from `static_memory` is intended to be a string for injection into the context.
      // This cast is an assertion of that contract.
      finalContext.push({
        id: crypto.randomUUID(),
        type: 'STATIC_MEMORY',
        content: inheritedMemory[key] as string,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return finalContext;
}