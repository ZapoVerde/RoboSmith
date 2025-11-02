/**
 * @file packages/client/src/shared/types.ts
 * @stamp S-20251102T031500Z-C-REFACTORED
 * @architectural-role Type Definition
 * @description
 * Defines the complete, bidirectional message contract for the asynchronous event
 * bus and the core data contracts for the Block/Node Workflow Engine. It is the
 * single source of truth for all type-safe communication and workflow manifest
 * structures.
 * @core-principles
 * 1. IS the single source of truth for the client's event bus and workflow contracts.
 * 2. MUST contain only pure TypeScript type/interface definitions.
 * 3. ENFORCES the final, hardened architectural model of Nodes, Blocks, and Payloads.
 *
 * @api-declaration
 *   - Type Aliases for Event Bus: `Message`, `ExtensionMessage`
 *   - Interfaces for Workflow Engine: `ContextSegment`, `Transition`, `BlockDefinition`, `NodeDefinition`
 *   - Type Alias for Workflow Engine: `ExecutionPayload`
 *
 * @contract
 *   assertions:
 *     purity: pure          # This file contains only type definitions and no executable logic.
 *     external_io: none     # This file does not perform any I/O.
 *     state_ownership: none # This file does not own or manage any state.
 */

import type { ApiKey } from '@shared/domain/api-key';

// --- I. WORKFLOW ENGINE DATA CONTRACTS ---

/**
 * @id packages/client/src/shared/types.ts#ContextSegment
 * @description Represents a single, ordered piece of context within the Execution Payload. It is the atomic unit of the "chatbox" history, designed to be tracked, merged, and passed between Blocks.
 */
export interface ContextSegment {
  /** A unique, timestamp-based identifier for this specific segment, enabling traceability. */
  id: string;
  /** The semantic type of the content, used by the AI and merge strategies (e.g., 'SYSTEM_INSTRUCTION', 'CODE_OUTPUT', 'TEST_RESULT'). */
  type: string;
  /** The raw text content of the segment. */
  content: string;
  /** The ISO 8601 timestamp of when the segment was created, crucial for ordering and multi-turn tracking. */
  timestamp: string;
}

/**
 * @id packages/client/src/shared/types.ts#ExecutionPayload
 * @description The primary, ordered "chatbox" context that is passed between Blocks. As an array of ContextSegments, it represents the complete, replayable history of a workflow's execution path, embodying the Principle of Contiguous Memory.
 */
export type ExecutionPayload = Array<ContextSegment>;

/**
 * @id packages/client/src/shared/types.ts#Transition
 * @description Defines a single, conditional state transition rule within a Block's manifest definition, creating a directed link in the execution graph from an output Signal to a subsequent Action.
 */
export interface Transition {
  /** The keyword emitted by a Block's Worker that this transition listens for. This is the event trigger. */
  on_signal: string;
  /** The atomic action to execute, which must be a valid command from the DSL (e.g., 'JUMP:TargetId', 'CALL:TargetId'). */
  action: string;
}

/**
 * @id packages/client/src/shared/types.ts#BlockDefinition
 * @description The manifest definition for a single, atomic, executable unit of work (a Block). It is a pure, stateless entity that contains no logic itself, only references to the components of execution.
 */
export interface BlockDefinition {
  /** A string identifier referencing the Worker (AI or internal) that will execute the Block's logic. */
  worker: string;
  /** An ordered array of merge instructions used by the Orchestrator to assemble the `ExecutionPayload` for this Block's execution. */
  payload_merge_strategy: string[];
  /** The complete table of rules that governs all possible state transitions out of this Block. */
  transitions: Transition[];
}

/**
 * @id packages/client/src/shared/types.ts#NodeDefinition
 * @description The manifest definition for a Node, a logical container that groups related Blocks into a subroutine and manages the flow of static context (rules and contracts).
 */
export interface NodeDefinition {
  /** The unique BlockId of the first Block to be executed when the Orchestrator enters this Node. This is the Node's single entry point. */
  entry_block: string;
  /** A boolean flag that defines the Node's context boundary. If `FALSE`, all inherited context from parent Nodes is discarded, creating a pure, isolated subroutine. */
  context_inheritance: boolean;
  /** A key-value store of local, static memory (e.g., rules, contracts, configurations) that is passed down to this Node and all of its children Blocks. */
  static_memory: Record<string, unknown>;
  /** A map of all `BlockDefinition` objects that are logically contained within this Node, keyed by their local name. */
  blocks: Record<string, BlockDefinition>;
}

/**
 * @id packages/client/src/shared/types.ts#WorkflowManifest
 * @description Defines the top-level structure of the `workflows.json` manifest file. It is a dictionary where each key is a unique NodeId and each value is a complete `NodeDefinition`, enforcing the architectural contract at the root level.
 */
export type WorkflowManifest = Record<string, NodeDefinition>;


// --- II. EVENT BUS MESSAGE CONTRACTS ---

// --- INCOMING MESSAGES (WebView -> Extension Host) ---

/**
 * A map of all possible commands sent from the UI to the backend, with their
 * corresponding payload types.
 */
type CommandPayloadMap = {
  // API Key Management
  addApiKey: ApiKey;
  removeApiKey: { id: string };
  loadApiKeys: undefined;

  // Workflow Control
  startWorkflow: {
    nodeId: string; // The entry point Node for the new workflow.
  };
  userAction: {
    action: 'proceed' | 'revise' | 'abort';
    sessionId: string;
  };
};

/**
 * @id packages/client/src/shared/types.ts#Message
 * @description The discriminated union type for all messages sent FROM the WebView TO the Extension Host.
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
 * @description Represents a complete snapshot of an executing workflow's state, designed to be sent to the UI for real-time visualization.
 */
export interface PlanningState {
  /** The ID of the Node currently being executed. */
  currentNodeId: string;
  /** The ID of the Block currently in progress or that has just completed. */
  currentBlockId: string;
  /** The complete, ordered "chatbox" history to be rendered in the UI. */
  executionPayload: ExecutionPayload;
  /** A flag indicating if the workflow is paused and waiting for user input. */
  isHalted: boolean;
  /** An error message if the workflow halted due to a failure. */
  errorMessage: string | null;
}

/**
 * @id packages/client/src/shared/types.ts#ExtensionMessage
 * @description The discriminated union type for all messages sent FROM the Extension Host TO the WebView.
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