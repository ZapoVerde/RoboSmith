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
 *   -   public constructor(manifest: WorkflowManifest, contextService: ContextPartitionerService, apiManager: ApiPoolManager, onStateUpdate: (state: WorkflowViewState) => void, onCompletion: () => void)
 *   -   public async executeNode(startNodeId: string, worktreePath: string): Promise<void>
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # Owns and mutates its internal runtime state.
 *     - external_io: "https-apis" # Delegates to ApiPoolManager which performs external I/O.
 *     - state_ownership: "['currentBlockId', 'executionPayload', 'returnStack']"
 */

import { assembleContext } from './Orchestrator.context';
import { executeAction } from './ActionHandler';
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
  private lastNodeId: string = '';
  // New properties for rich UI state
  private completedBlocks: Set<string> = new Set();
  private lastTransition: WorkflowViewState['lastTransition'] = null;
  private executionLog: WorkflowViewState['executionLog'] = {};

  constructor(
    private readonly manifest: WorkflowManifest,
    private readonly contextService: ContextPartitionerService,
    private readonly apiManager: ApiPoolManager,
    private readonly onStateUpdate: (state: WorkflowViewState) => void,
    private readonly onCompletion: () => void
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
      const result: WorkerResult = await this.apiManager.execute(workOrder);

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
      } else {
        logger.debug(`No transition for signal "${result.signal}" and no default. Terminating.`);
        this.lastTransition = null;
        this.currentBlockId = null;
      }
    }
    logger.info('Workflow execution finished.');
    this.publishState();
    this.onCompletion();
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
    if (this.currentBlockId) {
        this.lastNodeId = this.currentBlockId.split('__')[0];
    }
    const nodeId = this.currentBlockId ? this.currentBlockId.split('__')[0] : this.lastNodeId;

    const node = this.manifest[nodeId];

    const statuses: WorkflowViewState['statuses'] = {};
    const graph: WorkflowViewState['graph'] = {
        nodeId: nodeId,
        blocks: {},
        transitions: [],
    };

    if (node) {
        graph.blocks = Object.fromEntries(Object.keys(node.blocks).map(name => [`${nodeId}__${name}`, { name }]));
        // Placeholder for transitions as per directive
        for (const blockId in graph.blocks) {
            if (blockId === this.currentBlockId) {
                statuses[blockId] = 'active';
            } else if (this.completedBlocks.has(blockId)) {
                statuses[blockId] = 'complete';
            } else {
                statuses[blockId] = 'pending';
            }
        }
    }

    const state: WorkflowViewState = {
      graph,
      statuses,
      lastTransition: this.lastTransition,
      executionLog: this.executionLog,
      allWorkflowsStatus: [], // Placeholder as per directive
    };
    this.onStateUpdate(state);
  }
}