/**
 * @file packages/client/src/lib/workflow/Orchestrator.ts
 * @stamp 2025-11-30T14:35:00.000Z
 * @architectural-role Orchestrator
 * @description The deterministic, stateful execution engine.
 *
 * @contract
 *   assertions:
 *     purity: mutates
 *     external_io: https_apis
 *     state_ownership: ['currentBlockId', 'executionPayload', 'returnStack', 'isHalted']
 */

import { assembleContext } from './Orchestrator.context';
import { executeAction } from './ActionHandler';
import { deriveViewState } from './OrchestratorState'; // <--- NEW IMPORT
import type {
  BlockDefinition,
  ExecutionPayload,
  NodeDefinition,
  WorkflowManifest,
  WorkflowViewState,
} from '../../shared/types';
import type { ApiPoolManager, WorkOrder, WorkerResult } from '../ai/ApiPoolManager';
import type { ContextPartitionerService } from '../context/ContextPartitionerService';
import { logger } from '../logging/logger';
import { v4 as uuidv4 } from 'uuid';

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
  
  // State for interactivity
  private isHalted = false;
  
  // State for context assembly
  private worktreePath: string = '';
  private lastNodeId: string = '';
  
  // State for UI visualization
  private completedBlocks: Set<string> = new Set();
  private lastTransition: WorkflowViewState['lastTransition'] = null;
  private executionLog: WorkflowViewState['executionLog'] = {};

  constructor(
    private readonly manifest: WorkflowManifest,
    private readonly contextService: ContextPartitionerService,
    private readonly apiManager: ApiPoolManager,
    private readonly onStateUpdate: (state: WorkflowViewState) => void,
    private readonly onCompletion: () => void,
    private readonly isManualApprovalMode: boolean = false
  ) {}

  public async executeNode(startNodeId: string, worktreePath: string): Promise<void> {
    const startNode = this.manifest[startNodeId];
    if (!startNode) {
      throw new WorkflowHaltedError(`Start node "${startNodeId}" not found in manifest.`);
    }
    this.worktreePath = worktreePath;
    this.currentBlockId = startNode.entry_block;
    
    if (this.isManualApprovalMode) {
      this.isHalted = true;
      this.publishState();
      logger.info('Orchestrator started in Stepper Mode. Halted before first block.');
      return;
    }

    await this.run();
  }

  public async resumeManually(augmentedPrompt?: string): Promise<void> {
    if (!this.isHalted || !this.currentBlockId) {
      logger.warn('Attempted to resume a workflow that is not halted.');
      return;
    }

    if (augmentedPrompt) {
      this.injectHumanGuidance(augmentedPrompt);
    }

    logger.info(`Resuming workflow at block: ${this.currentBlockId}`);
    this.isHalted = false;
    await this.run();
  }

  public async retryBlock(augmentedPrompt?: string): Promise<void> {
    if (!this.isHalted || !this.currentBlockId) {
      logger.warn('Attempted to retry a workflow that is not halted.');
      return;
    }

    if (augmentedPrompt) {
      this.injectHumanGuidance(augmentedPrompt);
    }

    logger.info(`Retrying block: ${this.currentBlockId}`);
    this.isHalted = false;
    await this.run();
  }

  private injectHumanGuidance(content: string): void {
    this.executionPayload.push({
      id: uuidv4(),
      type: 'HUMAN_GUIDANCE',
      content,
      timestamp: new Date().toISOString(),
    });
  }

  private async run(): Promise<void> {
    while (this.currentBlockId && !this.isHalted) {
      const previousBlockId = this.currentBlockId;
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
      this.executionLog[this.currentBlockId] = { context, conversation: [] };

      const workOrder: WorkOrder = {
        worker: block.worker,
        context,
        worktreePath: this.worktreePath,
      };
      
      let result: WorkerResult;
      try {
        result = await this.apiManager.execute(workOrder);
      } catch (error) {
        logger.error(`Worker execution failed for ${this.currentBlockId}`, { error });
        this.isHalted = true;
        this.publishState();
        return; 
      }

      this.executionLog[this.currentBlockId].conversation = result.newPayload.slice(context.length);
      this.executionPayload = result.newPayload;
      this.completedBlocks.add(this.currentBlockId);

      let transition = block.transitions.find((t) => t.on_signal === result.signal);
      if (!transition) {
        transition = block.transitions.find((t) => t.on_signal === 'SIGNAL:FAIL_DEFAULT');
      }

      if (transition) {
        const actionResult = executeAction({ action: transition.action, currentStack: this.returnStack });
        
        let toBlockId: string | null = actionResult.nextBlockId;
        if (toBlockId && !toBlockId.includes('__')) {
            const targetNode = this.manifest[toBlockId];
            toBlockId = targetNode ? targetNode.entry_block : null;
        }

        this.lastTransition = {
            fromBlock: previousBlockId,
            toBlock: toBlockId || '',
            signal: result.signal,
        };

        this.handleAction(transition.action);

        if (this.isManualApprovalMode && this.currentBlockId) {
          logger.info('Stepper Mode: Halting before next block.');
          this.isHalted = true;
          this.publishState();
          return;
        }

      } else {
        logger.debug(`No transition for signal "${result.signal}" and no default. Terminating.`);
        this.lastTransition = null;
        this.currentBlockId = null;
      }
    }

    this.publishState();
    
    if (!this.currentBlockId && !this.isHalted) {
        logger.info('Workflow execution finished.');
        this.onCompletion();
    }
  }

  private handleAction(action: string): void {
    const result = executeAction({
      action,
      currentStack: this.returnStack,
    });

    if (result.nextBlockId && !result.nextBlockId.includes('__')) {
      const targetNodeId = result.nextBlockId;
      const targetNode = this.manifest[targetNodeId];
      if (!targetNode) {
        throw new WorkflowHaltedError(`Target node "${targetNodeId}" for action not found.`);
      }
      this.currentBlockId = targetNode.entry_block;
    } else {
      this.currentBlockId = result.nextBlockId;
    }

    this.returnStack = result.nextStack;
  }

  private findNodeAndBlock(blockId: string): { node: NodeDefinition; block: BlockDefinition } {
    const [nodeId, blockName] = blockId.split('__');
    const node = this.manifest[nodeId];
    if (!node) throw new WorkflowHaltedError(`Node "${nodeId}" not found.`);
    const block = node.blocks[blockName];
    if (!block) throw new WorkflowHaltedError(`Block "${blockName}" not found in node "${nodeId}".`);
    return { node, block };
  }

  private publishState(): void {
    if (this.currentBlockId) {
        this.lastNodeId = this.currentBlockId.split('__')[0];
    }
    
    // DELEGATED LOGIC:
    const state = deriveViewState(
      this.manifest,
      this.currentBlockId,
      this.lastNodeId,
      this.completedBlocks,
      this.executionLog,
      this.lastTransition
    );
    
    this.onStateUpdate(state);
  }
}