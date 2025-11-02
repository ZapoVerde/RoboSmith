/**
 * @file packages/client/src/lib/workflow/Orchestrator.ts
 * @stamp S-20251102-T124500Z-C-FINAL-ENGINE
 * @architectural-role Orchestrator
 * @description The definitive, manifest-driven workflow engine. It translates the declarative `workflows.json` into a series of state transitions, acting as the deterministic core of the RoboSmith "Factory."
 * @core-principles
 * 1. IS a deterministic state machine, not a speculative agent.
 * 2. OWNS the primary execution loop: Assemble Context -> Execute Block -> Lookup Transition -> Execute Action.
 * 3. MUST faithfully execute the manifest's control flow.
 * 4. DELEGATES all I/O and AI calls to specialized services.
 */

import type { ApiPoolManager, WorkOrder } from '../ai/ApiPoolManager';
import type { ContextPartitionerService } from '../context/ContextPartitionerService';
import type { PlanningState, WorkflowManifest, ExecutionPayload, BlockDefinition, NodeDefinition } from '../../shared/types';
import { logger } from '../logging/logger';

export class WorkflowHaltedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowHaltedError';
  }
}

export class Orchestrator {
  private manifest: WorkflowManifest;
  private contextService: ContextPartitionerService;
  private apiManager: ApiPoolManager;
  private onStateUpdate: (state: PlanningState) => void;

  // Runtime state
  private currentNodeId: string | null = null;
  private currentBlockId: string | null = null;
  private executionPayload: ExecutionPayload = [];

  constructor(
    manifest: WorkflowManifest,
    contextService: ContextPartitionerService,
    apiManager: ApiPoolManager,
    onStateUpdate: (state: PlanningState) => void
  ) {
    this.manifest = manifest;
    this.contextService = contextService;
    this.apiManager = apiManager;
    this.onStateUpdate = onStateUpdate;
  }

  public async executeNode(nodeId: string): Promise<void> {
    const startNode = this.manifest[nodeId];
    if (!startNode) {
      throw new Error(`Start node "${nodeId}" not found in the manifest.`);
    }

    this.currentNodeId = nodeId;
    this.currentBlockId = startNode.entry_block;
    this.executionPayload = [];

    logger.info('Orchestrator execution started.', { nodeId });

    while (this.currentBlockId) {
      this.currentBlockId = await this.executeBlock(this.currentBlockId);
    }

    logger.info('Orchestrator execution finished.', { nodeId });
  }

  private async executeBlock(blockId: string): Promise<string | null> {
    const { blockDef } = this.getBlockAndNodeDefs(blockId);
    logger.debug(`Executing block: ${blockId}`);

    // --- 1. Assemble Context (Placeholder) ---
    const assembledContext = this.executionPayload;

    // --- 2. Execute Worker (Full Implementation) ---
    const workOrder: WorkOrder = {
      worker: blockDef.worker, // Correct property name is 'worker'
      context: assembledContext,
  };
    const workerOutput = await this.apiManager.execute(workOrder);
    this.executionPayload = workerOutput.newPayload;

    // --- 3. Lookup Transition ---
    const signal = workerOutput.signal;
    const transition = blockDef.transitions.find(t => t.on_signal === signal);

    if (!transition) {
      logger.debug(`No transition for signal "${signal}". Terminating.`);
      return null;
    }

    // --- 4. Execute Action ---
    const separatorIndex = transition.action.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error(`Invalid action format: ${transition.action}`);
    }
    const actionType = transition.action.slice(0, separatorIndex);
    const targetId = transition.action.slice(separatorIndex + 1);

    switch (actionType) {
      case 'JUMP':
        logger.debug(`Jumping to block: ${targetId}`);
        return targetId;
      
      default:
        throw new Error(`Unknown action type "${actionType}"`);
    }
  }

  private getBlockAndNodeDefs(blockId: string): { blockDef: BlockDefinition; nodeDef: NodeDefinition } {
    const [nodeId, blockName] = blockId.split('__');
    if (!nodeId || !blockName) {
      throw new Error(`Fatal: Invalid Block ID format: ${blockId}`);
    }

    const nodeDef = this.manifest[nodeId];
    if (!nodeDef) {
      throw new Error(`Fatal: Could not find node definition for ID: ${nodeId}`);
    }

    const blockDef = nodeDef.blocks[blockName];
    if (!blockDef) {
      throw new Error(`Fatal: Could not find block definition for ID: ${blockId}`);
    }
    
    this.currentNodeId = nodeId;
    return { blockDef, nodeDef };
  }
}