
---

# Specification: Worktree Queue Manager

## 1. High-Level Summary
This specification defines the `WorktreeQueueManager`, the "air traffic controller" for all worktree creation requests. Its core purpose is to manage contention for shared files by implementing the deterministic queuing system described in `GitWorktree_System.md`.

When the `GitWorktreeManager` reports a `CLASH`, this service takes over. It places the conflicting task in a waiting line and ensures that tasks are processed in a fair, predictable order: **First-In-First-Out (FIFO)** by default, with an optional priority system for users who need more control. This service is critical for enabling a smooth, non-blocking user experience, allowing users to define multiple, potentially overlapping tasks without causing system errors.

## 2. Core Data Contracts
These contracts define the tasks managed by the queue and their possible states.

```typescript
import type { CreateWorktreeArgs, WorktreeSession } from './GitWorktreeManager';

/**
 * Represents a single worktree creation request being managed by the queue.
 */
export interface QueuedTask {
  /** A unique identifier for this specific request. */
  taskId: string;
  /** The arguments needed to create the worktree once it's clear to proceed. */
  args: CreateWorktreeArgs;
  /** The ISO timestamp of when the task was submitted, for FIFO sorting. */
  timestamp: string;
  /** An optional user-defined priority (lower number is higher priority). */
  priority?: number;
  /** The current status of the task within the queue. */
  status: 'PENDING' | 'RUNNING' | 'WAITING';
  /** A function to call to resolve the promise returned when the task was submitted. */
  resolve: (session: WorktreeSession) => void;
  /** A function to call to reject the promise if the task fails. */
  reject: (reason?: any) => void;
}
```

## 3. Component Specification

### Component: WorktreeQueueManager
*   **Architectural Role:** Orchestrator (for Task Queuing)
*   **Core Responsibilities:**
    *   Accept and enqueue new worktree creation tasks.
    *   Orchestrate the conflict scan for pending tasks by delegating to the `GitWorktreeManager`.
    *   If a task is clear, immediately execute it; if it clashes, place it in a waiting queue.
    *   Manage the waiting queue according to a strict sorting order: first by priority, then by timestamp (FIFO).
    *   Process the queue automatically whenever a running task completes, checking if waiting tasks are now unblocked.

*   **Public API (TypeScript Signature):**
    ```typescript
    import type { GitWorktreeManager } from './GitWorktreeManager';

    export class WorktreeQueueManager {
      /**
       * The constructor requires an instance of the GitWorktreeManager to perform its duties.
       */
      constructor(gitWorktreeManager: GitWorktreeManager);

      /**
       * Submits a new worktree creation task to the queue. This is the primary entry point.
       * @param args The arguments needed to create the worktree.
       * @param priority An optional numeric priority (1 = highest).
       * @returns A promise that resolves with the WorktreeSession *only when the task is
       *          successfully executed*, which may not be immediate if it is queued.
       */
      public submitTask(args: CreateWorktreeArgs, priority?: number): Promise<WorktreeSession>;

      /**
       * Signals that a running task has completed its work (e.g., its changes have been merged),
       * freeing up its files. This triggers the queue to be re-processed.
       * @param sessionId The session ID of the task that has completed.
       */
      public markTaskComplete(sessionId: string): void;
    }
    ```

*   **Detailed Behavioral Logic (The Algorithm):**
    1.  **`submitTask`:**
        a.  It creates a new `QueuedTask` object, generating a unique `taskId`, a `timestamp`, and attaching the provided arguments and priority. It also creates a new `Promise` and stores its `resolve` and `reject` functions within the task object.
        b.  It adds this new task to an internal queue (e.g., an array) with an initial status of `PENDING`.
        c.  It immediately calls a private `_processQueue()` method to see if the new task can run right away.
        d.  It returns the `Promise` associated with the task.
    2.  **`markTaskComplete`:**
        a.  This method is called externally when a user finishes with a worktree. It finds the `RUNNING` task associated with the given `sessionId`.
        b.  It removes this completed task from the internal queue.
        c.  It immediately calls `_processQueue()` to check if any waiting tasks are now unblocked.
    3.  **`_processQueue` (Private Method):**
        a.  This is the core logic loop. It first checks if any task in the queue already has the `RUNNING` status. If so, it does nothing and returns, as only one task can run at a time.
        b.  If no task is running, it finds the next candidate to run. It sorts the entire queue of `PENDING` and `WAITING` tasks. The sorting logic is strict:
            i.  Sort by `priority` in ascending order (a task with priority `1` comes before `2`). Tasks without a priority are treated as having the lowest priority.
            ii. For tasks with the same priority (or no priority), sort by `timestamp` in ascending order (FIFO).
        c.  It selects the top task from the sorted list. If there are no tasks, it returns.
        d.  It calls `this.gitWorktreeManager.runConflictScan()` using the candidate task's `changePlan`.
        e.  **If the result is `CLEAR`:**
            i.   It changes the task's status to `RUNNING`.
            ii.  It calls `this.gitWorktreeManager.createWorktree()` with the task's arguments.
            iii. Upon success, it calls the task's stored `resolve()` function, passing in the new `WorktreeSession`. This fulfills the promise that was returned to the original caller of `submitTask`.
        f.  **If the result is `CLASH`:**
            i.   It changes the task's status to `WAITING`.
            ii.  The task remains in the queue, and the `_processQueue` method finishes. It will be re-evaluated the next time `markTaskComplete` is called.

*   **Mandatory Testing Criteria:**
    *   **Immediate Execution:** A test must verify that a task submitted when the queue is empty and there are no conflicts is executed immediately.
    *   **Queuing on Conflict:** A test must verify that if a conflicting task is submitted, its status becomes `WAITING`, and `createWorktree` is **not** called.
    *   **FIFO Processing:** A test must verify that if two conflicting, non-prioritized tasks are submitted, the one submitted **first** is the one that runs after the blocker is cleared.
    *   **Priority Override:** A test must verify that if a low-priority task is waiting, and a new, high-priority but also conflicting task is submitted, the **high-priority** task runs first once the blocker is cleared.
    *   **`markTaskComplete` Trigger:** A test must verify that a waiting task is only processed *after* the blocking task's session ID is passed to `markTaskComplete`.