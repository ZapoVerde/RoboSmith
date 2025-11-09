# Architecture: Durable, Re-inflatable Sessions

## 1. High-Level Summary & Rationale

This document defines the architecture for **Durable, Re-inflatable Sessions**. The core principle is that a RoboSmith workflow's complete state is a durable, portable artifact, just like the code it generates.

The state is **not** tied to the local VS Code UI. Instead, the `Orchestrator`'s full memory (`ExecutionPayload`, `currentBlockId`, `returnStack`) is serialized and **committed to the session's Git branch**.

This provides three primary benefits:
* **Durable & Interruptible:** A user can "Hold" a workflow, shut down VS Code, and re-open it days later, perfectly "re-inflating" the session from where it left off.
* **Lightweight State:** The central VS Code `globalState` remains small and fast, as it only stores pointers (like the branch name), not the heavy `ExecutionPayload`s.
* **Portable & Forkable:** Since the state is in Git, the session can be checked out on another machine, or forked to create experimental troubleshooting timelines.

---

## 2. The Architectural Flow

This system is activated by the "Hold" and "Resume" actions, which replace the old "ephemeral" pause.

### 2.1. The "Save (Hold)" Flow

This flow is triggered when the user clicks the `[⏸️ Finish & Hold Branch]` button on the **Integration Panel**.

1.  **Serialize State:** The `Orchestrator` instance for that session serializes its entire runtime state (the full `ExecutionPayload`, the `currentBlockId`, and the `returnStack`) into a JSON object.
2.  **Write to Worktree:** The `GitWorktreeManager` takes this JSON and writes it to a file *inside* the session's worktree (e.g., `.robo/session.json`).
3.  **Commit State:** The `GitWorktreeManager` executes Git commands to `add .robo/session.json` and `commit -m "RoboSmith: Pausing session"`.
4.  **Update Pointer:** The `GitWorktreeManager` updates its `globalState` (the central pointer list) to mark that session's `status` as `Held`.
5.  **Cleanup:** The `GitWorktreeManager` cleans up the *local* Git worktree directory (`git worktree remove ...`). The branch, containing the code *and* the session state, is now safely stored.

### 2.2. The "Re-inflate (Resume)" Flow

This flow is triggered when a user selects a `[⏸️ Held]` task from the **Status Bar Navigator**.

1.  **Re-create Worktree:** The `GitWorktreeManager` checks out the corresponding branch into a new, local Git worktree.
2.  **Read State File:** It reads and parses the `.robo/session.json` file from the newly created worktree.
3.  **Instantiate Orchestrator:** A *new* `Orchestrator` instance is created.
4.  **Re-hydrate State:** The new `Orchestrator` is "re-hydrated" with the `ExecutionPayload`, `currentBlockId`, and `returnStack` from the saved file.
5.  **Switch Context:** The extension switches the VS Code workspace to the re-created worktree and displays the **Intervention Panel**, now fully populated with the restored chat history and state.

## 3. Data Contract: DurableSessionState

This file (`.robo/session.json`) stores the complete, "re-inflatable" state of a paused Orchestrator. The following TypeScript interface defines its exact shape.

```typescript
import type { ExecutionPayload } from '../shared/types';

/**
 * @id docs/architecture/Durable_Session_Persistence.md#DurableSessionState
 * @description
 * Defines the complete, serializable state of a paused workflow.
 * This is the data that is written to `.robo/session.json` and
 * committed to the session's branch.
 */
export interface DurableSessionState {
  /**
   * The "program counter" of the Orchestrator. This is the ID of
   * the block that will be executed *next* when the session is
   * re-inflated (e.g., 'Core_Validate__RunTests').
   */
  currentBlockId: string | null;

  /**
   * The Orchestrator's call stack, which is essential for
   * resuming from a nested 'CALL' action.
   */
  returnStack: string[];

  /**
   * The entire, ordered "chat history" of the workflow, including
   * all automated outputs, scraped errors, and human interventions.
   */
  executionPayload: ExecutionPayload;

  /**
   * A "bill of materials" for the session, containing all the
   * aggregate statistics for observability.
   */
  sessionStats: {
    totalTokensUsed: number;
    totalFilesWritten: number;
    totalLinesOfCode: number;
    modelsUsed: string[];
    totalDurationMs: number; // Aggregate of all AI/worker latencies
  };
}
```