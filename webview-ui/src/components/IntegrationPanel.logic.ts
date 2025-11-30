/**
 * @file webview-ui/src/components/IntegrationPanel.logic.ts
 * @stamp 2025-11-30T08:40:00.000Z
 * @architectural-role Business Logic
 * @description Headless logic for the IntegrationPanel component. Isolates event dispatching for all final disposition actions from the Svelte UI.
 * @core-principles
 * 1. IS the single source of truth for the IntegrationPanel's behavior.
 * 2. OWNS the logic for creating and dispatching all `FinalDecisionMessage` payloads.
 * 3. MUST be pure TypeScript with no dependencies on Svelte or the DOM.
 *
 * @api-declaration
 *   - export function handleAccept(dispatch: Dispatcher, sessionId: string): void
 *   - export function handleReject(dispatch: Dispatcher, sessionId: string): void
 *   - export function handleHold(dispatch: Dispatcher, sessionId: string): void
 *   - export function handleOpenTerminal(dispatch: Dispatcher, sessionId: string): void
 *
 * @contract
 *   assertions:
 *     purity: pure          # Wrapper around dispatch.
 *     external_io: none     # Delegates I/O via dispatcher.
 *     state_ownership: none # Stateless.
 */

import type { FinalDecisionMessage } from '../../../packages/client/src/shared/types';

// Generic dispatcher type for flexibility in tests
type Dispatcher = (event: FinalDecisionMessage['command'], payload: { sessionId: string }) => void;

export function handleAccept(dispatch: Dispatcher, sessionId: string): void {
  dispatch('acceptAndMerge', { sessionId });
}

export function handleReject(dispatch: Dispatcher, sessionId: string): void {
  dispatch('rejectAndDiscard', { sessionId });
}

export function handleHold(dispatch: Dispatcher, sessionId: string): void {
  dispatch('finishAndHold', { sessionId });
}

export function handleOpenTerminal(dispatch: Dispatcher, sessionId: string): void {
  dispatch('openTerminalInWorktree', { sessionId });
}