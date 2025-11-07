# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   The primary objective is to implement the "Workbench," a complete Git Worktree management system that provides isolated, parallel development sandboxes. This is essential to create a safe, robust, and non-blocking environment for the manifest-driven workflow engine to operate in, preventing data corruption and race conditions.

### **1.1 Detailed Description**
*   This architecture introduces a two-part system to manage contention for shared files during parallel automated workflows. First, the existing `GitWorktreeManager` service will be enhanced with a proactive conflict detection system. This system will scan a new task's intended file modifications (`changePlan`) against all other active sessions to identify potential overlaps. Second, a new `WorktreeQueueManager` service will be created to act as an "air traffic controller." This service will intercept all worktree creation requests, use the conflict scan to check for overlaps, and if a clash is detected, place the conflicting task into a deterministic First-In-First-Out (FIFO) waiting queue until the blocking task is complete.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
*   **Robustness:** The system MUST be resilient to failures and prevent data corruption caused by concurrent file modifications. [cite: docs/architecture/RoboSmith_spec.md]
*   **Safety via Isolation:** All file modification tasks MUST operate within an isolated Git Worktree to prevent cross-contamination between parallel workflows. [cite: docs/architecture/GitWorktree_System.md]
*   **Deterministic Queuing:** Conflicting tasks MUST be resolved in a predictable, non-random order, with FIFO as the default model to preserve the assumptions of earlier tasks. [cite: docs/architecture/GitWorktree_System.md]
*   **Separation of Concerns:** The logic for managing the queue of tasks (`WorktreeQueueManager`) MUST be separate from the logic for managing the Git worktrees themselves (`GitWorktreeManager`).

*   **Blueprint-Specific Principles:**
*   All new worktree creation requests MUST be routed through the `WorktreeQueueManager`; direct calls to the `GitWorktreeManager`'s creation method are forbidden from the main application flow.
*   The `GitWorktreeManager` is the single source of truth for conflict scan results.
*   The `WorktreeQueueManager` MUST process waiting tasks automatically when an active task completes; it does not require manual polling.
*   The system MUST provide a non-blocking user experience; a user can submit a conflicting task and the system will queue it without throwing an error.

### **3. Architectural Flows**
*   **User Flow:**
*   The user initiates a workflow for "Task A," which plans to modify `shared.ts`. The workflow begins running immediately.
*   While Task A is running, the user initiates a second workflow for "Task B," which also plans to modify `shared.ts`.
*   The user observes that Task B does not fail but enters a "Queued" state in the UI, indicating it is waiting for Task A.
*   The user allows Task A to complete and merges its changes.
*   The moment Task A is marked as complete, the user observes that Task B automatically transitions from "Queued" to "Running" without any further user interaction.

*   **Data Flow:**
*   A `CreateWorktreeArgs` data object (containing a `changePlan` array) is submitted to the `WorktreeQueueManager`.
*   The manager wraps this in an internal `QueuedTask` data object, which includes a timestamp and promise resolvers.
*   The `changePlan` from the `QueuedTask` is passed to the `GitWorktreeManager`'s `runConflictScan` method.
*   The `GitWorktreeManager` returns a `ConflictScanResult` data object (either `{status: 'CLEAR'}` or `{status: 'CLASH', ...}`).
*   If the result is `CLEAR`, the `CreateWorktreeArgs` are passed to the `GitWorktreeManager`'s `createWorktree` method, which eventually returns a `WorktreeSession` object that resolves the original promise.
*   If the result is `CLASH`, the `QueuedTask` object is stored in an internal queue.

*   **Logic Flow:**
*   A new task is submitted to the `WorktreeQueueManager.submitTask` method.
*   The queue manager immediately calls the `GitWorktreeManager.runConflictScan` method with the new task's change plan.
*   **If the scan returns `'CLEAR'`:** The queue manager immediately calls `GitWorktreeManager.createWorktree` and resolves the promise returned to the original caller.
*   **If the scan returns `'CLASH'`:** The task's status is set to `WAITING`, and it is added to an internal queue. The promise is not resolved yet.
*   Later, an external event signals that a running task has completed, calling the `WorktreeQueueManager.markTaskComplete` method.
*   This triggers the queue manager to re-process its queue. It sorts all waiting tasks by timestamp (FIFO).
*   It takes the first task in the sorted queue and re-runs the `runConflictScan`.
*   If the scan now returns `'CLEAR'`, the queue manager proceeds to create the worktree for that task and resolves its corresponding promise. If it still clashes, it remains in the queue.

### **4. Overall Acceptance Criteria**
*   The `GitWorktreeManager` service must contain a fully implemented `runConflictScan` method that correctly identifies file overlaps between a new plan and existing sessions.
*   A new `WorktreeQueueManager` service must exist and be integrated into the application's startup and event handling logic.
*   Submitting a task with no file conflicts must result in the immediate creation of a Git worktree.
*   Submitting a task that conflicts with a running task must result in the new task being placed into a waiting queue and not being executed immediately.
*   When a running task is marked as complete, any queued tasks that it was blocking must be automatically re-evaluated and executed if they are now clear.
*   All new and modified logic must be verified with comprehensive unit and integration tests.