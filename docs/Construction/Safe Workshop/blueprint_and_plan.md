# Blueprint (Finalized)

### 1. File Manifest (Complete Scope)
*   `packages/client/src/lib/git/GitWorktreeManager.ts`
*   `packages/client/src/lib/workflow/WorktreeQueueManager.ts`
*   `packages/client/src/events/handler.ts`
*   `packages/client/src/extension.ts`
*   `packages/client/src/lib/git/GitWorktreeManager.spec.ts`
*   `packages/client/src/lib/workflow/WorktreeQueueManager.spec.ts`
*   `packages/client/src/events/handler.spec.ts`
*   `packages/client/src/extension.spec.ts`

### 2. Logical Change Summary (Complete)

#### **Core Changes:**
*   **`packages/client/src/lib/git/GitWorktreeManager.ts`**: The service will be enhanced to implement the proactive conflict detection system. A new public method will be added to contain the logic for the "seed file" intersection check, which iterates through all active sessions and compares their `changePlan` against a new proposed plan to identify any file overlaps.
*   **`packages/client/src/lib/workflow/WorktreeQueueManager.ts`**: This new service will be created to act as the "air traffic controller" for all worktree creation requests. It will accept new tasks, use the `GitWorktreeManager` to perform a conflict scan, and if a `CLASH` is detected, it will place the task in a waiting queue. The service will manage this queue according to a First-In-First-Out (FIFO) order, automatically processing the next waiting task whenever a running task completes.

#### **Collateral (Fixing) Changes:**
*   **`packages/client/src/events/handler.ts`**: The logic within the `startWorkflow` command case will be updated. Instead of directly calling the `GitWorktreeManager` to create a worktree, it will now delegate that responsibility by calling the `submitTask` method on the new `WorktreeQueueManager` service, making the entire process queue-aware.
*   **`packages/client/src/extension.ts`**: The `activate` function, acting as the application's composition root, will be updated to instantiate the new `WorktreeQueueManager` singleton at startup. It will be responsible for injecting the existing `GitWorktreeManager` instance into the new queue manager's constructor to satisfy its dependency.

### 3. API Delta Ledger (Complete)
*   **File:** `packages/client/src/lib/git/GitWorktreeManager.ts`
    *   **Symbol:** `runConflictScan` (New Public Method)
    *   **Before:** None.
    *   **After:** `public async runConflictScan(newChangePlan: string[]): Promise<ConflictScanResult>;`
*   **File:** `packages/client/src/lib/workflow/WorktreeQueueManager.ts`
    *   **Symbol:** `WorktreeQueueManager` (New Class)
    *   **Before:** None.
    *   **After:** `export class WorktreeQueueManager { constructor(gitWorktreeManager: GitWorktreeManager); public submitTask(args: CreateWorktreeArgs, priority?: number): Promise<WorktreeSession>; public markTaskComplete(sessionId: string): void; }`
---
# Blueprint (Test Assessment)

*   **`packages/client/src/lib/git/GitWorktreeManager.ts`**: Requires updated test file (Reason: The file is CRITICAL and is being modified to add the new `runConflictScan` business logic, which requires its own dedicated tests).
*   **`packages/client/src/lib/workflow/WorktreeQueueManager.ts`**: Requires new test file (Reason: This is a CRITICAL new file that introduces core business logic and state management for task queuing).
*   **`packages/client/src/events/handler.ts`**: Requires updated test file (Reason: The file is CRITICAL and its core command routing logic is being changed to delegate to the new queue manager).
*   **`packages/client/src/extension.ts`**: Requires updated test file (Reason: The file is CRITICAL as the application's entry point, and its composition root logic is changing to instantiate the new service).

---

# Implementation Plan (Finalized)

### Phase 1: Implement Core Conflict Detection & Queuing Services

#### Task 1.1: `packages/client/src/lib/git/GitWorktreeManager.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration, State Store Ownership)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/git/GitWorktreeManager.ts
     * @architectural-role Orchestrator
     * @description The authoritative service for orchestrating the lifecycle, state, and
     * conflict detection of all Git worktrees. It is a pure orchestrator that
     * depends on an injected IGitAdapter to perform all I/O.
     * @core-principles
     * 1. OWNS the stateful logic for the worktree reconciliation loop.
     * 2. DELEGATES all Git commands, file system reads, and state persistence to the adapter.
     * 3. MUST be fully testable in isolation with a mock adapter.
     */
    ```

#### Task 1.2: `packages/client/src/lib/git/GitWorktreeManager.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/git/GitWorktreeManager.spec.ts
     * @test-target packages/client/src/lib/git/GitWorktreeManager.ts
     * @description Verifies the orchestration logic of the GitWorktreeManager in
     * isolation by providing a mocked IGitAdapter. It tests the self-healing
     * reconciliation loop, state management, command delegation, and the new conflict scan logic.
     * @criticality The test target is CRITICAL.
     * @testing-layer Unit
     */
    ```

#### Task 1.3: `packages/client/src/lib/workflow/WorktreeQueueManager.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration, State Store Ownership)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/WorktreeQueueManager.ts
     * @architectural-role Orchestrator
     * @description Implements the "air traffic controller" for all worktree creation requests.
     * It manages contention for shared files by implementing a deterministic FIFO queuing system.
     * @core-principles
     * 1. OWNS the state of the task queue (pending, waiting, running).
     * 2. DELEGATES all conflict scanning and worktree creation to the GitWorktreeManager.
     * 3. ORCHESTRATES the automatic processing of the queue when tasks complete.
     */
    ```

#### Task 1.4: `packages/client/src/lib/workflow/WorktreeQueueManager.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/WorktreeQueueManager.spec.ts
     * @test-target packages/client/src/lib/workflow/WorktreeQueueManager.ts
     * @description Verifies the WorktreeQueueManager's logic, including immediate execution for clear tasks, correct queuing on conflict, FIFO processing, and the auto-advancement of the queue when a task is marked complete.
     * @criticality The test target is CRITICAL.
     * @testing-layer Unit
     */
    ```

---

### Phase 2: Integrate Queue Manager into the Application

#### Task 2.1: `packages/client/src/events/handler.ts` (Source)
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
     * 2. MUST delegate all business logic to the appropriate service or store.
     * 3. MUST NOT contain any business logic itself.
     */
    ```

#### Task 2.2: `packages/client/src/events/handler.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/events/handler.spec.ts
     * @test-target packages/client/src/events/handler.ts
     * @description Verifies that the event handler correctly routes the 'startWorkflow' command to the WorktreeQueueManager service.
     * @criticality The test target is CRITICAL as it is a core orchestrator.
     * @testing-layer Unit
     */
    ```

#### Task 2.3: `packages/client/src/extension.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/extension.ts
     * @architectural-role Feature Entry Point
     * @description The main activation entry point for the VS Code extension. It is responsible for initializing all singleton services and setting up the application's composition root.
     * @core-principles
     * 1. IS the composition root for the entire backend application.
     * 2. OWNS the initialization and lifecycle of all singleton services.
     * 3. DELEGATES all ongoing work to other services after initialization.
     */
    ```

#### Task 2.4: `packages/client/src/extension.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/extension.spec.ts
     * @test-target packages/client/src/extension.ts
     * @description Verifies the extension's activation logic, ensuring that new services like the WorktreeQueueManager are correctly instantiated and provided to downstream consumers.
     * @criticality The test target is CRITICAL as it is the application's entry point.
     * @testing-layer Integration
     */
    ```