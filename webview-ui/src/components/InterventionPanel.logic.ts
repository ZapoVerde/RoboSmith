/**
 * @file webview-ui/src/components/InterventionPanel.logic.ts
 * @stamp {"timestamp":"2025-11-09T02:10:00.000Z"}
 * @architectural-role Business Logic
 * @description Headless logic for the InterventionPanel component. It isolates the creation and dispatching of `InterventionMessage` payloads from the Svelte UI, making the core behavior independently testable.
 * @core-principles
 * 1. IS the single source of truth for the InterventionPanel's interactive behavior.
 * 2. OWNS the logic for creating event payloads for user interventions.
 * 3. MUST be pure TypeScript with no dependencies on Svelte or the DOM.
 *
 * @api-declaration
 *   - export function dispatchResumeWorkflow(sessionId: string, augmentedPrompt?: string): void
 *   - export function dispatchRetryBlock(sessionId: string, augmentedPrompt?: string): void
 *
 * @contract
 *   assertions:
 *     purity: "mutates"       # This file mutates external state by calling postMessage.
 *     external_io: "vscode"   # Interacts with the VS Code Webview API.
 *     state_ownership: "none" # Does not own any application state.
 */

import type { InterventionMessage } from '../../../packages/client/src/shared/types';

const vscode = acquireVsCodeApi();

/**
 * Dispatches a 'resumeWorkflow' message to the extension host.
 * @param sessionId The ID of the session to resume.
 * @param augmentedPrompt Optional user-provided guidance.
 */
export function dispatchResumeWorkflow(sessionId: string, augmentedPrompt?: string): void {
  const message: InterventionMessage = {
    command: 'resumeWorkflow',
    payload: {
      sessionId,
      augmentedPrompt,
    },
  };
  vscode.postMessage(message);
}

/**
 * Dispatches a 'retryBlock' message to the extension host.
 * @param sessionId The ID of the session whose block should be retried.
 * @param augmentedPrompt Optional user-provided guidance.
 */
export function dispatchRetryBlock(sessionId: string, augmentedPrompt?: string): void {
  const message: InterventionMessage = {
    command: 'retryBlock',
    payload: {
      sessionId,
      augmentedPrompt,
    },
  };
  vscode.postMessage(message);
}