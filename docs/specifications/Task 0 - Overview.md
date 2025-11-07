
---

### **Task 0: V1 Implementation Overview (Definitive, Non-Truncated)**

---

### **Phase 1: Foundational Services & Headless Operation**

**Goal:** Establish the core, non-UI backend services and prove they can be initialized and operated in a headless environment. This phase focuses on the singleton services that form the application's backbone.

*   **1.1. Implement the `ApiPoolManager`:**
    *   Build the "failover-driven round-robin" logic for managing multiple API keys.
    *   Write integration tests to prove the failover mechanism works, fulfilling **V1 Success Criterion 5.4**.

*   **1.2. Implement the `ContextPartitionerService`:**
    *   Create the service wrapper around the pre-compiled `roberto-mcp` binary, including logic to select the correct binary for the host OS and architecture.

*   **1.3. Establish the WebView Event Bus:**
    *   Finalize the shared `Message` type in `packages/client/src/shared/types.ts`.
    *   Implement the central `handleEvent` orchestrator to route incoming messages to the correct services.

**By the end of this phase, the extension will have a fully functional, testable backend core, ready for the main workflow engine.**

---

### **Phase 2: The "Factory" - The Block/Node Workflow Engine**

**Goal:** Implement the core `Orchestrator` engine that drives the system. This phase focuses on making the manifest-driven workflow a reality.

*   **2.1. Build the `workflows.json` Parser & Validator:**
    *   Create the `WorkflowService` responsible for locating, parsing, and validating the `.vision/workflows.json` manifest against a predefined JSON schema.

*   **2.2. Implement the Orchestrator Engine:**
    *   Develop the central engine that executes the parsed manifest with perfect fidelity, following the **Block Execution -> Signal -> JUMP** model.
    *   Implement the **6-Layer Memory Model** and the **`payload_merge_strategy`** logic for assembling the `ExecutionPayload`.
    *   Build the `ActionHandler` to process the atomic commands: **`JUMP`**, **`CALL`**, and **`RETURN`**.

*   **2.3. Develop the Test/Fix Cycle:**
    *   Implement the logic to execute a `RunTests` Block and use its `SIGNAL:FAILURE` output to correctly execute a `JUMP` to a `Troubleshoot` Node, proving the self-correction loop.

**By the end of this phase, the extension will be able to run a complete, complex workflow from a test script, fulfilling V1 Success Criteria 5.1 and 5.2.**

---

### **Phase 3: The "Workbench" - Git Worktree Isolation & Safety**

**Goal:** Implement the complete Git Worktree management system as defined in the authoritative architectural documents. This phase delivers the safety, parallelism, and conflict resolution essential to the user experience.

*   **3.1. Implement the `GitWorktreeManager` Service:**
    *   Build the core functions for creating, managing, and cleaning up worktrees for each user session.

*   **3.2. Develop the Proactive Conflict Detection System:**
    *   Implement the fast, reliable "seed file" intersection check (`runConflictScan`) that runs before a new workflow is initiated to detect high-risk `CLASH` scenarios.

*   **3.3. Build the FIFO Queuing and Auto-Resolution Logic:**
    *   **Implement the `WorktreeQueueManager` service.**
    *   Implement the First-In-First-Out (FIFO) waiting queue for all tasks that are flagged with a `CLASH` status, ensuring deterministic and safe resolution of conflicts.

**By the end of this phase, the backend will fully support parallel, isolated operations with a deterministic and safe conflict resolution strategy.**

---

### **Phase 4: UI/UX Implementation - The Supervisor's Cockpit**

**Goal:** Build the Svelte-based WebView frontends that allow the user to control and observe the powerful backend systems.

*   **4.1. Construct the Multi-Session "Workbench" UI:**
    *   Develop the primary sidebar panel capable of rendering a tab for each active session, including the UI for real-time status display (Health, Overlap, Queue).

*   **4.2. Build the "Planning Session" and `ApiKeyManager` Views:**
    *   **Create the reactive Svelte component that visualizes the real-time state of the `Orchestrator` engine (the `ExecutionPayload` "chatbox").**
    *   Integrate the existing `ApiKeyManager.svelte` component.

*   **4.3. Implement the `Integration Panel`:**
    *   Build the dedicated WebView panel that appears upon task completion.
    *   Implement the primary `[ 🚀 Open Terminal in Worktree ]` action, fulfilling **V1 Success Criterion 5.3**.

**By the end of this phase, the project will have a fully functional and interactive user interface.**

---

### **Phase 5: V1 Feature Completion & Final Validation**

**Goal:** Implement the remaining V1 features, conduct end-to-end testing, and prepare the extension for its first release.

*   **5.1. Implement `Quick Fix Mode`:**
    *   Register the `roboSmith.quickFix` command and implement the temporary WebviewPanel for chat interaction, applying the final changes as a `vscode.WorkspaceEdit`.

*   **5.2. Implement the `AI Call Inspector`:**
    *   Develop the UI to browse, view, and replay logged AI calls from the `.vision/logs/` directory.
    *   Implement the `[ 🔬 Re-run & Compare ]` functionality, fulfilling **V1 Success Criterion 5.5**.

*   **5.3. Final Validation and Documentation:**
    *   Perform comprehensive end-to-end testing, verifying all V1 Success Criteria.
    *   Finalize user-facing documentation.

---

### **Phase 6: Future Development (Post-V1)**

**Goal:** Plan for the next major version by tackling features that were explicitly excluded from V1. This phase focuses on making the entire RoboSmith system not just usable, but truly accessible and powerful for a wider audience.

*   **6.1. The "Workflow Studio": A Graphical Editor**
    *   **Vision:** To fully realize the "Principle of Apparent Simplicity" by providing a visual, drag-and-drop interface for designing, editing, and managing the `workflows.json` manifest. This "Workflow Studio" will be a dedicated WebView panel that transforms the text-based configuration into a "living Visio diagram" that users can directly manipulate.
    *   **Core Features:**
        *   **Visual Canvas:** A main canvas where users can build their workflow as a flowchart.
        *   **Block Palette:** A toolbar containing all available Block types (e.g., `AI Coder`, `Test Runner`, `File Writer`) that can be dragged onto the canvas.
        *   **Interactive Connectors:** Users can draw arrows between blocks to define Transitions.
        *   **Inspector Panel:** Selecting a block or an arrow will open an inspector panel.
            *   Selecting a **block** allows the user to configure its properties (e.g., which `worker` to use).
            *   Selecting an **arrow** allows the user to define the `on_signal` keyword that triggers that specific state transition.
    *   **The Manifest as the Source of Truth:** The Studio is a user-friendly abstraction. When a user saves their work, the visual graph is compiled into the structured, version-controllable `workflows.json` file. This ensures the system remains fundamentally text-based and auditable.

*   **6.2. The Workflow Library: Save and Recall Workflows**
    *   **Vision:** To allow users to create a reusable, personal library of their most effective automation patterns.
    *   **Core Features:**
        *   **`[Save to Library]`:** A function within the Workflow Studio that saves the current visual workflow as a named template (e.g., "TDD Loop with Documentation") to a global storage location managed by the extension.
        *   **`[Load from Library]`:** When creating a new workflow, the user can choose to start from a blank canvas or from one of their saved templates, instantly bootstrapping their automation process.

*   **6.3. Architectural Review Layer:**
    *   Implement the "Scaffolding" and "Refactoring Proposal" features, which insert a manual architectural sign-off step before implementation.

*   **6.4. Broader SCM Support:**
    *   Investigate and implement support for non-Git projects (e.g., Perforce, SVN) or projects with no version control, likely using a simple file-copying sandbox model as a fallback.