
---

# Specification: Git Worktree Manager Service

## 1. High-Level Summary
This specification defines the `GitWorktreeManager`, the foundational service for ensuring safety, parallelism, and robustness in RoboSmith. Its core purpose is to act as the "foreman" for the Git repository, creating, managing, and destroying isolated development sandboxes (Git worktrees) for each user-initiated workflow.

This service is the direct implementation of the architecture laid out in `GitWorktree_System.md`. It achieves its goals by orchestrating all low-level file system and Git operations through a dedicated **`IGitAdapter`**, making the manager itself a pure, testable state machine. It abstracts all raw Git commands into a clean API, runs the proactive conflict detection scan, and, most critically, performs a self-healing reconciliation loop on startup to guarantee its in-memory state is always a perfect reflection of reality.

## 2. Core Data Contracts
These contracts define the primary entities and results that the `GitWorktreeManager` operates on. They remain unchanged by the introduction of the adapter.

```typescript
/**
 * Represents a single, managed Git worktree session.
 */
export interface WorktreeSession {
  /** A unique identifier for the session (and its tab). Matches the worktree's directory name. */
  sessionId: string;
  /** The absolute path to the worktree's root directory. */
  worktreePath: string;
  /** The name of the Git branch checked out in this worktree. */
  branchName: string;
  /** The list of "seed files" that this session intends to modify. */
  changePlan: string[];
  /** The current status of the workflow (e.g., Running, Held). */
  status: 'Running' | 'Queued' | 'Held';
}

/**
 * Defines the arguments needed to create a new worktree.
 */
export interface CreateWorktreeArgs {
  changePlan: string[];
  baseBranch: string;
}

/**
 * Represents the outcome of a conflict scan.
 */
export type ConflictScanResult =
  | { status: 'CLEAR' }
  | { status: 'CLASH', conflictingSessionId: string, conflictingFiles: string[] };
```

## 3. Component Specification

### Component: GitWorktreeManager
*   **Architectural Role:** Orchestrator (for Git Operations & Workspace State)
*   **Core Responsibilities:**
    *   **ORCHESTRATES** a startup reconciliation loop by delegating to an `IGitAdapter` to compare file system state with persisted state.
    *   Manages the lifecycle of all Git worktrees by sending high-level commands (create, remove) to the `IGitAdapter`.
    *   Maintains the in-memory state of all active sessions and **DELEGATES** the persistence of this state to the `IGitAdapter`.
    *   Executes the proactive "seed file" conflict scan to identify high-risk modification overlaps.
    *   Provides a high-level API for worktree management, completely abstracting the underlying Git command execution which is handled by the `IGitAdapter`.

*   **Public API (TypeScript Signature):**
    ```typescript
    import type { IGitAdapter } from '../architecture/Core_Adapters_and_Dependency_Inversion.md';

    export class GitWorktreeManager {
      /**
       * The manager's constructor uses Dependency Injection to receive its I/O adapter.
       */
      constructor(gitAdapter: IGitAdapter);

      /**
       * Gets the single, shared instance of the GitWorktreeManager.
       */
      public static getInstance(gitAdapter: IGitAdapter): GitWorktreeManager;

      /**
       * Initializes the service. MUST be called once on extension activation.
       * Runs the reconciliation loop by querying the injected adapter.
       */
      public async initialize(): Promise<void>;

      /**
       * Creates a new Git worktree, persists the state, and returns the new session.
       */
      public async createWorktree(args: CreateWorktreeArgs): Promise<WorktreeSession>;

      /**
       * Removes a Git worktree from the filesystem and updates the persisted state.
       */
      public async removeWorktree(sessionId: string): Promise<void>;

      /**
       * Scans a new change plan against all other active sessions.
       */
      public async runConflictScan(newChangePlan: string[]): Promise<ConflictScanResult>;
    }
    ```

*   **Detailed Behavioral Logic (The Algorithm):**

    1.  **`initialize()`:**
        a.  **Read Ground Truth:** Calls `this.adapter.readDirectory()` to get a list of all actual directories inside `.worktrees/`.
        b.  **Read Cached State:** Calls `this.adapter.getGlobalState()` to load its last-known list of sessions.
        c.  **Find Zombies:** Compares the two lists to find directories that exist on disk but not in the state (from a crash). It logs a warning for each one.
        d.  **Find Ghosts:** Finds entries in the state that no longer exist on disk (manual deletion). It removes these "ghost" entries from its internal state object.
        e.  **Persist & Finalize:** If any ghosts were removed, it calls `this.adapter.updateGlobalState()` to save the cleaned state. It then loads the final, correct state into its private in-memory `Map` for fast access.

    2.  **`createWorktree(args)`:**
        a.  Generates a unique UUID to serve as the `sessionId` (this will also be the directory and branch name).
        b.  Calls `this.adapter.exec(['worktree', 'add', ...])` to execute the Git command. Throws an error on failure.
        c.  Upon success, creates a new `WorktreeSession` object.
        d.  Adds the new session to its internal `Map`.
        e.  Calls `this.adapter.updateGlobalState()` to save the entire, updated map to disk.
        f.  Resolves the promise with the new `WorktreeSession`.

    3.  **`removeWorktree(sessionId)`:**
        a.  Looks up the session in its internal map.
        b.  Calls `this.adapter.exec(...)` to execute the `git worktree remove` and `git branch -d` commands.
        c.  Upon success, removes the session from its internal `Map`.
        d.  Calls `this.adapter.updateGlobalState()` to save the change.

    4.  **`runConflictScan(newChangePlan)`:**
        a.  This logic is unchanged at a high level. It remains a pure, read-only check that iterates over the now-persistent and reconciled internal map of sessions.

*   **Mandatory Testing Criteria:**
    *   A test for `initialize` must verify that it correctly identifies "zombie" directories from a **mocked `IGitAdapter.readDirectory` call**.
    *   A test for `initialize` must verify that it correctly removes "ghost" entries from a state object provided by a **mocked `IGitAdapter.getGlobalState` call**.
    *   A test must verify that `createWorktree` makes a call to the **mock `IGitAdapter.updateGlobalState` method** upon success.
    *   A test must verify that `removeWorktree` also calls **`IGitAdapter.updateGlobalState`** upon success.
    *   A test must verify that `createWorktree` executes the correct `git worktree add` command via the **mocked `IGitAdapter.exec` method**.
    *   A test must verify that `removeWorktree` executes the correct cleanup commands via the **mocked `IGitAdapter.exec` method**.
    *   A test must verify that `runConflictScan` returns a `CLASH` status when a file overlap is detected in the active sessions.