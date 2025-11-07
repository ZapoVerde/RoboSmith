/**
 * @file packages/client/src/lib/workflow/Orchestrator.ts
 * @stamp S-20251107T130000Z-C-REFACTOR-FINALIZE
 * @architectural-role Orchestrator
 * @description The deterministic, stateful, graph-based execution engine for all workflows. It is the central class that manages the execution loop, runtime state, and delegation to I/O services.
 * @core-principles
 * 1. IS a deterministic state machine, not a speculative agent.
 * 2. OWNS the execution loop and runtime state (Execution Payload, Return Stack, Current Block).
 * 3. DELEGATES all AI calls, context slicing, and action parsing to injected services and helpers.
 *
 * @api-declaration
 *   - export class WorkflowHaltedError extends Error
 *   - export class Orchestrator
 *   -   public constructor(manifest, contextService, apiManager, onStateUpdate)
 *   -   public async executeNode(startNodeId: string, worktreePath: string): Promise<void>
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # Owns and mutates its internal runtime state.
 *     - external_io: "https_apis" # Delegates to ApiPoolManager which performs external I/O.
 *     - state_ownership: "['currentBlockId', 'executionPayload', 'returnStack']"
 */

import { assembleContext } from './Orchestrator.context';
import { executeAction } from './ActionHandler';
import type {
  BlockDefinition,
  ExecutionPayload,
  NodeDefinition,
  PlanningState,
  WorkflowManifest,
} from '../../shared/types';
import type { ApiPoolManager, WorkOrder, WorkerResult } from '../ai/ApiPoolManager';
import type { ContextPartitionerService } from '../context/ContextPartitionerService';
import { logger } from '../logging/logger';

export class WorkflowHaltedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowHaltedError';
  }
}

export class Orchestrator {
  private currentBlockId: string | null = null;
  private executionPayload: ExecutionPayload = [];
  private returnStack: string[] = [];
  private isHalted = false;
  private worktreePath: string = '';

  constructor(
    private readonly manifest: WorkflowManifest,
    private readonly contextService: ContextPartitionerService,
    private readonly apiManager: ApiPoolManager,
    private readonly onStateUpdate: (state: PlanningState) => void
  ) {}

  public async executeNode(startNodeId: string, worktreePath: string): Promise<void> {
    const startNode = this.manifest[startNodeId];
    if (!startNode) {
      throw new WorkflowHaltedError(`Start node "${startNodeId}" not found in manifest.`);
    }
    this.worktreePath = worktreePath;
    this.currentBlockId = startNode.entry_block;
    await this.run();
  }

  private async run(): Promise<void> {
    while (this.currentBlockId && !this.isHalted) {
      const { block } = this.findNodeAndBlock(this.currentBlockId);
      logger.debug(`Executing block: ${this.currentBlockId}`);
      this.publishState();

      const context = assembleContext(
        this.manifest,
        block,
        this.executionPayload,
        this.currentBlockId,
        this.returnStack
      );

      const workOrder: WorkOrder = {
        worker: block.worker,
        context,
        worktreePath: this.worktreePath,
      };
      const result: WorkerResult = await this.apiManager.execute(workOrder);
      this.executionPayload = result.newPayload;

      let transition = block.transitions.find((t) => t.on_signal === result.signal);

      if (!transition) {
        transition = block.transitions.find((t) => t.on_signal === 'SIGNAL:FAIL_DEFAULT');
      }

      if (transition) {
        this.handleAction(transition.action);
      } else {
        logger.debug(`No transition for signal "${result.signal}" and no default. Terminating.`);
        this.currentBlockId = null;
      }
    }
    logger.info('Workflow execution finished.');
    this.publishState();
  }

  private handleAction(action: string): void {
    const result = executeAction({
      action,
      currentStack: this.returnStack,
    });

    // FIX: This is the critical logic correction.
    // If the next ID from the action handler does not contain '__', it's a Node ID from a CALL.
    // We must look up that node's entry_block to get the correct next Block ID.
    if (result.nextBlockId && !result.nextBlockId.includes('__')) {
      const targetNodeId = result.nextBlockId;
      const targetNode = this.manifest[targetNodeId];
      if (!targetNode) {
        throw new WorkflowHaltedError(`Target node "${targetNodeId}" for CALL action not found.`);
      }
      this.currentBlockId = targetNode.entry_block;
    } else {
      this.currentBlockId = result.nextBlockId;
    }

    this.returnStack = result.nextStack;
  }

  private findNodeAndBlock(blockId: string): { node: NodeDefinition; block: BlockDefinition } {
    const [nodeId, blockName] = blockId.split('__');
    if (!nodeId || !blockName) {
      throw new WorkflowHaltedError(`Invalid blockId format: "${blockId}". Must be "NodeId__BlockName".`);
    }
    const node = this.manifest[nodeId];
    if (!node) {
      throw new WorkflowHaltedError(`Node "${nodeId}" not found for block "${blockId}".`);
    }
    const block = node.blocks[blockName];
    if (!block) {
      throw new WorkflowHaltedError(`Block "${blockName}" not found in node "${nodeId}".`);
    }
    return { node, block };
  }

  private publishState(): void {
    const nodeId = this.currentBlockId ? this.currentBlockId.split('__')[0] : '';
    const state: PlanningState = {
      currentNodeId: nodeId,
      currentBlockId: this.currentBlockId, 
      executionPayload: this.executionPayload,
      isHalted: this.isHalted,
      errorMessage: null,
    };
    this.onStateUpdate(state);
  }
}