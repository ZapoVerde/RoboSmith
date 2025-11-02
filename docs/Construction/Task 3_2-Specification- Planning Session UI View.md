
---

# Specification: "Planning Session" UI View

## 1. High-Level Summary
This specification defines the **"Planning Session" view**, the primary UI component for visualizing the real-time execution of a single workflow node. This component is the "mission control" screen that a user watches as the `Orchestrator` engine carries out its work.

Its core purpose is to be a reactive, read-only display that translates the `PlanningState` object (sent from the Extension Host) into a clear, intuitive, and step-by-step visualization of the workflow's progress. It will also present the user with supervisor controls (`[Accept]`, `[Revise]`, `[Abort]`) but *only* when the workflow is explicitly halted and requires human intervention.

## 2. Core Data Contracts
This view is a "dumb" component driven entirely by the `PlanningState` object, which is defined in the shared `types.ts` file.

```typescript
/**
 * Represents the complete state of an executing workflow node, sent from the
 * Extension Host to the WebView. This is the sole input for this component.
 */
export interface PlanningState {
  /** The ID of the node currently being executed. */
  nodeId: string;
  /** The zero-based index of the step currently in progress. */
  currentStepIndex: number;
  /** An array representing the state of all steps in the current node. */
  steps: Array<{
    name: string;
    status: 'pending' | 'in_progress' | 'action_required' | 'complete';
  }>;
  /** The string output from the most recently completed step. */
  lastOutput: string | null;
  /** A flag indicating if the workflow is paused and waiting for user input. */
  isHalted: boolean;
  /** An error message if the workflow halted due to a failure. */
  errorMessage: string | null;
}
```

## 3. Component Specification

### Component: PlanningSessionView (Svelte)
*   **Architectural Role:** UI Component (View)
*   **Core Responsibilities:**
    *   Render a list of all steps for the current workflow node.
    *   Visually represent the status of each step (`pending`, `in_progress`, etc.) using icons, colors, or text styles.
    *   Display the output of the last completed step in a formatted text area.
    *   Conditionally render a set of "Supervisor Controls" (buttons) only when the `isHalted` flag in the `PlanningState` is `true`.
    *   Emit user action events when a supervisor control button is clicked.

*   **Public API (Svelte Component Signature):**
    ```svelte
    <!-- PlanningSessionView.svelte -->
    <script lang="ts">
      import { createEventDispatcher } from 'svelte';
      import type { PlanningState } from './types';

      /**
       * The real-time state of the workflow, passed in as a prop.
       */
      export let state: PlanningState;

      const dispatch = createEventDispatcher();

      function handleUserAction(action: 'proceed' | 'revise' | 'abort') {
        dispatch('userAction', { action });
      }
    </script>

    <!-- The component will render the UI based on the `state` prop -->
    ```

*   **Detailed Behavioral Logic (The Algorithm):**
    1.  The component receives the `PlanningState` object as its `state` prop. This triggers a re-render.
    2.  **Step List Rendering:** It iterates through the `state.steps` array. For each `step` object, it renders a list item.
        a.  The visual style of the list item will change based on the `step.status`. For example:
            *   `pending`: Grayed out text.
            *   `in_progress`: A spinner icon and highlighted text.
            *   `complete`: A checkmark icon (✅).
            *   `action_required`: An error/warning icon (🔴) and bold text.
    3.  **Last Output Display:** It will render the content of `state.lastOutput` inside a read-only text area or a pre-formatted block (e.g., `<pre>`). If `lastOutput` is `null`, this area is hidden or shows a placeholder.
    4.  **Error Message Display:** If `state.errorMessage` is not `null`, it will be displayed prominently in a styled "alert" or "callout" box to draw the user's attention.
    5.  **Conditional Supervisor Controls:** The component will contain a section for control buttons that is rendered *if and only if* `state.isHalted` is `true`. This section will contain three buttons:
        *   `[Accept]`: The primary "go" button.
        *   `[Revise]`: A button to signal that the user wants to provide feedback.
        *   `[Abort]`: A dangerous action to terminate the workflow.
    6.  **Event Emission:** When any of the supervisor control buttons are clicked, the corresponding `handleUserAction` function is called, which dispatches a `userAction` event. The payload will be an object containing the specific action chosen by the user (e.g., `{ action: 'proceed' }`).

*   **Mandatory Testing Criteria:**
    *   **Status Rendering:** A component test must verify that given a `PlanningState` where a step has a status of `'in_progress'`, a corresponding "spinner" element is visible in the rendered output.
    *   **Output Display:** A test must verify that the content of the `state.lastOutput` prop is correctly rendered within a designated element on the screen.
    *   **Controls Visibility (Hidden):** A test must verify that when `isHalted` is `false`, the supervisor control buttons (`[Accept]`, `[Revise]`, etc.) are **not** present in the DOM.
    *   **Controls Visibility (Shown):** A test must verify that when `isHalted` is `true`, the supervisor control buttons **are** present in the DOM.
    *   **Event Emission:** A test must verify that clicking the `[Accept]` button dispatches a `userAction` event with the payload `{ action: 'proceed' }`.