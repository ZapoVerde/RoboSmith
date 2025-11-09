
---

# **Specification: The Status Bar Navigator**

## 1. High-Level Summary

This specification defines the primary user interface for navigation and context switching in RoboSmith: the **Status Bar Navigator**. This component is the direct implementation of the "Principle of Apparent Simplicity" and the "Clear Separation of Worlds."

Its core purpose is to act as the single, dedicated, and unambiguous "doorway" between the user's familiar main project view (the "Lobby") and the isolated, focused views for each automated workflow. It provides at-a-glance status information for all workflows without cluttering the main workspace and ensures that all context switches are deliberate, safe, and intuitive. This component replaces the previous concept of a dedicated sidebar "Workbench Panel."

## 2. Core Data Contracts

The navigator operates on a simple data structure that represents a selectable item in the `vscode.QuickPick` dropdown menu.

```typescript
/**
 * Represents a single, selectable context in the Status Bar Navigator's dropdown.
 */
export interface NavigatorItem extends vscode.QuickPickItem {
  /** A unique identifier for the context ('lobby' for the main project, or the sessionId for a workflow). */
  id: string;
  /** The primary text displayed, including formatted status icons. e.g., "(🟢 ▶️) Task: Implement Login Form" */
  label: string;
  /** The secondary text, showing the branch name and any conflict status. e.g., "robo-smith/session-abc [Clash]" */
  description: string;
}
```
## 3. Component Specification

### Component: StatusBarNavigator (Logical Component)

* **Architectural Role:** `UI Orchestrator` / `Feature Entry Point`
* **Core Responsibilities:**
    * To register and manage a `vscode.StatusBarItem` that serves as the main UI entry point for all RoboSmith interactions.
    * To display the name of the currently active RoboSmith context in the status bar.
    * When clicked, to present a `vscode.QuickPick` dropdown populated with all available contexts (the Lobby and all active, queued, or held workflows).
    * Upon user selection, to orchestrate the complete, atomic workspace context switch by replacing the visible workspace folders.
    * To serve as the single, authoritative mechanism for navigating between worktrees.
* **Public API (Command Registration):**
    ```typescript
    // Command to be registered
    'roboSmith.showNavigator'
    ```

* **Detailed Behavioral Logic (The Algorithm):**
    1.  **Initialization (on Extension Activation):**
        a.
A `vscode.StatusBarItem` is created with a high alignment priority (placing it in the bottom-left of the UI) and the text `🤖 RoboSmith: My Project (main)`.
        b. Its `command` property is set to `roboSmith.showNavigator`.
        c. The status bar item is made visible.
    2.  **User Interaction (Click):**
        a.
The user clicks the `🤖 RoboSmith` status bar item, triggering the `roboSmith.showNavigator` command.
    3.  **Data Fetching & Assembly:**
        a.
The command handler retrieves the complete list of all active, queued, and held `WorktreeSession` objects from the `GitWorktreeManager` service.
        b.
It constructs an array of `NavigatorItem` objects.
        c. The first item is always the "Lobby": `{ id: 'lobby', label: 'My Project', description: '(main branch)' }`.
        d. It maps over the `WorktreeSession` objects, formatting each one into a `NavigatorItem` by combining the decoupled UI signals (Health, Queue, Overlap) as specified in `GitWorktree_System.md`. For example: `label: "(🟢 ⏳) Task: Refactor API", description: "robo-smith/session-xyz [Clash]"`.
        e.
A final separator and a `[+] Create New Workflow...` item are added to the end of the list.
    4.  **Display Dropdown:**
        a.
The handler calls `vscode.window.showQuickPick(items, { placeHolder: 'Switch RoboSmith context or create a new workflow...' })`.
    5.  **Handle Selection & Orchestrate Context Switch:**
        a.
The handler awaits the user's selection. If the user presses Escape, it does nothing.
        b.
**If the user selects `[+] Create New Workflow...`:**
            i.   The handler triggers the "Create New Workflow" flow (as specified in `docs/specifications/Task 3_4- Specification- Stepper Mode.md`).
            ii.  This flow **must** first prompt the user to select a run mode: `[Run Autonomously]` (default) or `[Run with Manual Approval]`.
            iii. The chosen mode (`isManualApprovalMode: boolean`) is then passed to the `EventHandler`'s `startWorkflow` command.
        c.  **If the selected item's session is `Held`:** Trigger the 'Re-inflate' flow: re-create the local worktree from the branch, load the session state from its committed file, and re-hydrate the Orchestrator. See `docs/architecture/Durable_Session_Persistence.md`.
        d.  **If the user selects any other item (a workflow or the Lobby):** It determines the target `vscode.Uri` for that context (either the main project root or the worktree's path).
        e.  It calls `vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, { uri: targetUri })`. This atomically **replaces** all currently visible folders with just the single, selected one, achieving the "Clear Separation of Worlds".
        f.
It updates the `StatusBarItem.text` to reflect the new active context (e.g., `🤖 RoboSmith: Task: Refactor API`).
        g.
It sends the appropriate message to the main WebView panel controller to either show the "Mission Control" panel for the selected workflow or the main "Lobby" overview.

* **Mandatory Testing Criteria:**
    * An integration test must verify that the `StatusBarItem` is created and visible upon extension activation.
    * A test must verify that clicking the item triggers the `vscode.window.showQuickPick` function.
    * A test must verify that the list of items presented in the Quick Pick dropdown correctly formats and reflects the state of a mocked `GitWorktreeManager`, including the correct status icons and labels.
    * A test must verify that upon selecting a workflow from the dropdown, the `vscode.workspace.updateWorkspaceFolders` command is called with the exact URI of that workflow's worktree.
    * A test must verify that selecting the "Lobby" item correctly reconfigures the workspace to show the main project root.