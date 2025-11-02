/**
 * @file packages/client/src/shared/types.ts
 * @stamp S-20251101-T201500Z-C-EXPANDED
 * @architectural-role Type Definition
 * @description
 * Defines the complete, bidirectional message contract for the asynchronous event
 * bus. It is the single source of truth for all type-safe communication between
 * the WebView (frontend) and the Extension Host (backend).
 * @core-principles
 * 1. IS the single source of truth for the client's event bus message contract.
 * 2. MUST contain only pure TypeScript type/interface definitions.
 * 3. DELEGATES the definition of core domain models like `ApiKey` to the `@shared` package.
 *
 * @api-declaration
 *   - export type Message (WebView -> Extension Host)
 *   - export type ExtensionMessage (Extension Host -> WebView)
 *   - export interface PlanningState
 *
 * @contract
 *   assertions:
 *     purity: pure          # This file contains only type definitions and no executable logic.
 *     external_io: none     # This file does not perform any I/O.
 *     state_ownership: none # This file does not own or manage any state.
 */

import type { ApiKey } from '@shared/domain/api-key';

// --- INCOMING MESSAGES (WebView -> Extension Host) ---

/**
 * A map of all possible commands sent from the UI to the backend, with their
 * corresponding payload types.
 */
type CommandPayloadMap = {
  // Existing API Key Management
  addApiKey: ApiKey;
  removeApiKey: { id: string };
  loadApiKeys: undefined;

  // NEW: Workflow Control
  startWorkflow: {
    nodeId: string;
  };
  userAction: {
    action: 'proceed' | 'revise' | 'abort';
    sessionId: string;
  };
};

/**
 * @id packages/client/src/shared/types.ts#Message
 * @description
 * The discriminated union type for all messages sent FROM the WebView TO the
 * Extension Host.
 */
export type Message = {
  [K in keyof CommandPayloadMap]: {
    command: K;
    payload: CommandPayloadMap[K];
  };
}[keyof CommandPayloadMap];


// --- OUTGOING MESSAGES (Extension Host -> WebView) ---

/**
 * @id packages/client/src/shared/types.ts#PlanningState
 * @description
 * Represents a complete snapshot of an executing workflow's state, designed to be
 * sent to the UI for real-time visualization.
 */
export interface PlanningState {
  /** The ID of the node currently being executed. */
  nodeId: string;
  /** The zero-based index of the step currently in progress. */
  currentStepIndex: number;
  /** An array representing the state of all steps in the current node. */
  steps: Array<{
    name: string;
    status: 'pending' | 'in_progress' | 'action_required' | 'complete';
  }>;
  /** The string output from the most recently completed step. */
  lastOutput: string | null;
  /** A flag indicating if the workflow is paused and waiting for user input. */
  isHalted: boolean;
  /** An error message if the workflow halted due to a failure. */
  errorMessage: string | null;
}

/**
 * @id packages/client/src/shared/types.ts#ExtensionMessage
 * @description
 * The discriminated union type for all messages sent FROM the Extension Host
 * TO the WebView.
 */
export type ExtensionMessage =
  | {
      command: 'planningStateUpdate';
      payload: PlanningState;
    }
  | {
      command: 'apiKeyListUpdate';
      payload: { apiKeys: ApiKey[] };
    };