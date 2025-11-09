# Specification: The Intervention Panel

## 1. High-Level Summary
This specification defines the **"Intervention Panel,"** the primary UI for both observability and control. [cite_start]This component is the direct implementation of the "director's chair" metaphor and replaces the concepts of the "Quick Fix Mode" [cite: 2034] [cite_start]and the read-only "RoboSmith Chat"[cite: 1319].

This panel is a single, context-aware WebView that lives in the bottom "Inspector" area. It has two distinct modes:

1.  **Observability Mode (Read-Only):** When the user selects a *running* or *completed* block in the Mission Control Panel, this panel renders a "scrollable" viewer of that block's `ExecutionPayload` (its chat history and context).
2.  **Intervention Mode (Interactive):** When the `Orchestrator` pauses (either from a `HALT_AND_FLAG` action or "Stepper Mode"), this panel automatically activates. It displays the scraped error context, provides a text input for "human guidance," and shows action buttons to resume or abort the workflow.

This design merges observability and control into a single, seamless experience.

---

## 2. Core Data Contracts
The panel is driven by state from the backend (`WorkflowViewState`) and sends new "Intervention" messages.

```typescript
/**
 * INCOMING: The panel's state is driven by the main Orchestrator state.
 * The panel becomes *interactive* when `isHalted` is true.
 */
import type { WorkflowViewState, ContextSegment } from '../../shared/types';

/**
 * OUTGOING: New messages sent from the Intervention Panel
 * to the EventHandler to resume a halted Orchestrator.
 */
export type InterventionMessage =
  | {
      command: 'resumeWorkflow';
      payload: {
        sessionId: string;
        /** The optional user-provided guidance. */
        augmentedPrompt?: string;
      };
    }
  | {
      command: 'retryBlock';
      payload: {
        sessionId: string;
        /** The optional user-provided guidance. */
        augmentedPrompt?: string;
      };
    };
  // The 'rejectAndDiscard' (Abort) message is already defined
  [cite_start]// in `shared/types.ts` [cite: 3256-3258].
```

---

## 3. Component Specification

### Component: InterventionPanel (Svelte)
* **Architectural Role:** UI Component (View)
* **Core Responsibilities:**
    * To render the `executionLog` (the chat) for the currently selected block.
    * To *conditionally* display the "Intervention Tools" (input box and buttons) only when the `Orchestrator`'s state is `isHalted: true`.
    * To dispatch the correct `InterventionMessage` based on user action.

* **Detailed Behavioral Logic (The Algorithm):**

    **1. Observability Mode (Read-Only):**
    * [cite_start]**Trigger:** The main `App.svelte` (or equivalent) listens for a `blockSelected` event from the `MissionControlPanel` [cite: 1982-1988] for a block that is *not* halted.
    * **Action:** The panel is shown. It receives the `executionLog` for that block from the `WorkflowViewState`. It renders a read-only, "scrollable" view of the `ContextSegment` array (the chat history). The text input and action buttons are hidden.

    **2. Intervention Mode (Interactive):**
    * **Trigger:** The `Orchestrator`'s state update is received with `isHalted: true`.
    * **Action:** The UI automatically switches to the `InterventionPanel` and focuses it.
    * **UI State:**
        * [cite_start]**Scraped Context:** The panel parses the `executionPayload` for known error types (like `TestResultSegment` [cite: 1877]) and displays them in a "read-only" section (e.g., "Automated Test Failed: ...").
        * **Augment Input:** A text area labeled "Add Guidance:" is shown, allowing the user to type a manual prompt.
        * **Action Buttons:** The panel displays the following buttons:
            * **`[🔁 Retry Failed Block]`:** (For failures). Dispatches a `retryBlock` message containing the `augmentedPrompt` text. The `Orchestrator` will re-run the *same* `currentBlockId` using the augmented context.
            * **`[▶️ Resume to Next Step]`:** (For "Stepper Mode" or to skip a retry). Dispatches a `resumeWorkflow` message. The `Orchestrator` un-halts and proceeds to the *next* block in the manifest.
            * **`[🛑 Abort Workflow]`:** Dispatches the existing `rejectAndDiscard` message.

* **Mandatory Testing Criteria:**
    * A test must verify the input/buttons are `hidden` when `isHalted` is `false`.
    * A test must verify the input/buttons are `visible` when `isHalted` is `true`.
    * A test must verify the `[Retry]` button dispatches a `retryBlock` message with the correct `augmentedPrompt`.
    * A test must verify the `[Resume]` button dispatches a `resumeWorkflow` message.