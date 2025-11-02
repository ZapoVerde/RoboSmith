/**
 * @file packages/client/src/lib/workflow/Orchestrator.ts
 * @stamp S-20251101T211500Z-C-CALLBACK-INTEGRATED
 * @architectural-role Orchestrator
 * @description
 * The central, deterministic state machine for the RoboSmith Factory. It consumes
 * a valid `WorkflowManifest` and executes the defined nodes and steps with
 * perfect fidelity. It now includes a callback mechanism to provide real-time
 * state updates to its supervisor (the EventHandler).
 * @core-principles
 * 1. IS the central state machine for all automated workflows.
 * 2. OWNS the `NodeExecutionContext`, managing the in-memory "scratchpad" for each node.
 * 3. MUST execute the manifest's instructions without deviation.
 * 4. DELEGATES all I/O and provides state feedback via injected services and callbacks.
 *
 * @api-declaration
 *   - export class Orchestrator
 *   -   constructor(manifest, contextService, apiManager, onStateUpdate?)
 *   -   public async executeNode(nodeId: string): Promise<Record<string, string>>
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # Manages the state of the NodeExecutionContext.
 *     - external_io: "none"     # Delegates all I/O to injected services, making it easy to test.
 *     - state_ownership: "['NodeExecutionContext']" # Owns the runtime state of a node execution.
 */

import type { PlanningState } from '../../shared/types';
import type { WorkflowManifest, StepDefinition,  } from './WorkflowService';
import type { ContextPartitionerService } from '../context/ContextPartitionerService';
import type { ApiPoolManager, WorkOrder } from '../ai/ApiPoolManager';
import { logger } from '../logging/logger';

/**
 * The in-memory state managed by the Orchestrator for a single node's execution.
 */
interface NodeExecutionContext {
  memory: Record<string, string>;
  currentStepIndex: number;
}

/** Custom error thrown when a workflow is intentionally halted by a HALT_AND_FLAG action. */
export class WorkflowHaltedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowHaltedError';
  }
}

export class Orchestrator {
  private onStateUpdate?: (state: PlanningState) => void;

  constructor(
    private manifest: WorkflowManifest,
    private contextService: ContextPartitionerService,
    private apiManager: ApiPoolManager,
    onStateUpdate?: (state: PlanningState) => void
  ) {
    this.onStateUpdate = onStateUpdate;
  }

  public async executeNode(nodeId: string): Promise<Record<string, string>> {
    const nodeDef = this.manifest.nodes[nodeId];
    if (!nodeDef) {
      throw new Error(`Orchestrator error: Node with ID "${nodeId}" not found in manifest.`);
    }

    const context: NodeExecutionContext = {
      memory: {},
      currentStepIndex: 0,
    };

    while (context.currentStepIndex < nodeDef.steps.length) {
      // Report the state at the beginning of each step's execution.
      this.onStateUpdate?.(this.buildPlanningState(nodeId, nodeDef.steps, context));

      const step = nodeDef.steps[context.currentStepIndex];
      logger.info(`Executing step: "${step.name}" in node: "${nodeId}"`);

      const contextPackage = await this.contextService.getContext({
        filePath: './placeholder.ts',
        sliceName: step.contextSlice,
      });

      const renderedPrompt = this.renderPrompt(step.prompt, context.memory);
      const fullPrompt = `${renderedPrompt}\n\n---\nContext:\n${contextPackage}`;

      const workerDef = this.manifest.workers[step.worker];
      if (!workerDef) {
        throw new Error(`Orchestrator error: Worker "${step.worker}" not found in manifest.`);
      }

      const workOrder: WorkOrder = { provider: workerDef.provider, prompt: fullPrompt };
      const aiResponse = await this.apiManager.execute(workOrder);
      context.memory[step.name] = aiResponse;

      const validationPassed = this.validateResponse(aiResponse, step);
      const action = validationPassed ? step.actions.onSuccess : step.actions.onFailure;

      switch (action.type) {
        case 'PROCEED_TO_NEXT_STEP':
          context.currentStepIndex++;
          break;
        case 'HALT_AND_FLAG': {
          logger.error(`Workflow halted by action: ${action.message}`);
          this.onStateUpdate?.(
            this.buildPlanningState(nodeId, nodeDef.steps, context, true, action.message)
          );
          throw new WorkflowHaltedError(action.message);
        }
        case 'JUMP_TO_NODE':
          logger.info(`Jumping to node: ${action.nodeId}`);
          return this.executeNode(action.nodeId);
        default: {
          const exhaustiveCheck: never = action;
          throw new Error(`Orchestrator error: Unknown action type encountered: ${exhaustiveCheck}`);
        }
      }
    }

    logger.info(`Node "${nodeId}" completed successfully.`);
    // Report the final success state.
    this.onStateUpdate?.(this.buildPlanningState(nodeId, nodeDef.steps, context));
    return context.memory;
  }

  /**
   * Constructs a PlanningState snapshot based on the current execution context.
   */
  private buildPlanningState(
    nodeId: string,
    steps: StepDefinition[],
    context: NodeExecutionContext,
    isHalted = false,
    errorMessage: string | null = null
  ): PlanningState {
    const lastStepName =
      context.currentStepIndex > 0 ? steps[context.currentStepIndex - 1].name : null;
    const lastOutput = lastStepName ? context.memory[lastStepName] : null;

    return {
      nodeId,
      currentStepIndex: context.currentStepIndex,
      steps: steps.map((step, index) => {
        let status: PlanningState['steps'][0]['status'] = 'pending';
        if (index < context.currentStepIndex) {
          status = 'complete';
        } else if (index === context.currentStepIndex) {
          status = isHalted ? 'action_required' : 'in_progress';
        }
        return { name: step.name, status };
      }),
      lastOutput,
      isHalted,
      errorMessage,
    };
  }

  private renderPrompt(template: string, memory: Record<string, string>): string {
    return template.replace(/\$\{([^}]+)\}/g, (_match, key) => {
      return memory[key] ?? '';
    });
  }

  private validateResponse(response: string, step: StepDefinition): boolean {
    const rule = step.validation;
    switch (rule.type) {
      case 'keywordSignal':
        return response.toLowerCase().includes(rule.signal.toLowerCase());
      default: {
        logger.error(`Invalid validation rule type: '${rule.type}' in step '${step.name}'`);
        return false;
      }
    }
  }
}