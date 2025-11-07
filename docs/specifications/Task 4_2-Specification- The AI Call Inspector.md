
---

# Specification: The AI Call Inspector

## 1. High-Level Summary
This specification defines the **"AI Call Inspector,"** a core V1 feature designed for observability, debugging, and prompt refinement. Its purpose is to provide the user with a clear, auditable trail of every single AI call made by the system, addressing the critical risks of AI unreliability and unexpected API costs.

The Inspector is a dedicated UI view that reads structured log files from the `.vision/logs/` directory. It allows the user to select a past AI call, inspect the exact payload that was sent (including prompt, context, and model parameters), and view the raw response that was received. Its most powerful feature is the `[ 🔬 Re-run & Compare ]` button, which enables the user to modify the original request and see a side-by-side diff of the new output, facilitating rapid prompt engineering and refinement.

## 2. Core Data Contracts
The entire feature is built around a standardized, replayable log format for each AI call.

```typescript
/**
 * The structured format for a single AI call log file, stored as JSON.
 * Each file is named with a timestamp (e.g., '2025-11-01T213000Z-call.json').
 */
export interface AiCallLog {
  /** A unique identifier for this specific call. */
  callId: string;
  /** ISO 8601 timestamp of when the call was initiated. */
  timestamp: string;
  /** The session/workflow this call was a part of. */
  sessionId: string;
  /** The name of the step in the workflow manifest. */
  stepName: string;
  /** The payload that was sent to the AI provider. */
  request: {
    provider: 'openai' | 'google' | 'anthropic';
    model: string;
    /** The full prompt, including context, as sent to the API. */
    prompt: string;
    // Other parameters like temperature, max_tokens, etc.
  };
  /** The response received from the AI provider. */
  response: {
    /** The raw string content of the AI's reply. */
    content: string;
    /** The token usage data reported by the API. */
    tokensUsed: {
      input: number;
      output: number;
    };
  };
}

/**
 * A message sent from the WebView to the Extension Host to re-run a modified call.
 */
export interface RerunCallMessage {
  command: 'rerunCall';
  payload: {
    /** The modified request payload to be sent to the AI. */
    modifiedRequest: AiCallLog['request'];
  };
}
```

## 3. Component Specification

### Component: AiCallInspectorPanel (Svelte & Command Handler)
*   **Architectural Role:** UI Component (View) & Feature Entry Point
*   **Core Responsibilities:**
    *   Provide a command to open the AI Call Inspector UI.
    *   On activation, read all log files from the `.vision/logs/` directory.
    *   Display a list of historical AI calls, allowing the user to select one for detailed inspection.
    *   Render the segmented JSON payload of the selected call in an editable format.
    *   Provide a `[ 🔬 Re-run & Compare ]` button that triggers a new AI call with the (potentially modified) request payload.
    *   Display a side-by-side diff view comparing the original response with the new response.

*   **Public API (Svelte Component & Command Signature):**
    The feature will be activated by a command (`roboSmith.showAiCallInspector`). The UI itself will be a Svelte component that receives the list of historical calls as a prop.

*   **Detailed Behavioral Logic (The Algorithm):**
    1.  **Logging (A prerequisite in other services):** The `ApiPoolManager` must be modified. Before it makes any real API call, it must serialize its `WorkOrder` and other metadata into the `AiCallLog` format and save it as a new JSON file in the `.vision/logs/` directory. After receiving a response, it updates the same log file with the `response` data.
    2.  **Activation:** A user invokes the `roboSmith.showAiCallInspector` command.
    3.  **Log Loading:** The command handler reads the contents of the `.vision/logs/` directory, parses each JSON file into an `AiCallLog` object, and sorts them by timestamp (most recent first).
    4.  **UI Rendering:** It creates a new `WebviewPanel` for the Inspector and sends the list of `AiCallLog` objects to the Svelte UI.
    5.  **History List:** The UI displays a list of the past calls (e.g., showing `timestamp` and `stepName`). When the user clicks on an item:
    6.  **Detail View:** The UI displays the details of the selected `AiCallLog`. The `request` object is rendered in a way that its fields (especially the `prompt`) are editable text areas. The original `response.content` is displayed in a read-only view.
    7.  **Re-run & Compare Logic:**
        a.  The user modifies one or more fields in the displayed `request` (e.g., tweaking the prompt text).
        b.  They click the `[ 🔬 Re-run & Compare ]` button.
        c.  The UI sends a `RerunCallMessage` to the Extension Host, containing the *complete, modified* request payload.
        d.  The handler receives this message, constructs a new `WorkOrder` from the payload, and calls `ApiPoolManager.execute()`.
        e.  When the new response is received, the handler sends a `rerunComplete` message back to the WebView with the new content.
    8.  **Diff Display:** The UI, upon receiving the `rerunComplete` message, displays a side-by-side diff view, showing the original `response.content` on one side and the new response content on the other. This provides immediate, clear feedback on how the prompt changes affected the output.

*   **Mandatory Testing Criteria:**
    *   **Logging:** A test for the `ApiPoolManager` must verify that when it executes a call, it correctly writes a corresponding `.json` log file to a mock filesystem.
    *   **UI Rendering:** A component test for the Inspector UI must verify that given a list of `AiCallLog` objects, it correctly renders a list of historical calls.
    *   **Event Emission:** A test must verify that when the `[ 🔬 Re-run & Compare ]` button is clicked, a `rerunCall` event is dispatched with the current, potentially modified, request data as its payload.
    *   **Backend Re-run Logic:** An integration test must verify that when the handler receives a `rerunCall` message, it correctly calls `ApiPoolManager.execute` with the payload from the message. This fulfills **V1 Success Criterion 5.5**.