# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   The primary objective is to construct the complete, user-facing supervisory interface for the RoboSmith engine. This work will translate the powerful but headless backend services into a simple, intuitive, and safe "director's chair" experience for the user, fulfilling the project's core UX vision.

### **1.1 Detailed Description**
*   This architecture defines a cohesive three-part user interface system. First, a **Status Bar Navigator** will serve as the single, unambiguous entry point for creating and switching between isolated workflow environments. Second, an **Interactive Mission Control Panel** will act as a "living Visio diagram," providing a real-time, graphical visualization of the workflow engine's execution. Finally, upon a workflow's successful completion, an **Integration Panel** will be presented, giving the user clear, final control to validate, accept, reject, or hold the generated work. These components will work in concert to fully abstract the underlying complexity of the system.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
    *   **Principle of Apparent Simplicity:** All features, no matter how complex, must be presented to the user in a simple, intuitive, and safe manner. The system, not the user, bears the burden of complexity.
    *   **Clear Separation of Worlds:** The user must always be in one of two unambiguous states: their main project ("Lobby") or a focused workflow sandbox ("Cockpit"). There is no middle ground.
    *   **Reactive, "Dumb" UI:** The frontend is a reactive view that renders state objects provided by the backend. The authoritative source of truth for all application state resides in the Extension Host.
    *   **Management by Exception:** The user's role is supervisory. The system operates autonomously by default and only requires user input upon explicit failure or a pre-configured manual gate.
*   **Blueprint-Specific Principles:**
    *   **Exclusive Navigation Gateway:** All creation of and navigation between workflows MUST be initiated from the Status Bar Navigator. No other UI shall provide this function.
    *   **Atomic, Single-Root Workspace:** The VS Code workspace, particularly the File Explorer, MUST always be programmatically managed to display a single, pure root: either the main project or one specific worktree. This is non-negotiable.
    *   **On-Demand Transparency (The "Glass Box"):** Detailed information about a workflow step (context, conversation) is not shown by default. It is revealed on-demand when the user explicitly selects a block in the Mission Control Panel, populating the Inspector Panels.
    *   **Decoupled Status Signaling:** The health, conflict status, and queue position of a workflow are architecturally separate concerns and MUST be visualized using distinct, independent indicators (icons and labels) to prevent ambiguity.

### **3. Architectural Flows**
*   **User Flow:**
    1.  The user begins in their main project view, the "Lobby." The only UI element is a clean status bar item indicating the current context.
    2.  The user clicks the status bar item, opening the "Doorway"—a native dropdown navigator. This navigator lists the main project, all active workflows, and a command to create a new one.
    3.  Upon selecting "Create New Workflow," the user names the task. The system instantly creates the isolated backend sandbox and atomically transforms the entire VS Code workspace to show *only* the new worktree's contents.
    4.  The user is now in the "Cockpit"—the Interactive Mission Control Panel appears, displaying a flowchart of the workflow. They supervise as the active block is highlighted and a "lit path" animates the transitions between steps.
    5.  If curious about a specific step, the user clicks its block in the diagram. This action instantly populates the bottom "Inspector Panels" with the exact context and conversation for that step, providing on-demand transparency.
    6.  When the workflow completes, the Mission Control Panel is replaced by the focused Integration Panel. The user's primary action is to open a terminal scoped directly into the worktree to validate the changes.
    7.  The user makes their final decision: Accept (merge and cleanup), Reject (discard and cleanup), or Hold (preserve for later).
    8.  Upon making a choice that cleans up the worktree, the workspace atomically transforms back to the "Lobby," restoring the main project view. The user journey is complete.
*   **Data Flow:**
    1.  All authoritative state originates in the backend services (e.g., the `GitWorktreeManager` holds the list of all sessions; the `Orchestrator` holds the execution state of a single workflow).
    2.  When the UI needs to be updated (e.g., on activation or after a state transition), the backend assembles a single, comprehensive `WorkflowViewState` object.
    3.  This state object is sent as a payload in a message over the asynchronous `postMessage` event bus to the WebView.
    4.  The Svelte components in the WebView, being purely reactive, receive this new state object as a prop and re-render the UI to reflect it. There is no local state cache in the UI; it is a direct reflection of the backend's message.
    5.  User interactions in the UI (e.g., clicking a block, clicking a button in the Integration Panel) dispatch new, distinct messages back to the Extension Host.
    6.  The backend's central event handler receives these messages and routes them to the appropriate service (`Orchestrator`, `GitWorktreeManager`) to trigger the next logical action, beginning the cycle again.
*   **Logic Flow:**
    1.  A user's click on the Status Bar Navigator triggers a command. The command handler's logic fetches the latest session list from the `GitWorktreeManager` service and formats it into `NavigatorItem` objects for display.
    2.  The user's selection from the navigator dropdown provides a session ID. The logic uses this ID to retrieve the corresponding worktree's file path.
    3.  This file path is then used as an argument in a call to the `vscode.workspace.updateWorkspaceFolders()` API, which performs the logical workspace switch.
    4.  Within the `Orchestrator`'s execution loop, after every state transition, a `publishState` method is called. This logic assembles the current `WorkflowViewState` and posts it to the WebView.
    5.  When the `Orchestrator`'s execution loop terminates successfully, it emits a final completion event. A listener for this event triggers the logic to show the Integration Panel, passing it the necessary details (session ID, branch name).
    6.  A click on the `[Accept and Merge]` button in the Integration Panel sends a message that triggers a logical sequence in the backend: call the `GitWorktreeManager` to execute the merge commands, then call it again to execute the cleanup commands, and finally trigger the workspace switch back to the main project.

### **4. Overall Acceptance Criteria**
*   The **Status Bar Navigator** must be the sole and fully functional mechanism for a user to create a new workflow, switch between active workflows, and return to the main project view.
*   The workspace view, including the VS Code File Explorer, must **atomically and correctly** update to show only the single root directory corresponding to the context selected in the Navigator.
*   The **Interactive Mission Control Panel** must render a graphical representation of the workflow manifest and accurately reflect the real-time status of the `Orchestrator` engine, including animating the "lit path" as transitions occur.
*   Upon successful completion of a workflow, the **Integration Panel** must automatically appear.
*   The `[Open Terminal in Worktree]` button on the Integration Panel must successfully create a new VS Code terminal whose current working directory is the correct, isolated path of the completed worktree, fulfilling **V1 Success Criterion 5.3**.
*   All UI components must be styled using VS Code's theme variables to ensure a native look and feel that respects the user's current theme.