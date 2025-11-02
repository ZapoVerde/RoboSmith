
---

# Specification: Git Worktree Manager Service

## 1. High-Level Summary
This specification defines the `GitWorktreeManager`, the foundational service for ensuring safety and parallelism in RoboSmith. Its core purpose is to act as the "foreman" for the Git repository, creating, managing, and destroying isolated development sandboxes (Git worktrees) for each user-initiated workflow.

This service is the direct implementation of the architecture laid out in `GitWorktree_System.md`. It abstracts all raw Git commands into a clean, reliable API and is responsible for running the proactive conflict detection scan to prevent dangerous, overlapping file modifications before they can occur.

## 2. Core Data Contracts
These contracts define the primary entities and results that the `GitWorktreeManager` operates on.

```typescript
/**
 * Represents a single, managed Git worktree session.
 */
export interface WorktreeSession {
  /** A unique identifier for the session (and its tab). */
  sessionId: string;
  /** The absolute path to the worktree's root directory. */
  worktreePath: string;
  /** The name of the Git branch checked out in this worktree. */
  branchName: string;
  /** The list of "seed files" that this session intends to modify. */
  changePlan: string[];
}

/**
 * Defines the arguments needed to create a new worktree.
 */
export interface CreateWorktreeArgs {
  /** The list of files the new session plans to modify. */
  changePlan: string[];
  /** The base branch to create the new worktree from (e.g., 'main'). */
  baseBranch: string;
}

/**
 * Represents the outcome of a conflict scan.
 */
export type ConflictScanResult =
  | {
      status: 'CLEAR';
    }
  | {
      status: 'CLASH';
      conflictingSessionId: string;
      conflictingFiles: string[];
    };
```

## 3. Component Specification

### Component: GitWorktreeManager
*   **Architectural Role:** Orchestrator (for Git Operations)
*   **Core Responsibilities:**
    *   Manage the lifecycle of all Git worktrees, including creation, tracking, and removal.
    *   Maintain an in-memory manifest of all active `WorktreeSession` objects.
    *   Execute the proactive "seed file" conflict scan to identify high-risk modification overlaps between sessions.
    *   Abstract all `git` command-line executions into a robust, error-handling API.
    *   Provide a mechanism to retrieve the state of all currently active sessions.

*   **Public API (TypeScript Signature):**
    ```typescript
    export class GitWorktreeManager {
      /**
       * Gets the single, shared instance of the GitWorktreeManager.
       */
      public static getInstance(): GitWorktreeManager;

      /**
       * Creates a new Git worktree, runs an initial conflict scan, and adds it to the manifest.
       * @param args The base branch and initial change plan for the new session.
       * @returns A promise that resolves with the newly created WorktreeSession.
       * @throws An error if the underlying 'git worktree add' command fails.
       */
      public async createWorktree(args: CreateWorktreeArgs): Promise<WorktreeSession>;

      /**
       * Removes a Git worktree from the filesystem and the internal manifest.
       * @param sessionId The ID of the session to remove.
       * @returns A promise that resolves when cleanup is complete.
       */
      public async removeWorktree(sessionId: string): Promise<void>;

      /**
       * Scans a new change plan against all other active sessions to detect file clashes.
       * @param newChangePlan The list of files for the proposed new session.
       * @returns A promise that resolves with a ConflictScanResult.
       */
      public async runConflictScan(newChangePlan: string[]): Promise<ConflictScanResult>;
    }
    ```

*   **Detailed Behavioral Logic (The Algorithm):**
    1.  **`createWorktree`:**
        a.  It generates a unique UUID to serve as the `sessionId`.
        b.  It constructs a unique `branchName` and `worktreePath` based on the UUID (e.g., `robo-smith/session-uuid` and `.worktrees/session-uuid`).
        c.  It executes the command `git worktree add -b <branchName> <worktreePath> <baseBranch>`. This entire operation is wrapped in a `try/catch` block. If the command fails, it throws a detailed `GitCommandError`.
        d.  Upon success, it creates a new `WorktreeSession` object containing the `sessionId`, paths, and the provided `changePlan`.
        e.  It stores this new session object in a private, internal `Map<string, WorktreeSession>`.
        f.  It resolves the promise with the newly created `WorktreeSession` object.
    2.  **`removeWorktree`:**
        a.  It looks up the `WorktreeSession` in its internal map using the `sessionId`. If not found, it logs a warning and returns.
        b.  It executes the command `git worktree remove <worktreePath>`. This is wrapped in a `try/catch` block to handle cases where the worktree has uncommitted changes.
        c.  It also executes `git branch -d <branchName>` to clean up the associated branch.
        d.  Upon success, it removes the session from its internal map.
    3.  **`runConflictScan`:**
        a.  This method is a pure, read-only check.
        b.  It iterates through every existing `WorktreeSession` in its internal map.
        c.  For each existing session, it performs a simple array intersection between its `changePlan` and the `newChangePlan` provided as an argument.
        d.  If an intersection with one or more files is found, it **immediately** stops scanning and resolves the promise with a `{ status: 'CLASH', ... }` object, detailing which session and which files are in conflict.
        e.  If it successfully iterates through all other sessions without finding any intersections, it resolves the promise with a `{ status: 'CLEAR' }` object.

*   **Mandatory Testing Criteria:**
    *   A "happy path" test must verify that `createWorktree` executes the correct `git worktree add` command and returns a valid `WorktreeSession` object.
    *   A test must verify that `removeWorktree` executes the correct `git worktree remove` and `git branch -d` commands.
    *   An error path test must verify that if the underlying `git` command fails during creation, the promise is rejected with a specific error.
    *   A conflict scan test must verify that `runConflictScan` returns a `CLEAR` status when no other sessions exist.
    *   A conflict scan test must verify that `runConflictScan` returns a `CLASH` status when a new change plan shares even one file with an existing session's plan. The result must correctly identify the conflicting session and file.