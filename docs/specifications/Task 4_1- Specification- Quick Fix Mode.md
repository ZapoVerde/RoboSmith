
---

# Specification: Quick Fix Mode

## 1. High-Level Summary
This specification defines **"Quick Fix Mode,"** a lightweight, contextual feature for ad-hoc AI assistance directly within the code editor. Its purpose is to provide a fast, "in-the-moment" chat experience for solving a specific problem related to a selected block of code, without the overhead of creating a full Workbench session.

This feature is activated via a VS Code command (`roboSmith.quickFix`). It gathers the context of the user's current selection, opens a temporary and disposable WebView panel, and allows for a focused, iterative conversation to generate a code snippet. The final, approved code is then applied directly back to the editor as a workspace edit.

## 2. Core Data Contracts
This feature uses a simple set of messages for its dedicated, temporary event bus.

```typescript
/**
 * The initial message sent from the Extension Host to the Quick Fix WebView,
 * providing the initial context to start the conversation.
 */
export interface InitializeQuickFixMessage {
  command: 'initialize';
  payload: {
    /** The code snippet the user had selected when invoking the command. */
    selectedCode: string;
    /** The language of the document (e.g., 'typescript'). */
    languageId: string;
    /** The full path of the file being edited. */
    filePath: string;
  };
}

/**
 * A message sent from the WebView to the Extension Host containing a new
 * user prompt for the AI.
 */
export interface SubmitPromptMessage {
  command: 'submitPrompt';
  payload: {
    /** The user's text input. */
    prompt: string;
    /** The full history of the conversation so far. */
    history: Array<{ author: 'user' | 'ai'; text: string }>;
  };
}

/**
 * A message sent from the WebView to the Extension Host with the final,
 * user-approved code to be applied to the document.
 */
export interface ApplyFixMessage {
  command: 'applyFix';
  payload: {
    /** The final code snippet to insert. */
    finalCode: string;
  };
}
```

## 3. Component Specification

### Component: QuickFixCommand (Command Handler)
*   **Architectural Role:** Feature Entry Point
*   **Core Responsibilities:**
    *   Register the `roboSmith.quickFix` command in the extension's `package.json`.
    *   Gather context from the active text editor when the command is invoked (selected text, file path, language).
    *   Create and manage the lifecycle of a temporary, single-use `WebviewPanel`.
    *   Send the initial context to the new WebView panel.
    *   Listen for and handle messages (`submitPrompt`, `applyFix`) from its dedicated WebView.
    *   Apply the final code change to the document using the `vscode.WorkspaceEdit` API.

*   **Public API (TypeScript Signature):**
    This component is not a class but a command registration and handler function within `extension.ts` or a dedicated command file.

*   **Detailed Behavioral Logic (The Algorithm):**
    1.  **Activation:** The `roboSmith.quickFix` command is registered. When a user executes it (e.g., from the command palette or a right-click context menu):
    2.  **Context Gathering:** The handler function gets the active text editor using `vscode.window.activeTextEditor`. If there is no active editor, it returns. It retrieves the user's selection, the document's `uri`, and its `languageId`.
    3.  **WebView Creation:** It creates a new `WebviewPanel` with a unique ID, a title like "RoboSmith: Quick Fix," and settings to enable scripts.
    4.  **Initialization:** Once the panel is created, it sends an `InitializeQuickFixMessage` to the WebView, passing the `selectedCode` and other context it gathered.
    5.  **Event Handling:** The handler sets up an `onDidReceiveMessage` listener for the panel.
        a.  **On `submitPrompt`:** It receives the user's prompt and conversation history. It constructs a `WorkOrder` and calls the `ApiPoolManager.execute()` method to get a response from the AI. The AI's response is then posted back to the WebView to be displayed in the chat interface.
        b.  **On `applyFix`:** It receives the `finalCode` from the WebView.
            i.   It creates a new `vscode.WorkspaceEdit` object.
            ii.  It calls the `edit.replace()` method, providing the document's `uri` and the original `selection` range to replace.
            iii. It applies the edit using `vscode.workspace.applyEdit(edit)`.
            iv.  After applying the edit, it programmatically disposes of the `WebviewPanel` to clean up.
    6.  **Panel Disposal:** The handler also listens for when the user manually closes the WebView panel, ensuring any related resources are cleaned up.

*   **Mandatory Testing Criteria:**
    *   **Command Registration:** An integration test must verify that the `roboSmith.quickFix` command is registered and that invoking it creates a `WebviewPanel`.
    *   **Context Gathering:** A test must verify that when the command is run, the handler correctly reads the selected text from the (mocked) active editor.
    *   **AI Call:** A test must verify that when the handler receives a `submitPrompt` message, it correctly calls the `ApiPoolManager.execute` method.
    *   **Applying Changes:** A test must verify that upon receiving an `applyFix` message, the handler correctly creates a `vscode.WorkspaceEdit` and calls `vscode.workspace.applyEdit` with the correct text and range. This is a critical V1 feature.