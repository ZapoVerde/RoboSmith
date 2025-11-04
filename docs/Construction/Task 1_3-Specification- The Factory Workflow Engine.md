
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
*   **Architectural Role:** `Orchestrator`
*   **Core Responsibilities:**
    *   Parse and validate the `workflows.json` manifest upon initialization.
    *   Manage the primary execution loop: **Assemble Context -> Execute Block -> Lookup Transition -> Execute Action**.
    *   Maintain the complete runtime state, including the `ExecutionPayload` and the `ReturnStack` for nested calls.
    *   Assemble the five-layer memory context for each Block execution, strictly respecting the Node's `context_inheritance` rule.
    *   Faithfully execute the **Binary/Default Fallback** error model, ensuring the system always transitions to a predictable state.

*   **Public API (TypeScript Signature):**
    ```typescript
    import type { WorkflowManifest } from './types'; // Assumed manifest type

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

*   **Detailed Behavioral Logic (The Algorithm):**
    1.  The `execute` method is called with a `startNodeId`. The Orchestrator initializes its internal state, setting the `currentBlockId` to the `entry_block` of the `startNodeId` and clearing the `ReturnStack`.
    2.  The main execution loop begins and continues as long as there is a `currentBlockId`.
    3.  **Step A: Assemble Context.** The Orchestrator constructs the complete memory prompt for the current Block's Worker by aggregating the five layers in order of priority:
        1.  **Execution Payload:** Assembles the ordered `ExecutionPayload` by executing the Block's `payload_merge_strategy`.
        2.  **Block/Worker Contract:** Gathers the local instructions from the Block and the Worker's persona.
        3.  **Inherited Context:** Traverses the `ReturnStack` to aggregate `static_memory` from all parent Nodes, respecting each Node's `context_inheritance` boolean.
        4.  **Primary Artifact:** Reads the content of the target file(s) from the worktree.
        5.  **System Metadata:** Injects the current, immutable system state (`WorktreePath`, `BlockId`, etc.).
    4.  **Step B: Execute Block.** The Orchestrator invokes the specified Worker, passing it the fully assembled context. It waits for the Worker to return its output, which consists of a `(new ExecutionPayload, Signal)` tuple.
    5.  **Step C: Lookup Transition.** The Orchestrator searches the current Block's `transitions` table for an entry whose `on_signal` property exactly matches the `Signal` returned by the Worker.
    6.  **Step D: The Fallback.** If no direct match is found, the Orchestrator performs a second lookup for the reserved `on_signal: "SIGNAL:FAIL_DEFAULT"`. If this fallback transition is found, it is used. If neither a direct match nor a default is found, a catastrophic, unrecoverable error is thrown, terminating the workflow.
    7.  **Step E: Execute Action via the `ActionHandler`** The Orchestrator now delegates the parsing and execution of the chosen transition's `action` string to the stateless `ActionHandler` utility. This maintains a clean separation of concerns, keeping the Orchestrator focused on managing the loop and state, while the `ActionHandler` owns the logic of the action DSL. The definitive specification for the Action DSL and its commands is located in `docs/Construction/Internal_Workers_and_Actions.md`.
    1.  **Prepare Action Parameters:** The Orchestrator prepares an `ActionParams` object containing the `action` string (e.g., `JUMP:TargetId`), its current `returnStack`, and, if the action is a `CALL`, a calculated `returnAddress`. The `returnAddress` is determined by finding the next logical block in the current sequence, which will be executed after the subroutine returns.
    2.  **Invoke the Handler:** The Orchestrator calls `executeAction(params)` and awaits the `ActionResult`.
    3.  **Update State:** The Orchestrator then destructively updates its own internal state based on the result from the `ActionHandler`:
        *   **For a `JUMP` action:** The handler returns the target ID. The Orchestrator updates its `currentBlockId` to this new ID. The `ReturnStack` is unchanged.
        *   **For a `CALL` action:** The handler pushes the provided `returnAddress` onto the stack and returns the target node's entry block ID. The Orchestrator updates its `ReturnStack` to the new, deeper stack and updates its `currentBlockId` to the target.
        *   **For a `RETURN` action:** The handler pops the last address from the stack and returns it. The Orchestrator updates its `ReturnStack` to the new, shallower stack and updates its `currentBlockId` to the popped address.
4.  **Handle Termination:** If the `ActionHandler` returns a `null` value for `nextBlockId` (which occurs on a `RETURN` from an empty stack), the Orchestrator's `currentBlockId` is set to `null`, which will cause the main execution loop to terminate gracefully after this cycle.
5.  The loop then repeats from Step A with the new `currentBlockId`.
    
    8.  The loop repeats from Step A with the new `currentBlockId`. If a Block has no transitions or an action results in an empty `currentBlockId`, the loop terminates.

*   **Mandatory Testing Criteria:**
    *   The Orchestrator must correctly parse a valid manifest and reject an invalid one.
    *   A test must verify that a `JUMP` action correctly updates the `currentBlockId` and continues execution.
    *   A test must verify that a `CALL` action correctly pushes a return address to the stack before jumping, and a subsequent `RETURN` action correctly pops that address and jumps back.
    *   A test must prove the **Binary/Default Fallback** logic: an unknown signal must trigger the `SIGNAL:FAIL_DEFAULT` transition if it exists.
    *   A test must prove the **Context Boundary** logic: when a Node with `context_inheritance: FALSE` is called, the context passed to its child Blocks must not contain any static memory from the parent Node.
    *   A test must verify that the `payload_merge_strategy` correctly assembles and orders the `ExecutionPayload` before it is sent to the Worker.