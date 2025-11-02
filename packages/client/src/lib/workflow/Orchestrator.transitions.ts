/**
 * @file packages/client/src/lib/workflow/Orchestrator.transitions.ts
 * @stamp S-20251102-T190000Z-V-FINAL
 * @architectural-role Orchestrator
 * @description
 * The deterministic, graph-based execution engine for the RoboSmith project. This
 * file contains the core state machine logic for managing transitions between blocks
 * (JUMP, CALL, RETURN). It delegates all context assembly to the
 * `Orchestrator.context.ts` module.
 * @core-principles
 * 1. IS a deterministic state machine, not a speculative agent.
 * 2. OWNS the execution loop and runtime state (Payload, Return Stack).
 * 3. DELEGATES all context assembly to the `assembleContext` function.
 * 4. ENFORCES architectural purity via stateless Blocks and explicit control flow.
 */

import { assembleContext } from './Orchestrator.context';
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

  constructor(
    private readonly manifest: WorkflowManifest,
    private readonly contextService: ContextPartitionerService,
    private readonly apiManager: ApiPoolManager,
    private readonly onStateUpdate: (state: PlanningState) => void
  ) {}

  public async executeNode(startNodeId: string): Promise<void> {
    const startNode = this.manifest[startNodeId];
    if (!startNode) {
      throw new WorkflowHaltedError(`Start node "${startNodeId}" not found in manifest.`);
    }
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

      const workOrder: WorkOrder = { worker: block.worker, context };
      const result: WorkerResult = await this.apiManager.execute(workOrder);
      this.executionPayload = result.newPayload;

      // FIX: Implement the correct two-step fallback logic.
      let transition = block.transitions.find((t) => t.on_signal === result.signal);

      // Step 1: Look for a direct signal match.
      if (!transition) {
        // Step 2: If no direct match, look for the default fallback.
        transition = block.transitions.find((t) => t.on_signal === 'SIGNAL:FAIL_DEFAULT');
      }

      // If a transition (either direct or fallback) was found, execute it.
      if (transition) {
        this.handleAction(transition.action);
      } else {
        // If neither was found, this is a terminal block for this signal. End gracefully.
        logger.debug(`No transition for signal "${result.signal}" and no default. Terminating.`);
        this.currentBlockId = null;
      }
    }
    logger.info('Workflow execution finished.');
    this.publishState();
  }

  private handleAction(action: string): void {
    // FIX: Correctly parse actions with and without targets (like 'RETURN').
    const separatorIndex = action.indexOf(':');
    let command: string;
    let target: string | undefined;

    if (separatorIndex === -1) {
      command = action;
      target = undefined;
    } else {
      command = action.substring(0, separatorIndex);
      target = action.substring(separatorIndex + 1);
    }

    switch (command) {
      case 'JUMP':
        if (target) {
          logger.debug(`Jumping to block: ${target}`);
          this.currentBlockId = target;
        } else {
          throw new WorkflowHaltedError(`JUMP action is missing a target.`);
        }
        break;

        case 'CALL': {
          if (!target) {
            throw new WorkflowHaltedError(`CALL action is missing a target node.`);
          }
  
          logger.debug(`Calling node: ${target}`);
          const targetNode = this.manifest[target];
          if (!targetNode) {
            throw new WorkflowHaltedError(`Target node "${target}" for CALL action not found.`);
          }
          this.returnStack.push('Node:Parent__Block:AfterReturn');
          this.currentBlockId = targetNode.entry_block;
          break;
        }

      case 'RETURN': {
        logger.debug('Returning from node call.');
        const returnAddress = this.returnStack.pop();
        if (!returnAddress) {
          throw new WorkflowHaltedError('Attempted to RETURN from an empty call stack.');
        }
        this.currentBlockId = returnAddress;
        break;
      }

      default:
        this.isHalted = true;
        throw new WorkflowHaltedError(`Unknown action command: "${command}"`);
    }
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
      currentBlockId: this.currentBlockId || '',
      executionPayload: this.executionPayload,
      isHalted: this.isHalted,
      errorMessage: null,
    };
    this.onStateUpdate(state);
  }
}