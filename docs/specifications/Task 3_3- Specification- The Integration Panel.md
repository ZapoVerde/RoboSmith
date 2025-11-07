
# Specification: The Integration Panel

## 1. High-Level Summary
This specification defines the **"Integration Panel,"** a dedicated UI view that serves as the final, decisive step in an automated workflow. Its purpose is to transition control from the automated system back to the human supervisor, presenting a clear, focused interface for validation and final disposition of the generated work.

This panel appears automatically in the main editor area, replacing the Mission Control Panel, once a workflow successfully completes. It provides the user with the tools to validate the AI's work in its isolated sandbox and then make one of three explicit choices: accept and merge the changes, reject and discard them completely, or hold the branch for later action.

## 2. Core Data Contracts
The panel is triggered by an incoming message from the backend and sends back a message corresponding to the user's final choice.

```typescript
/**
 * INCOMING: The message sent from the Extension Host to the WebView to signal
 * that a task is complete and the Integration Panel should be shown.
 */
export interface TaskReadyForIntegrationMessage {
  command: 'taskReadyForIntegration';
  payload: {
    sessionId: string;
    branchName: string;
    commitMessage: string; // AI-generated commit message
    changedFiles: string[];
  };
}

/**
 * OUTGOING: The set of messages the WebView can send back to the Extension
 * Host based on the user's final decision.
 */
export type FinalDecisionMessage =
  | { command: 'openTerminalInWorktree'; payload: { sessionId: string } }
  | { command: 'acceptAndMerge'; payload: { sessionId: string } }
  | { command: 'rejectAndDiscard'; payload: { sessionId: string } }
  | { command: 'finishAndHold'; payload: { sessionId: string } };
```

## 3. Component Specification

### Component: IntegrationPanel (Svelte)
*   **Architectural Role:** UI Component (View)
*   **Core Responsibilities:**
    *   Display the details of the completed task (branch name, changed files).
    *   Present the primary validation tool: the `[🚀 Open Terminal in Worktree]` button.
    *   Render the three final, mutually exclusive action buttons: `[Accept]`, `[Reject]`, and `[Hold]`.
    *   Emit the correct `FinalDecisionMessage` to the Extension Host when a user clicks any of the action buttons.
    *   Require confirmation for destructive actions (Reject).

*   **Public API (Svelte Component Signature):**
    ```svelte
    <!-- IntegrationPanel.svelte -->
    <script lang="ts">
      import type { TaskReadyForIntegrationMessage } from './types';

      /**
       * The details of the completed task, passed in as a prop.
       */
      export let task: TaskReadyForIntegrationMessage['payload'];
    </script>

    <!-- The component will render the UI and its three final action buttons -->
    ```

*   **Detailed Behavioral Logic (The Algorithm):**
    1.  **Appearance:** The panel is rendered when the backend sends a `taskReadyForIntegration` message. The message `payload` is passed as the `task` prop.
    2.  **Information Display:** The `task.branchName` and a list of `task.changedFiles` are displayed in a read-only format.
    3.  **User Validation:** The most prominent action is the `[🚀 Open Terminal in Worktree]` button. Clicking this sends an `openTerminalInWorktree` message to the backend, which opens a terminal scoped to the correct worktree `cwd`, allowing the user to run tests or start a dev server.
    4.  **Final Decision Buttons:** Three distinct buttons are presented to the user:
        a.  **`[✅ Accept and Merge Branch]`:** The primary "happy path" button. Clicking it sends an `acceptAndMerge` message to the backend.
            *   **Backend Logic:** Receives the message, executes the Git commands to commit, merge the branch into `main`, and then runs the full cleanup (`git worktree remove`, `git branch -d`). Finally, it updates its state and switches the user's workspace back to the "Lobby" view.
        b.  **`[❌ Reject and Discard Branch]`:** The destructive "abort" button.
            *   **UI Logic:** Clicking this button first triggers a `vscode.window.showInformationMessage` modal asking for confirmation.
            *   **Backend Logic:** If confirmed, the UI sends a `rejectAndDiscard` message. The backend executes `git worktree remove --force` and `git branch -d` to completely destroy the worktree and branch, then switches the user back to the "Lobby".
        c.  **`[⏸️ Finish & Hold Branch]`:** The "save for later" option.
            *   **Backend Logic:** Clicking this sends a `finishAndHold` message. The backend updates the workflow's status to `Held` in its persistent state. It performs **no Git operations**, leaving the worktree and branch intact. It then switches the user's workspace back to the "Lobby". The held task will remain visible in the Status Bar Navigator.

*   **Mandatory Testing Criteria:**
    *   **Rendering:** A component test must verify that given a `task` prop, the `branchName` is displayed and all three final action buttons (`Accept`, `Reject`, `Hold`) are rendered.
    *   **Event Emission:** Tests must verify that clicking each of the three buttons dispatches an event with the correct `command` and `sessionId` payload.
    *   **Confirmation Modal:** A test must verify that clicking the `[Reject]` button triggers a call to a mocked `showInformationMessage` function and *only* dispatches its event if the confirmation is positive.
    *   **Backend Logic (Integration Tests):** Higher-level tests must verify that:
        *   Receiving an `acceptAndMerge` message results in the correct sequence of Git `merge` and `worktree remove` commands.
        *   Receiving a `rejectAndDiscard` message results in a `worktree remove --force` command.
        *   Receiving a `finishAndHold` message results in a state update **without** calling any Git cleanup commands.
