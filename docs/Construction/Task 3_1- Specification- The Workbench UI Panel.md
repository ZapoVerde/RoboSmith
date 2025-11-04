
# Specification: The Status Bar Navigator

## 1. High-Level Summary
This specification defines the primary user interface for navigation and context switching in RoboSmith: the **Status Bar Navigator**. This component replaces the previous concept of a "Workbench Panel" and is the direct implementation of our "Principle of Apparent Simplicity" and "Clear Separation of Worlds."

Its core purpose is to act as the single, dedicated, and unambiguous "doorway" between the user's familiar main project view (the "Lobby") and the isolated, focused views for each automated workflow. It provides at-a-glance status information without cluttering the main workspace and ensures that all context switches are deliberate, safe, and intuitive.

## 2. Core Data Contracts
The navigator operates on a simple data structure that represents an item in the Quick Pick dropdown menu.

```typescript
/**
 * Represents a single, selectable context in the Status Bar Navigator's dropdown.
 */
export interface NavigatorItem extends vscode.QuickPickItem {
  /** A unique identifier for the context ('lobby' for the main project, or the sessionId for a workflow). */
  id: string;
  /** The primary text displayed, including status icons. e.g., "(🟢 ▶️) Task: Implement Login Form" */
  label: string;
  /** The secondary text, often showing the branch name. e.g., "robo-smith/session-abc" */
  description: string;
}
```

## 3. Component Specification

### Component: StatusBarNavigator (Logical Component)
*   **Architectural Role:** UI Orchestrator / Feature Entry Point
*   **Core Responsibilities:**
    *   Register and manage a `vscode.StatusBarItem` to serve as the main UI entry point.
    *   Display the name of the currently active RoboSmith context in the status bar.
    *   When clicked, present a `vscode.QuickPick` dropdown populated with all available contexts (the Lobby and all active/held workflows).
    *   Upon user selection, orchestrate the complete, atomic workspace context switch by replacing the visible workspace folders.
    *   Serve as the single, authoritative mechanism for navigating between worktrees.

*   **Public API (Command Registration):**
    This component is primarily driven by a command registered in `extension.ts`.
    ```typescript
    // Command to be registered
    'roboSmith.showNavigator'
    ```

*   **Detailed Behavioral Logic (The Algorithm):**
    1.  **Initialization (on Extension Activation):**
        a.  A `vscode.StatusBarItem` is created with a high alignment priority to place it in the bottom-left of the UI.
        b.  Its initial text is set to `🤖 RoboSmith: My Project (main)`.
        c.  Its `command` property is set to `roboSmith.showNavigator`.
        d.  The status bar item is made visible.
    2.  **User Interaction (Click):**
        a.  The user clicks the `🤖 RoboSmith` status bar item, triggering the `roboSmith.showNavigator` command.
    3.  **Data Fetching & Assembly:**
        a.  The command handler retrieves the list of all active and held `WorktreeSession` objects from the `GitWorktreeManager` service.
        b.  It constructs an array of `NavigatorItem` objects.
        c.  The first item is always the "Lobby": `{ id: 'lobby', label: 'My Project', description: '(main branch)' }`.
        d.  It maps over the `WorktreeSession` objects, formatting each one into a `NavigatorItem` with the correct status icons (e.g., `(🟢 ▶️)` for running, `(🟢 ⏳)` for queued, `(⏸️)` for held).
        e.  A final separator and a `[+] Create New Workflow...` item are added to the list.
    4.  **Display Dropdown:**
        a.  The handler calls `vscode.window.showQuickPick(items, { placeHolder: 'Switch RoboSmith context...' })`.
    5.  **Handle Selection:**
        a.  The handler awaits the user's selection. If the user presses Escape, it does nothing.
        b.  If the user selects a workflow, the handler extracts its `sessionId`.
        c.  If the user selects the "Lobby", it proceeds to the context switch for the main project.
    6.  **Orchestrate Context Switch:**
        a.  The handler determines the target `vscode.Uri` for the selected context (either the main project root or the worktree's path).
        b.  It calls `vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, { uri: targetUri })`. This atomically **replaces** all currently visible folders with just the single, selected one.
        c.  It updates the `StatusBarItem.text` to reflect the new active context.
        d.  It sends the appropriate message to the main WebView to either show the "Mission Control" panel for the selected workflow or the "Lobby" overview.

*   **Mandatory Testing Criteria:**
    *   An integration test must verify that the `StatusBarItem` is created and visible upon extension activation.
    *   A test must verify that clicking the item triggers the `vscode.window.showQuickPick` function.
    *   A test must verify that the list of items presented in the Quick Pick dropdown correctly formats and reflects the state of a mocked `GitWorktreeManager`.
    *   A test must verify that upon selecting a workflow from the dropdown, the `vscode.workspace.updateWorkspaceFolders` command is called with the exact URI of that workflow's worktree.
    *   A test must verify that selecting the "Lobby" item reconfigures the workspace to show the main project root.
