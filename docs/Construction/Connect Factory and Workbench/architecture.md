# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   The primary objective is to refactor the core execution pipeline to make the `Orchestrator` engine "environment-aware." This change is necessary to fully connect the "Factory" (workflow engine) with the "Workbench" (worktree management system), ensuring that all automated file and process operations occur safely within their designated isolated sandboxes.

### **1.1 Detailed Description**
*   This architectural refactoring involves updating the core data contract for a unit of work (the `WorkOrder`) to include the file system path of the isolated Git worktree where the work should be performed. This change will propagate through the vertical execution stack. The `EventHandler` will be modified to pass the `worktreePath` from a newly created `WorktreeSession` into the `Orchestrator`. The `Orchestrator` will, in turn, be updated to accept this path and include it in all `WorkOrder` objects it generates for its workers. Finally, all internal workers that perform I/O (such as writing files or running tests) will be modified to use this path as their current working directory, ensuring their actions are correctly scoped.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
*   **Robustness:** This change directly enhances robustness by ensuring that parallel workflows cannot interfere with each other's file system operations, preventing race conditions and data corruption. [cite: docs/architecture/RoboSmith_spec.md]
*   **Safety via Isolation:** This is the final implementation step of this principle. It ensures that the file modification tasks, which are orchestrated by the `Orchestrator`, are strictly executed within the isolated Git Worktree provided by the `GitWorktreeManager`. [cite: docs/architecture/GitWorktree_System.md]
*   **Separation of Concerns:** The `Orchestrator`'s concern remains executing the *what* (the manifest steps), while the `GitWorktreeManager`'s concern is providing the *where* (the `worktreePath`). This refactor allows the `Orchestrator` to receive the "where" as a parameter without needing to own the logic for creating it. [cite: docs/architecture/RoboSmith_spec.md]

*   **Blueprint-Specific Principles:**
*   The `WorkOrder` data contract MUST be the single source of truth for passing the `worktreePath` context to downstream workers.
*   The `Orchestrator`'s primary execution method MUST be updated to accept the `worktreePath` as an argument; it MUST NOT attempt to discover this path itself.
*   All internal workers that perform file system or child process operations MUST use the provided `worktreePath` as their current working directory (`cwd`).

### **3. Architectural Flows**
*   **User Flow:**
*   The user flow is entirely unaffected by this change. This is a purely internal architectural refactoring to enforce safety. The user will continue to interact with the system in exactly the same way, but the underlying operations will now be correctly and safely isolated.
*   **Data Flow:**
*   The `WorktreeQueueManager` resolves its promise, returning a `WorktreeSession` data object containing the `worktreePath` string to the `EventHandler`.
*   The `EventHandler` extracts the `worktreePath` string and passes it as an argument to the `Orchestrator`'s primary execution method.
*   The `Orchestrator`, during its execution loop, constructs a `WorkOrder` data object for the current block. This object now contains the `worktreePath` string, along with the context payload and worker name.
*   The `WorkOrder` data object is passed to the `ApiPoolManager`.
*   The `ApiPoolManager` passes the complete `WorkOrder` data object to the designated internal worker (e.g., `Internal:TestRunner`).
*   The `Internal:TestRunner` worker receives the `WorkOrder` object and extracts the `worktreePath` string from it for its own use.
*   **Logic Flow:**
*   The `EventHandler` successfully obtains a `WorktreeSession` after a task is cleared by the queue.
*   The handler's logic is updated to invoke the `Orchestrator`'s execution method with two arguments: the `nodeId` to start from, and the `worktreePath` from the session.
*   The `Orchestrator`'s internal logic is updated to store this `worktreePath` in its state for the duration of the run.
*   When preparing to execute a block, the `Orchestrator`'s logic now includes adding the stored `worktreePath` to the `WorkOrder` object it assembles.
*   The `ApiPoolManager`'s logic is updated to handle the new `WorkOrder` shape, passing it through to the worker function.
*   The internal worker's logic (e.g., `Internal:FileSystemWriter`) is updated to read the `worktreePath` from the `WorkOrder` it receives and use that path to construct the absolute file path for its write operation, ensuring the file is written inside the correct sandbox.

### **4. Overall Acceptance Criteria**
*   The `WorkOrder` data contract must be successfully updated to include the `worktreePath` property.
*   The `Orchestrator`'s primary execution method must be refactored to accept the `worktreePath` as a required argument.
*   The `EventHandler` must be refactored to correctly pass the `worktreePath` from the `WorktreeSession` to the `Orchestrator`.
*   All internal workers that interact with the file system or spawn child processes must be refactored to correctly use the `worktreePath` provided in the `WorkOrder` as their current working directory.
*   An end-to-end test must successfully demonstrate that a file-writing operation initiated by the `Orchestrator` and executed by an internal worker occurs within the isolated worktree directory, not the main project root.
*   All affected unit and integration tests must be updated to reflect the new method signatures and data contracts, and all test suites must pass.