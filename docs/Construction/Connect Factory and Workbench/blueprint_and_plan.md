# Blueprint (Finalized)

### 1. File Manifest (Complete Scope)
*   `packages/client/src/lib/workflow/Orchestrator.transitions.ts`
*   `packages/client/src/lib/ai/ApiPoolManager.ts`
*   `packages/client/src/events/handler.ts`
*   `packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts`
*   `packages/client/src/lib/workflow/Orchestrator.context.spec.ts`
*   `packages/client/src/lib/ai/ApiPoolManager.spec.ts`

### 2. Logical Change Summary (Complete)

#### **Core Changes:**
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.ts`**: The `Orchestrator` will be made "environment-aware." Its primary execution method will be updated to accept the `worktreePath` as a required argument. This path will then be stored for the duration of the workflow run and included in every `WorkOrder` object passed to the `ApiPoolManager`, ensuring all downstream I/O operations are correctly scoped to the isolated worktree.
*   **`packages/client/src/lib/ai/ApiPoolManager.ts`**: The core `WorkOrder` data contract will be updated to include the `worktreePath`. The `execute` method's implementation will be modified to receive this new property and pass it through to the internal worker implementations, which will use it as their current working directory.

#### **Collateral (Fixing) Changes:**
*   **`packages/client/src/events/handler.ts`**: The `startWorkflow` command handler will be updated. The `.then()` block that runs after a `WorktreeSession` is successfully created will now extract the `session.worktreePath` from the session object and pass it as the second argument to the `orchestrator.executeNode` method, resolving the known type error.
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts`**: The test suite will be updated. All calls to `orchestrator.executeNode()` within the test cases will be modified to include a mock `worktreePath` string as the second argument to match the new method signature.
*   **`packages/client/src/lib/workflow/Orchestrator.context.spec.ts`**: The test suite will be updated. All calls to `orchestrator.executeNode()` will be modified to include a mock `worktreePath` as the second argument to align with the refactored method signature.
*   **`packages/client/src/lib/ai/ApiPoolManager.spec.ts`**: The test suite will be updated. All mock `WorkOrder` objects created for testing the `execute` method will be modified to include a new `worktreePath` property (e.g., `worktreePath: '/mock/worktree'`) to conform to the updated interface.

### 3. API Delta Ledger (Complete)
*   **File:** `packages/client/src/lib/workflow/Orchestrator.transitions.ts`
    *   **Symbol:** `Orchestrator.executeNode` (Public Method)
    *   **Before:** `public async executeNode(startNodeId: string): Promise<void>`
    *   **After:** `public async executeNode(startNodeId: string, worktreePath: string): Promise<void>`
*   **File:** `packages/client/src/lib/ai/ApiPoolManager.ts`
    *   **Symbol:** `WorkOrder` (Interface)
    *   **Before:** `export interface WorkOrder { worker: string; context: ExecutionPayload; }`
    *   **After:** `export interface WorkOrder { worker: string; context: ExecutionPayload; worktreePath: string; }`

# Blueprint (Test Assessment)

*   **`packages/client/src/lib/workflow/Orchestrator.transitions.ts`**: Requires updated test file (Reason: The file is CRITICAL and its public `executeNode` method signature is changing, requiring all tests that call it to be updated).
*   **`packages/client/src/lib/ai/ApiPoolManager.ts`**: Requires updated test file (Reason: The file is CRITICAL and the `WorkOrder` type used by its `execute` method is changing, requiring mock data in tests to be updated).
*   **`packages/client/src/lib/ai/types.ts`**: No test file required (Reason: Contains only TypeScript type definitions; its correctness is verified by the compiler and the tests of all consuming files).
*   **`packages/client/src/events/handler.ts`**: Requires updated test file (Reason: The file is CRITICAL and its logic is changing to call the `Orchestrator.executeNode` method with a new argument, requiring tests to be updated).
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts`**: Requires updated test file (Reason: This is the test file for a modified source file; its test cases will fail due to the API signature change).
*   **`packages/client/src/lib/workflow/Orchestrator.context.spec.ts`**: Requires updated test file (Reason: This test suite instantiates the `Orchestrator` class, which is a modified dependency; the test setup will break and must be updated).
*   **`packages/client/src/lib/ai/ApiPoolManager.spec.ts`**: Requires updated test file (Reason: This is the test file for a modified source file; its mock `WorkOrder` data is now invalid and must be updated to include the new `worktreePath` property).

---

# Implementation Plan (Finalized)

### Phase 1: Refactor Core Execution Pipeline for Environment Awareness

#### Task 1.1: `packages/client/src/lib/ai/ApiPoolManager.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration, I/O & Concurrency Management)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/ApiPoolManager.ts
     * @architectural-role Orchestrator
     * @description Implements the core stateful orchestrator for the AI Service Layer. It manages the pool of `ApiKey`s, executes the "key carousel" logic, and handles failover.
     * @core-principles
     * 1. IS the single, stateful entry point for all AI requests from the application.
     * 2. OWNS the key pool, the round-robin state, and the failover logic.
     * 3. DELEGATES all actual network I/O to the stateless `aiClient` façade.
     */
    ```

#### Task 1.2: `packages/client/src/lib/ai/ApiPoolManager.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/ApiPoolManager.spec.ts
     * @test-target packages/client/src/lib/ai/ApiPoolManager.ts
     * @description Verifies the ApiPoolManager's orchestration logic, including the key carousel (round-robin) and failover mechanisms, using a mocked aiClient and updated WorkOrder data.
     * @criticality The test target is CRITICAL as it orchestrates core business logic and manages state.
     * @testing-layer Unit
     */
    ```

#### Task 1.3: `packages/client/src/lib/workflow/Orchestrator.transitions.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: State Store Ownership, Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.transitions.ts
     * @architectural-role Orchestrator
     * @description The deterministic, graph-based execution engine. This module contains the core state machine logic and depends on injected services for all I/O.
     * @core-principles
     * 1. IS a deterministic state machine, not a speculative agent.
     * 2. OWNS the execution loop and runtime state (Payload, Return Stack).
     * 3. DELEGATES all AI calls and context slicing to injected services.
     */
    ```

#### Task 1.4: `packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts
     * @test-target packages/client/src/lib/workflow/Orchestrator.transitions.ts
     * @description Verifies the core state transition logic of the Orchestrator, ensuring that calls to the updated `executeNode` method correctly handle the new `worktreePath` argument.
     * @criticality The test target is CRITICAL.
     * @testing-layer Integration
     */
    ```

#### Task 1.5: `packages/client/src/lib/workflow/Orchestrator.context.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.context.spec.ts
     * @test-target packages/client/src/lib/workflow/Orchestrator.context.ts
     * @description Test suite for the Orchestrator's context management. It will be updated to pass the new `worktreePath` argument when calling the Orchestrator's execution method.
     * @criticality The test target is CRITICAL as it contains core business logic.
     * @testing-layer Integration
     */
    ```

#### Task 1.6: `packages/client/src/events/handler.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/events/handler.ts
     * @architectural-role Orchestrator
     * @description A factory for creating an event handler. It routes commands from
     * the UI to the appropriate backend services, which are provided via a context object.
     * @core-principles
     * 1. IS the single entry point for all commands from the UI layer.
     * 2. DELEGATES all business logic to the appropriate service or store.
     * 3. ENFORCES testability by design through state encapsulation.
     */
    ```