/**
 * @file packages/client/src/lib/workflow/ActionHandler.ts
 * @stamp S-20251102T153500Z-C-REFACTORED-COMPLIANT
 * @architectural-role Utility
 * @description Contains the pure, stateless logic for executing the atomic actions (`JUMP`, `CALL`, `RETURN`) of the workflow engine's Domain Specific Language (DSL).
 * @core-principles
 * 1. IS a pure function module; it contains no state of its own.
 * 2. OWNS the parsing and execution logic for the action DSL string.
 * 3. MUST NOT contain any business logic beyond state transitions.
 *
 * @api-declaration
 *   - export interface ActionParams
 *   - export interface ActionResult
 *   - export function executeAction(params: ActionParams): ActionResult
 *
 * @contract
 *   assertions:
 *     - purity: "pure"          # This module contains only pure functions.
 *     - external_io: "none"     # It performs no network or file system I/O.
 *     - state_ownership: "none" # It is stateless.
 */

import { logger } from '../logging/logger';

/**
 * The arguments required to execute a state transition action.
 */
export interface ActionParams {
  /** The action string from the manifest, e.g., 'JUMP:TargetId'. */
  action: string;
  /** The current return stack from the Orchestrator. */
  currentStack: string[];
  /** The calculated return address for a CALL action. */
  returnAddress?: string;
}

/**
 * The result of an action execution, representing the new state.
 */
export interface ActionResult {
  /** The ID of the next Block to be executed. */
  nextBlockId: string | null;
  /** The updated return stack. */
  nextStack: string[];
}

/**
 * Parses and executes a single action string from the workflow manifest.
 * @param params The parameters for the action execution.
 * @returns The resulting state after the action is applied.
 */
export function executeAction(params: ActionParams): ActionResult {
  const { action, currentStack, returnAddress } = params;
  const [command, targetId] = action.split(':');

  switch (command) {
    case 'JUMP':
      if (!targetId) {
        throw new Error(`Invalid JUMP action: Missing TargetId in "${action}".`);
      }
      logger.debug(`Executing JUMP to: ${targetId}`);
      return { nextBlockId: targetId.trim(), nextStack: currentStack };

    case 'CALL':
      if (!targetId) {
        throw new Error(`Invalid CALL action: Missing TargetId in "${action}".`);
      }
      if (!returnAddress) {
        throw new Error('Invalid CALL invocation: A returnAddress must be provided.');
      }
      logger.debug(`Executing CALL to: ${targetId}, pushing return address: ${returnAddress}`);
      return {
        nextBlockId: targetId.trim(),
        nextStack: [...currentStack, returnAddress],
      };

    case 'RETURN': { // CORRECTED: Added block scope to the case.
      if (currentStack.length === 0) {
        logger.warn('RETURN action executed on an empty stack. Workflow will terminate.');
        return { nextBlockId: null, nextStack: [] };
      }
      const nextBlockId = currentStack[currentStack.length - 1];
      const nextStack = currentStack.slice(0, -1);
      logger.debug(`Executing RETURN to: ${nextBlockId}`);
      return { nextBlockId, nextStack };
    }

    default:
      throw new Error(`Unknown workflow action command: "${command}"`);
  }
}