
# **Specification: Internal Workers & Actions**

## 1. High-Level Summary

This document serves as the definitive, detailed specification for all non-AI, deterministic "Internal Workers" and the core "Actions" available in the RoboSmith workflow engine. These components are the foundational building blocks for performing system-level tasks like file I/O, test execution, and session management.

This specification adheres to the protocol defined in `docs/Construction/workflow/spec_contract.md`. Each component definition includes its architectural role, core responsibilities, a formal contract, detailed behavioral logic, and mandatory testing criteria.

## 2. The Action DSL (Domain Specific Language)

This section formally defines the set of atomic commands that control the flow of the `Orchestrator`. These actions are specified in a `Block`'s `transitions` table and are the exclusive mechanism for state transitions.

| Action | Syntax | Description |
| :--- | :--- | :--- |
| **`JUMP`** | `JUMP:TargetBlockId` | Immediately transitions execution to the specified target block. This is the primary mechanism for linear or branching control flow. |
| **`CALL`** | `CALL:TargetNodeId` | Pushes a return address to the internal `ReturnStack` and then performs a `JUMP` to the `entry_block` of the target node. This is used for invoking subroutines. |
| **`RETURN`** | `RETURN` | Pops the last address from the `ReturnStack` and performs a `JUMP` to it, allowing a subroutine to return control to its caller. |
| **`HALT_AND_FLAG`**| `HALT_AND_FLAG` | Pauses the `Orchestrator`'s execution loop, puts the workflow into a `isHalted: true` state, and awaits an external `resume()` command from the user. |

## 3. The Internal Worker Catalog

---

### 3.1 `Internal:TestRunner`

*   **Architectural Role:** `Utility` (Stateless Façade)
*   **Core Responsibilities:**
    *   To act as a simple, reliable wrapper around the project's configured test command (e.g., `vitest`).
    *   To execute the test suite within the isolated context of the current Git Worktree.
    *   To capture all `stdout` and `stderr` output from the test process for debugging.
    *   To parse the outcome (pass or fail) based on the process exit code.
    *   To emit a clear, binary signal (`SIGNAL:SUCCESS` or `SIGNAL:FAILURE`) and package the raw test output into the `ExecutionPayload`.
*   **Contract (Input & Output):**
    This worker is invoked by the Orchestrator with the current memory context.
    ```typescript
    interface TestRunnerInput {
      // It specifically requires the worktree_path from the system metadata.
      system_metadata: { worktree_path: string; };
    }

    interface TestRunnerOutput {
      signal: 'SIGNAL:SUCCESS' | 'SIGNAL:FAILURE';
      new_payload: ExecutionPayload; // Will contain the TestResultSegment on failure.
    }
    ```
*   **Detailed Behavioral Logic (The Algorithm):**
    1.  The `Internal:TestRunner` Worker is invoked.
    2.  It retrieves the `worktree_path` from the `System Metadata` layer of the provided context.
    3.  It spawns the configured test runner (e.g., `vitest run --reporter=verbose`) as a child process, setting the `cwd` (current working directory) to the `worktree_path`.
    4.  It captures and buffers all data from the child process's `stdout` and `stderr` streams into a single, comprehensive log string.
    5.  It waits for the child process to exit and captures its exit code.
    6.  **If the exit code is `0`:** The Worker returns `{ signal: 'SIGNAL:SUCCESS', new_payload: [...] }`. It must add a `TestResultSegment` with `outcome: 'PASS'`.
    7.  **If the exit code is non-zero:** The Worker returns `{ signal: 'SIGNAL:FAILURE', new_payload: [...] }`. It must create a `TestResultSegment` with `outcome: 'FAIL'` and the full, captured log as its content, and add this segment to the `ExecutionPayload`.
*   **Mandatory Testing Criteria:**
    *   The worker must correctly spawn a child process in the specified worktree directory.
    *   It must emit `SIGNAL:SUCCESS` when the mocked child process exits with code `0`.
    *   It must emit `SIGNAL:FAILURE` and include the complete, captured error log in the payload when the mocked child process exits with a non-zero code.
    *   It must gracefully handle a scenario where the test command itself cannot be found or fails to start.

---

### 3.2 `Internal:FileSystemWriter`
*   **Architectural Role:** `Utility` (I/O Handler)
*   **Core Responsibilities:**
    *   To be the single, authoritative mechanism for writing AI-generated content to disk.
    *   To operate safely within the boundaries of the current Git Worktree.
    *   To parse the `ExecutionPayload` to find all designated "write" segments.
    *   To handle file I/O operations asynchronously and robustly.
*   **Contract (Input & Output):**
    ```typescript
    interface FileSystemWriterInput {
      // Expects specific segments in the payload from a preceding AI block.
      execution_payload: Array<{
        type: 'CODE_OUTPUT' | 'DOCUMENTATION_OUTPUT';
        // Content should be a structured object or string that includes the target path.
        content: { filePath: string; fileContent: string; };
      }>;
      system_metadata: { worktree_path: string; };
    }

    interface FileSystemWriterOutput {
      signal: 'SIGNAL:SUCCESS' | 'SIGNAL:FAILURE';
      new_payload: ExecutionPayload; // Payload is typically passed through unchanged.
    }
    ```
*   **Detailed Behavioral Logic (The Algorithm):**
    1.  The `Internal:FileSystemWriter` is invoked.
    2.  It retrieves the `worktree_path` from `System Metadata`.
    3.  It filters the `ExecutionPayload` to find all `ContextSegment` objects with a `type` of `CODE_OUTPUT` or similar.
    4.  It iterates through these segments, parsing the `content` of each to get the relative `filePath` and the `fileContent`.
    5.  For each file, it constructs an absolute path by joining `worktree_path` and `filePath`.
    6.  It performs an asynchronous `writeFile` operation. If any write fails (e.g., due to permissions), it immediately halts the loop.
    7.  **If all writes succeed:** The Worker returns `{ signal: 'SIGNAL:SUCCESS', ... }`.
    8.  **If any write fails:** The Worker returns `{ signal: 'SIGNAL:FAILURE', ... }` and should add an `ERROR` segment to the payload with the I/O error details.
*   **Mandatory Testing Criteria:**
    *   The worker must correctly construct absolute file paths inside the worktree.
    *   It must successfully call a mocked file system API with the correct path and content.
    *   It must emit `SIGNAL:FAILURE` if the mocked file system API throws an error.
    *   It must handle multiple file-writing segments in a single payload.

---

### 3.3 `Internal:UpdateChangePlan`
*   **Architectural Role:** `Utility` (Session State Mutator)
*   **Core Responsibilities:**
    *   To act as the bridge between the `Orchestrator` and the `GitWorktreeManager`.
    *   To update the current session's `changePlan` with newly discovered files.
    *   To trigger the system-wide conflict recalculation process.
*   **Contract (Input & Output):**
    ```typescript
    interface UpdateChangePlanInput {
      // Expects a specific segment type from a preceding AI block.
      execution_payload: Array<{
        type: 'NEW_FILES_IDENTIFIED';
        content: string[]; // An array of new relative file paths.
      }>;
    }

    interface UpdateChangePlanOutput {
      signal: 'SIGNAL:SUCCESS';
      new_payload: ExecutionPayload; // Payload is passed through.
    }
    ```
*   **Detailed Behavioral Logic (The Algorithm):**
    1.  The `Internal:UpdateChangePlan` worker is invoked.
    2.  It filters the `ExecutionPayload` to find the `NEW_FILES_IDENTIFIED` segment.
    3.  It extracts the array of new file paths from the segment's `content`.
    4.  It calls the `GitWorktreeManager.addToChangePlan(newFiles)` method (or equivalent).
    5.  The `GitWorktreeManager` is responsible for appending the files, persisting the new state, and triggering the global conflict scan.
    6.  The worker waits for the call to complete and then returns `{ signal: 'SIGNAL:SUCCESS', ... }`.
*   **Mandatory Testing Criteria:**
    *   The worker must correctly parse the file list from a mock `ExecutionPayload`.
    *   It must call the correct method on a mocked `GitWorktreeManager` instance with the exact list of new files.
    *   It must always emit `SIGNAL:SUCCESS`.

---

### 3.4 `Internal:RunLinter`
*   **Architectural Role:** `Utility` (Stateless Façade)
*   **Core Responsibilities:**
    *   To enforce code quality by running a linting tool (e.g., ESLint).
    *   To capture and structure the linter's output for potential automated fixing.
*   **Contract (Input & Output):**
    ```typescript
    interface RunLinterInput {
      system_metadata: { worktree_path: string; };
    }

    interface RunLinterOutput {
      signal: 'SIGNAL:SUCCESS' | 'SIGNAL:FAILURE';
      new_payload: ExecutionPayload; // Will contain LINT_RESULT on failure.
    }
    ```
*   **Detailed Behavioral Logic (The Algorithm):**
    1.  The `Internal:RunLinter` worker is invoked.
    2.  It retrieves the `worktree_path` from `System Metadata`.
    3.  It spawns the project's lint command (e.g., `eslint . --format=json`) as a child process with the `cwd` set to the `worktree_path`. Using a JSON reporter is strongly preferred.
    4.  It captures `stdout`/`stderr` and waits for the process to exit.
    5.  **If exit code is `0`:** It returns `{ signal: 'SIGNAL:SUCCESS', ... }`.
    6.  **If exit code is non-zero:** It returns `{ signal: 'SIGNAL:FAILURE', ... }` and adds a `LINT_RESULT` segment to the payload containing the structured JSON output of the errors.
*   **Mandatory Testing Criteria:**
    *   The worker must emit `SIGNAL:SUCCESS` for a mocked process with exit code `0`.
    *   It must emit `SIGNAL:FAILURE` for a non-zero exit code.
    *   On failure, it must correctly parse and add the linter's JSON output to the `ExecutionPayload`.

---

### 3.5 `Internal:RunBuilder`
*   **Architectural Role:** `Utility` (Stateless Façade)
*   **Core Responsibilities:**
    *   To perform a full project compilation or build (e.g., `npm run build`).
    *   To act as a final, high-level integration check.
*   **Contract (Input & Output):**
    ```typescript
    interface RunBuilderInput {
      system_metadata: { worktree_path: string; };
    }

    interface RunBuilderOutput {
      signal: 'SIGNAL:SUCCESS' | 'SIGNAL:FAILURE';
      new_payload: ExecutionPayload; // Will contain BUILD_RESULT on failure.
    }
    ```
*   **Detailed Behavioral Logic (The Algorithm):**
    1.  The `Internal:RunBuilder` worker is invoked.
    2.  It retrieves the `worktree_path` from `System Metadata`.
    3.  It spawns the project's build command as a child process with the `cwd` set to the `worktree_path`.
    4.  It captures all `stdout` and `stderr` into a single log string.
    5.  **If exit code is `0`:** It returns `{ signal: 'SIGNAL:SUCCESS', ... }`.
    6.  **If exit code is non-zero:** It returns `{ signal: 'SIGNAL:FAILURE', ... }` and adds a `BUILD_RESULT` segment to the payload containing the complete build log.
*   **Mandatory Testing Criteria:**
    *   The worker must emit `SIGNAL:SUCCESS` for a mocked process with exit code `0`.
    *   It must emit `SIGNAL:FAILURE` for a non-zero exit code.
    *   On failure, it must add the complete, raw build log to the `ExecutionPayload`.