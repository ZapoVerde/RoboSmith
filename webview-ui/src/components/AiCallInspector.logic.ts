/**
 * @file webview-ui/src/components/AiCallInspector.logic.ts
 * @stamp 2025-11-30T20:20:00.000Z
 * @architectural-role Business Logic
 * @description Headless logic for the AiCallInspector component.
 * @core-principles
 * 1. IS the single source of truth for the Inspector's interactive behavior.
 * 2. VALIDATES inputs before dispatching to the backend.
 *
 * @api-declaration
 *   - export type Dispatcher
 *   - export function handleRerun(dispatch: Dispatcher, modifiedRequest: AiCallLog['request']): void
 */

import type { AiCallLog } from '../../../packages/client/src/shared/types';

// Exported for testing to ensure type compatibility
export type Dispatcher = (event: 'rerunCall', payload: { modifiedRequest: AiCallLog['request'] }) => void;

/**
 * Handles the user clicking the "Re-run & Compare" button.
 * Validates that the request is semantically valid before dispatching.
 */
export function handleRerun(
  dispatch: Dispatcher,
  modifiedRequest: AiCallLog['request']
): void {
  // 1. Validate Prompt
  if (!modifiedRequest.prompt || modifiedRequest.prompt.trim().length === 0) {
    return;
  }

  // 2. Validate Model
  if (!modifiedRequest.model || modifiedRequest.model.trim().length === 0) {
    return;
  }

  // 3. Dispatch
  dispatch('rerunCall', { modifiedRequest });
}