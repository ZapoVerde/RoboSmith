# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   The primary objective is to implement the "Factory," a deterministic, graph-based execution engine that translates a declarative workflow manifest into a series of automated actions. This change replaces a fragile, implicit state machine with a robust, auditable, and extensible model that serves as the central nervous system for the entire application.

### **1.1 Detailed Description**
*   This architecture establishes a central **Orchestrator Engine** whose sole purpose is to execute a user-defined manifest file. The system's behavior is defined by two core architectural entities: **Nodes**, which act as logical containers for context and subroutines, and **Blocks**, which are the pure, atomic units of execution. The Orchestrator manages a primary "chatbox" context, called the `ExecutionPayload`, and an internal `ReturnStack` for nested calls. It follows a continuous loop: it assembles a multi-layered memory context for the current Block, invokes the appropriate AI or internal "Worker" to perform the task, receives a result and a `Signal` keyword, looks up the corresponding `Action` in the manifest's transition table, and then executes that action to determine the next state.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
    *   **The System is a Deterministic Orchestrator, Not a Speculative Agent:** The system does not decide what to do; it faithfully executes the program defined in the workflow manifest. [cite: docs/architecture/RoboSmith_spec.md]
    *   **Faithful Automation via a Declarative Engine:** The core of the system is an engine whose purpose is to interpret and execute the manifest with perfect fidelity. [cite: docs/architecture/RoboSmith_spec.md]
    *   **Separation of Concerns:** The stateful logic of the Orchestrator is cleanly separated from the stateless logic of the Workers and the declarative control flow in the manifest. [cite: docs/architecture/RoboSmith_spec.md]

*   **Blueprint-Specific Principles:**
    *   **Block Purity:** A Block **MUST** be a pure, stateless execution unit of the form: `f(Memory) -> new Memory + Signal`. It contains no logic itself. [cite: docs/architecture/RoboSmith_spec.md]
    *   **Node as Context Boundary:** A Node is a logical container. It **MUST NOT** execute logic but **MUST** manage static memory and define subroutine entry points and context inheritance rules. [cite: docs/architecture/RoboSmith_spec.md]
    *   **Manifest as Source of Truth:** All control flow logic **MUST** be defined in the manifest's `transitions` table. The engine reads this table; it does not contain the logic itself. [cite: docs/Construction/Task 1_3-Specification- The Factory Workflow Engine.md]
    *   **Binary/Default Fallback:** The system **MUST** implement a two-step transition lookup: first for an exact `Signal` match, and if none is found, for a reserved `SIGNAL:FAIL_DEFAULT` fallback. This ensures predictable error handling. [cite: docs/Construction/Task 1_3-Specification- The Factory Workflow Engine.md]

### **3. Architectural Flows**
*   **User Flow:**
    1.  The user initiates a workflow for a specific task.
    2.  The system begins autonomous execution. The user supervises the progress via a real-time UI that visualizes the execution graph.
    3.  The workflow runs to completion without further user input.
    4.  The user is presented with the final result for validation and integration.

*   **Data Flow:**
    1.  Upon initiation, a `WorkflowService` locates, reads, and parses the `workflows.json` manifest file into an in-memory object.
    2.  The `Orchestrator` begins execution at a specified entry-point Block.
    3.  For each Block, it assembles a complete memory context by aggregating five layers: the dynamic `ExecutionPayload` (chat history), the Block's static contract, inherited context from parent Nodes, the content of the primary file artifact, and system metadata.
    4.  This complete context is passed to the designated `Worker`.
    5.  The `Worker` returns a tuple containing a new, updated `ExecutionPayload` and a `Signal` keyword (e.g., `SIGNAL:SUCCESS`).
    6.  The `Orchestrator` updates its internal `ExecutionPayload` with the one returned by the worker, ensuring memory continuity.
    7.  This new state is passed to the next Block in the sequence.

*   **Logic Flow:**
    1.  The `Orchestrator` is initialized with a starting `BlockId`.
    2.  The main execution loop begins.
    3.  **Step A: Assemble Context.** The five-layer memory model is constructed based on the current Block's definition and the Orchestrator's runtime state (`ExecutionPayload`, `ReturnStack`).
    4.  **Step B: Execute Block.** The appropriate `Worker` is invoked with the assembled context. It returns a `(new ExecutionPayload, Signal)` tuple.
    5.  **Step C: Lookup Transition.** The `Orchestrator` searches the current Block's `transitions` table for an entry whose `on_signal` property exactly matches the returned `Signal`.
    6.  **Step D: The Fallback.** If no direct match is found, the `Orchestrator` performs a second lookup for the reserved `on_signal: "SIGNAL:FAIL_DEFAULT"`. If this is also not found, a catastrophic error is thrown.
    7.  **Step E: Execute Action.** The `Orchestrator` delegates the chosen transition's `action` string (e.g., `JUMP:TargetId`, `CALL:TargetNode`, `RETURN`) to a dedicated `ActionHandler`.
    8.  **Step F: Update State.** The `ActionHandler` returns the next `BlockId` and the updated `ReturnStack`. The `Orchestrator` destructively updates its internal state to match.
    9.  The loop repeats from Step A with the new `BlockId`. If the `nextBlockId` is null (e.g., from a `RETURN` on an empty stack), the loop terminates.

### **4. Overall Acceptance Criteria**
*   A valid manifest file must be successfully parsed, and an invalid one must be rejected with a clear error.
*   The system must correctly execute a `JUMP` action, immediately transitioning to the specified target Block.
*   The system must correctly execute a `CALL` action by pushing a return address to its stack before jumping, and a subsequent `RETURN` action must correctly pop that address and jump back to it.
*   The system must demonstrate the **Binary/Default Fallback** logic: when a Worker emits an unknown signal, the Orchestrator must correctly execute the `SIGNAL:FAIL_DEFAULT` transition.
*   The system must demonstrate the **Context Boundary** logic: a `CALL` to a Node with `context_inheritance: FALSE` must result in a context payload for its child Blocks that does not contain any static memory from the parent Node.
*   The system must correctly assemble the `ExecutionPayload` according to a Block's `payload_merge_strategy` before passing it to a worker.