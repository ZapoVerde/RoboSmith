# Git Worktree Management in RoboSmith Extension

## Overview

RoboSmith leverages Git worktrees as a foundational architectural component to provide isolated, parallel development sandboxes for AI-assisted code generation and validation workflows. By assigning **one dedicated worktree per extension tab**, RoboSmith enables users to run multiple independent AI chains (e.g., feature toggles, refactors, or prototypes) without risking cross-contamination or state corruption. This approach aligns with the extension's core philosophy of safety, determinism, and hobbyist-friendly automation: Each tab acts as a self-contained "universe" where the AI forges code, tests, and documentation in isolation.

This system is built around the concept of a session's **`changePlan`**: the explicit list of files a workflow intends to modify. Crucially, this `changePlan` is not static; it is a **living list**. It is defined by the user at the start of a session and can be dynamically expanded by the workflow itself via the `Internal:UpdateChangePlan` worker as the AI discovers new files that require modification.

Whenever a session's `changePlan` is updated, the system **automatically triggers a system-wide recalculation**, re-running its conflict scan for all other active sessions. This ensures that the conflict statuses displayed in the UI are always a live, accurate reflection of the entire workspace's state.

To manage contention for shared files, RoboSmith defaults to a **First-In-First-Out (FIFO)** resolution model: The tab that initiated its chain earliest advances first. This preserves assumptions made by early starters, promoting determinism. Users can optionally override this with numeric priorities for flexibility. The Roberto-MCP (R-MCP) slicer serves as the core "conflict detector," mapping the "change plan" directly to its **seed files** input. This creates a simple distinction: seed files are modification targets (high-risk if overlapping), while hopped files are contextual references (low-risk).

To avoid UI overload, signals are decoupled into independent systems (detailed in Section 1.1 below), ensuring each concern (health, overlaps, queues) has its own glanceable element without shared semantics.

## How It Operates
### 1. Initialization and Context Switching

- **Trigger**: The user initiates a new workflow by clicking the `🤖 RoboSmith` item in the VS Code Status Bar and selecting `[+ Create New Workflow...]` from the Quick Pick dropdown.
- **Process**:
  1. The `GitWorktreeManager` service is invoked.
  2. It generates a unique UUID for the new session (e.g., `session-abc-123`).
  3. It executes `git worktree add .worktrees/{uuid} {base-branch}`, creating a fresh, isolated checkout and branch.
  4. The service persists this new session in the extension's `globalState`.
  5. The extension's UI orchestrator then programmatically takes control of the VS Code workspace. It calls `vscode.workspace.updateWorkspaceFolders()` to **replace** the visible workspace folders with a single new root: the URI of the newly created worktree.
  6. Simultaneously, the `files.exclude` setting for the workspace is updated to hide the `.worktrees` container directory, ensuring a clean view.
- **UI Feedback**: The user experiences a seamless, atomic context switch.
  - **Status Bar Navigator**: The text updates to reflect the new, active context (e.g., `🤖 RoboSmith: Task - Implement Login Form`).
  - **File Explorer**: The entire explorer view redraws to show **only** the files for the new worktree. This provides a pure, single-root, and unambiguous environment, completely preventing accidental cross-branch edits.
  - **Main Editor Area**: The "Interactive Mission Control Panel" for the new workflow is opened.

#### 1.1. The Decoupled UI Signaling System

To provide clear, at-a-glance status without causing UI clutter, RoboSmith uses a decoupled signaling system. Each architectural concern (Health, Overlap, etc.) has its own state, which is visualized in specific, dedicated locations. This avoids any single, overloaded "stoplight" and ensures the user always has a precise understanding of each workflow's status.

| System | Primary UI Location (Glanceable Status) | Secondary UI Location (In-Workflow Overview) | Details & Tooltips |
| :--- | :--- | :--- | :--- |
| **Health** | An icon (`🟢`, `🟡`, `🔴`) prefixed to the workflow's name in the **Status Bar Navigator dropdown**. | A color-coded icon in the **Status Ticker** inside the Mission Control Panel. | A tooltip on the icon provides details on the integrity of the worktree (e.g., "Clean," "Uncommitted changes," "Corrupt/locked"). |
| **Overlap** | A text label appended to the description in the **Status Bar Navigator dropdown** (e.g., `[Clash]`). | A text badge in the **Status Ticker**. | Label-based for precision. A tooltip on the label lists the exact conflicting files and the session they conflict with. |
| **Queue** | An icon (`▶️`, `⏳`, `⏸️`, `✅`) prefixed to the workflow's name in the **Status Bar Navigator dropdown**. | An icon in the **Status Ticker**. | Icon-only for indicating flow status (e.g., Running, Queued, Held, Complete). A tooltip provides an ETA or queue position. |
| **Orchestration** | A text tag in the description of the **Status Bar Navigator dropdown** (e.g., `P:1` or `FIFO #2`). | A text tag in the **Status Ticker**. | A non-visual tag for providing explicit hierarchy and sorting information. |

**Example in Status Bar Navigator Dropdown:**

A user clicks the status bar item and sees the following list, instantly understanding the state of all work:

- `My Project (main)`
- `(🟢 ▶️) Task: Implement Login Form`
- `(🟢 ⏳) Task: Refactor API Service [Clash] - FIFO #2`
- `(⏸️) Task: Update Documentation`

This system ensures that the workspace itself remains pure and uncluttered, while providing all necessary supervisory information in a dedicated, purpose-built navigation control.

### 2. No-Overlap Enforcement, Flagging, and Resolution

To prevent "blast radius" issues (e.g., one tab's refactor mutating a file needed by another), RoboSmith enforces strict isolation through proactive, real-time conflict detection. This is not a one-time check but a continuous, interactive process that provides immediate feedback to the user.

- **The Interactive Scan**: The user defines their intended modifications in the **"Change Plan Definition"** UI. As they provide this input, the system runs the conflict scan in real-time against every other active session's `changePlan`. The results are instantly visualized in the read-only **"Conflict Analysis View"**, which shows the complete list of files to be checked (seeds + dependency hops). Each file in this view is color-coded to provide immediate feedback *before* the workflow is launched.

- **The Dynamic `changePlan` & System-Wide Recalculation**: A session's `changePlan` is a living list. When an AI worker determines a new file must be modified, the `Internal:UpdateChangePlan` worker is called. This updates the session's `changePlan` in the central `GitWorktreeManager`. The moment this happens, the manager **re-runs the conflict scan for every other active and queued session**, ensuring all UI signals across the entire application remain a live, accurate reflection of the workspace's state.

- **Flagging Tiers** (Visualized in the UI as described in Section 1.1):
  | Flag | Description | Trigger Example | UI Cue |
  |------|-------------|-----------------|--------|
  | **🟢 Clear** | No `changePlan` intersections; proceed freely. | `NewTab_ChangePlan` has no overlaps with other plans. | Green file entry; "Clear" (No label); `▶️` (Running icon). |
  | **🟡 Clash** | A direct `changePlan` intersection was found. | `src/components/Button.tsx` exists in both the new plan and an already active session's plan. | Amber file entry; `[Clash]` label; `⏳` (Queued icon). |

- **Resolution Paths**: When a `CLASH_DETECTED` status occurs, the system **does not fail**. It triggers an automated resolution flow to ensure safe, deterministic execution. The default model is First-In-First-Out (FIFO) to preserve the assumptions of earlier tasks, with an optional priority override.

| Scenario | Description | Auto-Flow & Leader Pick |
| :--- | :--- | :--- |
| **New Task vs. Active Task** | A new workflow's `changePlan` clashes with a workflow that is already running. | **Deterministic FIFO Queue:** The new task is immediately placed into a "waiting" state. Its UI cue becomes `⏳ Queued`. It will not begin execution until the active, blocking task is completed (merged, discarded, or held). |
| **New Task vs. Held Task** | A new workflow's `changePlan` clashes with a workflow that is in the `Held` state. | **Immediate Block:** The new task is placed in the `⏳ Queued` state. It is blocked until the user manually resolves the `Held` task (either by merging or discarding it). This prevents a new task from modifying files that are pending a code review. |
| **Multiple New Tasks (Race Condition)** | Two or more conflicting tasks are submitted in rapid succession. | **FIFO Sorting:** The `WorktreeQueueManager` sorts the incoming tasks by their initiation timestamp. The earliest task becomes the leader and enters the `▶️ Running` state. All others are placed in the `⏳ Queued` state, forming a line. |

This interactive and dynamic scanning system is the foundational architectural component that guarantees safety and parallelism, allowing the user to confidently define and supervise multiple, potentially overlapping tasks.

### 3. State Persistence and Reconciliation

To ensure robustness against application crashes, restarts, and manual file system changes, the `GitWorktreeManager`'s state is **not ephemeral**. It is persisted between sessions, and a reconciliation process is run on every extension activation to guarantee that the in-memory state is a perfect reflection of the file system's reality.

#### 3.1. Persistence Model: Pointers and Commits

The persistence model is a two-part system designed for lightweight central state and durable, heavy state:

1.  **The Lightweight Pointer Map (in `globalState`):**
    * **The Source of Truth:** A list of managed `WorktreeSession` *pointers* is persisted in VS Code's native, resilient key-value store using the `vscode.ExtensionContext.globalState` API.
    * **Key:** The data is stored under a dedicated key, e.g., `activeWorktreeSessions`.
    * **Contents:** This map is lightweight and **MUST NOT** contain heavy `ExecutionPayload`s. It only stores the minimal pointers: `sessionId`, `branchName`, and `status` (e.g., `Running`, `Held`).

2.  **The Durable Session State (in Git):**
    * **The Source of Truth:** The complete, heavy state of a workflow (the full `ExecutionPayload` chat history, `currentBlockId`, and `returnStack`) is **not** stored in `globalState`.
    * **Process:** Upon a `[⏸️ Finish & Hold Branch]` action, this heavy state is serialized to a file (e.g., `.robo/session.json`) and **committed directly to its corresponding Git branch**.
    * **Reference:** This entire "re-inflatable" process is formally defined in **`docs/architecture/Durable_Session_Persistence.md`**.

This hybrid model ensures the central state is fast and simple, while the complex, heavy state is made durable and portable by storing it as a version-controlled artifact.

#### 3.2. The Startup Reconciliation Loop

On every extension activation, before any other commands are made available, the `GitWorktreeManager` MUST perform a self-healing reconciliation loop to synchronize its **pointer map**.

**The Algorithm:**

1.  **Read the Ground Truth (The File System):**
    * The service uses the `vscode.workspace.fs.readDirectory()` API to get a complete list of all subdirectories currently present in the project's `.worktrees/` folder. This is the list of *actual* local worktrees on disk.

2.  **Read the Cached State (The Extension's Memory):**
    * The service reads its last-known pointer map from `globalState.get('activeWorktreeSessions')`. This is the list of worktrees the extension *thinks* it's managing.

3.  **Identify and Handle "Zombies":**
    * A "zombie" is a directory on disk that is **not** present in the cached state. This indicates a previous crash or an incomplete cleanup.
    * The service identifies these zombies by finding all directories from Step 1 that do not have a corresponding entry in the map from Step 2.
    * **Action:** For V1, the service will log a warning for each zombie found. A future `roboSmith.cleanupWorktrees` command will provide a UI to safely remove them.

4.  **Identify and Handle "Ghosts":**
    * A "ghost" is an entry in the cached state that does **not** have a corresponding directory on disk. This indicates the user manually deleted the folder.
    * The service identifies these ghosts by finding all entries from Step 2 that do not have a corresponding directory in the list from Step 1.
    * **Action:** The service silently and safely removes the ghost entries from its state object. This is a self-healing action.

5.  **Persist the Corrected State:**
    * If any ghosts were removed, the service immediately calls `globalState.update()` to save the newly cleaned-up pointer map, ensuring consistency for the next startup.

6.  **Initialize with Confidence:**
    * Only after this loop is complete is the `GitWorktreeManager` considered fully initialized. [cite_start]Its in-memory `sessionMap` is now a perfect, trusted reflection of reality, and the extension can proceed with normal operations [cite: 1034-1035].

### 4. Execution and Iteration Within the Worktree

- **AI Chain Runtime**: With isolation locked, the automated workflow defined in `workflows.json` operates fully within the tab's worktree. The `Orchestrator` engine executes a sequence of Blocks, which can be AI Workers (for creative tasks) or Internal Workers (for deterministic system tasks), to generate and validate code, tests, and documentation. The definitive specification for the workflow engine's architecture is defined in `docs/Construction/Task 1_3-Specification- The Factory Workflow Engine.md`. The complete catalog of available non-AI actions and workers is specified in `docs/Construction/Internal_Workers_and_Actions.md`, and the core "Test-Fix" self-correction pattern is detailed in `docs/Construction/Task 2_3-Specification- The Automated Test-Fix Cycle.md`.

- **Health Monitoring**: The `GitWorktreeManager` continuously monitors the health of the worktree (e.g., via `git status --porcelain`). Any anomalies, such as uncommitted changes that could block a cleanup operation, are surfaced as warnings in the **Health System**. For example, the Health System may flicker to `🟡` during linting runs or if uncommitted changes are detected.

### 5. Promotion and Cleanup

- **Promotion (Merge/Ship)**: On validation approval, trigger `Promote Tab`:
  1. Final seed intersection audit across trees. **Overlap Label: Final "Clear" check.**
  2. Squash commits (`git merge --squash`), push PR/branch.
  3. User-only commit gate: No auto-commits—your "only the user commits" rule preserved.
- **Cleanup**:
  - Auto: On tab close, prompt "Prune worktree?" → `git worktree remove {path}` + dir rm. **Health System: 🔴 if prune fails.**
  - Manual: `roboSmith.cleanupWorktrees` command scans `.worktrees/`, orphans vs. active sessions, and bulk-prunes with confirmations.
  - Zombie Sweep: Cron-like (every 2h) for stalled/uncommitted trees >24h old. **Triggers Health System 🟡 across affected tabs.**

## Tradeoffs

| Aspect          | Benefits                                                                                                                           | Drawbacks                                                                                 | Mitigation                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Isolation**   | True parallelism; slicer seeds ensure stable contexts.                                                                             | Increased Git ops (add/remove per tab).                                                   | Transactional execa wraps; sparse-checkout for lean trees.                 |
| **Performance** | Fast inits (~O(1)); array intersections are O(n).                                                                                  | Disk/RAM bloat on 10+ tabs (e.g., 1GB+ for large repos); **minor label render overhead.** | Cleanup hooks; VM resource tuning (Proxmox ballooning); lazy updates.      |
| **Workflow**    | Visual sandboxes match "one feature per tab"; FIFO preserves early assumptions for determinism; **labels/icons reduce scan time.** | Wait queues add ~10-30 min friction on seed overlaps.                                     | Polling efficiency; dashboard for multi-tab oversight; priority overrides. |
| **Complexity**  | Simplified flags/seeds feel secure/simple—no intent analysis or shadow copies; **independent systems prevent overload.**           | Edge cases (e.g., submodules unsupported).                                                | Fallbacks (shallow clones); config whitelists for globals.                 |

## Mitigations and Best Practices

- **Error Handling**: All Git commands via `execa` in try/catch; transform failures to user-friendly messages (e.g., "Worktree locked—retry in 1 min"). **Route to Health System 🔴.**
- **Configurability**: `settings.json` toggles: `worktrees.autoWait: true`, `slicerHops: 2`, `overlapThreshold: 1` (files before amber), `queueMode: 'fifo'` (default; or 'priority'), **`ui.showOrchestration: true`** (toggle tags).
- **Testing**: Unit tests mock `simple-git` for seed intersections; E2E via VS Code's integration suite on sample repos; **UI smoke tests for system independence.**
- **Scalability Note**: Optimized for 3-10 tabs (hobby sprints); for larger, consider session-based pooling **with collapsible summaries**.

This system transforms Git worktrees from a "pro-only" tool into an accessible safety net, empowering non-coders to direct complex builds with confidence. For implementation details, see `src/services/GitWorktreeManager.ts`.
