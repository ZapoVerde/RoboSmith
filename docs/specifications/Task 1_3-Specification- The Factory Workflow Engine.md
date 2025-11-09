
---

# Specification: The Block/Node Workflow Engine

## 1. High-Level Summary
This specification defines the "Factory" or the **Orchestrator Engine**, the central nervous system of the RoboSmith project. Its core purpose is to act as a deterministic, graph-based execution engine that translates a declarative manifest (`workflows.json`) into a series of automated actions.

The engine is built on the principles of architectural purity, stateless execution units, and explicit control flow. It replaces a fragile, implicit state machine with a robust model where every transition is a declared, unambiguous instruction. The system operates on two core architectural entities: **Nodes**, which serve as logical containers for context, and **Blocks**, which are the pure, atomic units of execution. This design ensures the entire workflow is predictable, auditable, and infinitely extensible.

## 2. Core Data Contracts
These contracts define the immutable structures within the `workflows.json` manifest and the dynamic state managed by the Orchestrator at runtime.

```typescript
/**
 * @id .../workflow-types.ts#ContextSegment
 * @description A single, ordered piece of context within the Execution Payload, representing one turn or element in the "chatbox" history.
 */
export interface ContextSegment {
  id: string;      // A unique identifier for the segment.
  type: string;    // The semantic type, e.g., 'SYSTEM_INSTRUCTION', 'CODE_OUTPUT'.
  content: string; // The text content.
}

/**
 * @id .../workflow-types.ts#ExecutionPayload
 * @description The primary, ordered "chatbox" context that is passed between Blocks. It is the definitive record of the multi-turn history.
 */
export type ExecutionPayload = Array<ContextSegment>;

/**
 * @id .../workflow-types.ts#Transition
 * @description Defines a single, conditional state transition rule within a Block, linking an output Signal to a subsequent Action.
 */
export interface Transition {
  /** The keyword emitted by a Block's Worker that triggers this transition. */
  on_signal: string;
  /** The atomic action to execute, e.g., 'JUMP:TargetId'. */
  action: string;
}

/**
 * @id .../workflow-types.ts#BlockDefinition
 * @description The manifest definition for a single, atomic, executable unit of work.
 */
export interface BlockDefinition {
  /** A reference to the Worker (AI or internal) that will execute the logic. */
  worker: string;
  /** An ordered array of instructions for assembling the ExecutionPayload. */
  payload_merge_strategy: string[];
  /** The table of rules governing state transitions out of this Block. */
  transitions: Transition[];
}

/**
 * @id .../workflow-types.ts#NodeDefinition
 * @description The manifest definition for a logical container that groups Blocks and manages context.
 */
export interface NodeDefinition {
  /** The BlockId of the first Block to execute when this Node is entered. */
  entry_block: string;
  /** A boolean that controls the context boundary. `FALSE` creates a pure subroutine. */
  context_inheritance: boolean;
  /** The local, static memory (rules, contracts) for this Node and its children. */
  static_memory: Record<string, any>;
  /** A map of all Blocks contained within this Node. */
  blocks: Record<string, BlockDefinition>;
}
```

## 3. Component Specification

### Component: The Orchestrator Engine
* **Architectural Role:** `Orchestrator`
* **Core Responsibilities:**
    * Parse and validate the `workflows.json` manifest upon initialization.
    * Manage the primary execution loop: **Assemble Context -> Execute Block -> Lookup Transition -> Execute Action**.
    * Maintain the complete runtime state, including the `ExecutionPayload` and the `ReturnStack` for nested calls.
    * Assemble the five-layer memory context for each Block execution, strictly respecting the Node's `context_inheritance` rule.
    * Faithfully execute the **Binary/Default Fallback** error model, ensuring the system always transitions to a predictable state.
    * **Aggregate session statistics** (e.g., `totalTokensUsed`, `totalLinesWritten`) from the results of its Workers and store them as part of the session's durable state.
* **Public API (TypeScript Signature):**
    ```typescript
    import type { WorkflowManifest } from './types';
    // Assumed manifest type

    export class Orchestrator {
      /**
       * Initializes the Orchestrator with the parsed manifest and all necessary service dependencies.
       */
      constructor(manifest: WorkflowManifest, services: { /* ... */ });
      /**
       * Begins execution of the workflow graph starting at the specified Node.
       * @param startNodeId The ID of the entry-point Node.
       * @returns A promise that resolves with the final state of the execution when the graph terminates.
       */
      public async execute(startNodeId: string): Promise<void>;
    }
    ```

* **Detailed Behavioral Logic (The Algorithm):**
    1.  The `execute` method is called with a `startNodeId`. The Orchestrator initializes its internal state, setting the `currentBlockId` to the `entry_block` of the `startNodeId` and clearing the `ReturnStack`.
    2.  The main execution loop begins and continues as long as there is a `currentBlockId`.
    3.  **Step A: Assemble Context.** The Orchestrator constructs the complete memory prompt for the current Block's Worker by aggregating the five layers in order of priority (Payload, Block Contract, Inherited Context, Artifact, Metadata).
    4.  **Step B: Execute Block.** The Orchestrator invokes the specified Worker (e.g., `ApiPoolManager`). It waits for the Worker to return its output, which consists of a `(new ExecutionPayload, Signal)` tuple.
    5.  **Step C: Validate Output (NEW).** The Orchestrator performs the structural validation and cleaning as defined in `docs/architecture/AI_Output_Processing.md`.
        a.  It gets the `BlockDefinition` for the `currentBlockId`.
        b.  If `block.validationSchema` exists, the Orchestrator runs the validation logic:
        c.  It runs a **heuristic cleaner** (e.g., `cleanAiOutput`) on the AI's response to remove markdown fences and preambles.
        d.  It runs **Zod validation** (`schema.parse()`) on the cleaned output.
        e.  If validation fails, it overrides the `Signal` to `SIGNAL:VALIDATION_FAIL` and pushes a `VALIDATION_ERROR` segment (the "note") onto the `ExecutionPayload`.
        f.  If validation succeeds, it updates the `ExecutionPayload` with the *cleaned* content.
    6.  **Step D: Lookup Transition.** The Orchestrator searches the current Block's `transitions` table for an entry whose `on_signal` property exactly matches the final `Signal` (which could be the original signal or `SIGNAL:VALIDATION_FAIL`).
    7.  **Step E: The Fallback.** If no direct match is found, the Orchestrator performs a second lookup for the reserved `on_signal: "SIGNAL:FAIL_DEFAULT"`.
    8.  **Step F: Execute Action via the `ActionHandler`.** The Orchestrator delegates the parsing and execution of the chosen transition's `action` string to the stateless `ActionHandler` utility.
    9.  The loop repeats from Step A with the new `currentBlockId`.