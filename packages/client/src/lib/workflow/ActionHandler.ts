/**
 * @file packages/client/src/lib/workflow/ActionHandler.ts
 * @stamp S-20251102T153500Z-C-REFACTORED-COMPLIANT
 * @architectural-role Utility
 * @description Contains the pure, stateless logic for executing the atomic actions (`JUMP`, `CALL`, 'RETURN') of the workflow engine's Domain Specific Language (DSL).
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
  const { action, currentStack } = params;

  // DEFINITIVE FIX: This parsing is now robust. It correctly separates the
  // command from the full payload, regardless of colons in the payload.
  const separatorIndex = action.indexOf(':');
  const command = separatorIndex === -1 ? action : action.substring(0, separatorIndex);
  const payload = separatorIndex === -1 ? '' : action.substring(separatorIndex + 1);

  switch (command) {
    case 'JUMP': {
      if (!payload || !payload.trim()) {
        throw new Error(`Invalid JUMP action: Missing TargetId in "${action}".`);
      }
      const trimmedTargetId = payload.trim();
      logger.debug(`Executing JUMP to: ${trimmedTargetId}`);
      return { nextBlockId: trimmedTargetId, nextStack: currentStack };
    }

    case 'CALL': {
      const [targetId, returnAddress] = payload.split(':');
      if (!targetId || !targetId.trim()) {
        throw new Error(`Invalid CALL action: Missing TargetId in "${action}".`);
      }
      if (!returnAddress || !returnAddress.trim()) {
        throw new Error(`Invalid CALL action: Missing ReturnAddress in "${action}".`);
      }
      const trimmedCallTarget = targetId.trim();
      const trimmedReturnAddress = returnAddress.trim();
      logger.debug(`Executing CALL to: ${trimmedCallTarget}, pushing return address: ${trimmedReturnAddress}`);
      return {
        nextBlockId: trimmedCallTarget,
        nextStack: [...currentStack, trimmedReturnAddress],
      };
    }

    case 'RETURN': {
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