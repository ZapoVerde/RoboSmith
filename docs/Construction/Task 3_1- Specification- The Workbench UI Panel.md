
---

# Specification: The "Workbench" UI Panel

## 1. High-Level Summary
This specification defines the primary user interface for RoboSmith: the **"Workbench"**. The Workbench is a VS Code Sidebar panel that serves as the user's "director's chair" for initiating and supervising multiple, parallel AI-driven workflows.

Its core purpose is to provide a clean, glanceable, and multi-tabbed dashboard where each tab represents a single, isolated `WorktreeSession`. Crucially, it must implement the **decoupled UI signaling system** from `GitWorktree_System.md`, providing the user with clear, unambiguous, real-time status information about the health, conflict status, and queue position of each workflow.

## 2. Core Data Contracts
The Workbench is a reactive, "dumb" component. Its entire view is driven by a state object received from the Extension Host.

```typescript
import type { ApiKey } from '@shared/domain/api-key'; // Assumed for settings integration

/**
 * Represents the complete state for a single tab in the Workbench UI.
 * This object is sent from the Extension Host to the WebView.
 */
export interface WorkbenchTabState {
  /** The unique identifier for this session/tab. */
  sessionId: string;
  /** A user-friendly title for the tab (e.g., "Refactor Auth Logic"). */
  title: string;
  /** The current technical integrity of the worktree. */
  health: 'GREEN' | 'AMBER' | 'RED'; // Maps to the 🟢/🟡/🔴 stoplight
  /** The result of the file conflict scan. */
  overlap: 'CLEAR' | 'CONTEXT_OVERLAP' | 'CLASH'; // Maps to the text label
  /** The task's status in the execution queue. */
  queue: 'IDLE' | 'QUEUED' | 'RUNNING' | 'COMPLETE'; // Maps to ⏳/▶️/✅ icons
  /** A descriptive string for queue position or priority (e.g., "FIFO #2", "P:1"). */
  orchestration: string;
}

/**
 * The complete state for the entire Workbench panel, containing a list of all tabs.
 */
export interface WorkbenchState {
  tabs: WorkbenchTabState[];
  /** The sessionId of the currently active/visible tab. */
  activeTabId: string | null;
}
```

## 3. Component Specification

### Component: WorkbenchPanel (Svelte)
*   **Architectural Role:** UI Component (View)
*   **Core Responsibilities:**
    *   Render a tabbed interface, with one tab for each `WorkbenchTabState` object in the received `WorkbenchState`.
    *   In the header of each tab, render the four distinct, decoupled UI status indicators (Health, Overlap, Queue, Orchestration).
    *   Display the content of the currently active tab.
    *   Send messages to the Extension Host when the user interacts with the UI (e.g., clicks a "New Chain" button, closes a tab).
    *   Act as a pure, reactive component that only re-renders when it receives a new `WorkbenchState` object from the backend.

*   **Public API (Svelte Component Signature):**
    ```svelte
    <!-- WorkbenchPanel.svelte -->
    <script lang="ts">
      import type { WorkbenchState } from './types'; // Local UI type definitions

      /**
       * The complete state of the UI, passed in as a prop from the main
       * Svelte application entry point.
       */
      export let state: WorkbenchState;
    </script>

    <!-- The component will render the UI based on the `state` prop -->
    ```

*   **Detailed Behavioral Logic (The Algorithm):**
    1.  The main Svelte application receives a `WorkbenchState` update message from the Extension Host's event bus.
    2.  It passes this new state object as a prop to the `WorkbenchPanel` component, triggering a re-render.
    3.  **Tab Rendering:** The component iterates through the `state.tabs` array. For each `tab` object, it renders a tab button. The button's visual state is determined by the `tab.sessionId === state.activeTabId`.
    4.  **Decoupled Status Indicators:** Inside each tab button/header, the component will render the four status elements, each with its own logic:
        a.  **Health Stoplight:** It will display a colored circle (🟢, 🟡, or 🔴) based on the `tab.health` property. A tooltip on this element will provide more detail (e.g., "Worktree is locked").
        b.  **Overlap Label:** It will display a simple text badge. The text will be "Clear" for `CLEAR`, "Context Overlap" for `CONTEXT_OVERLAP`, and "Clash" for `CLASH`, based on the `tab.overlap` property. The tooltip will detail the conflicting files.
        c.  **Queue Icon:** It will display an icon based on the `tab.queue` property: no icon for `IDLE`, a spinner/hourglass (⏳) for `QUEUED`, a play icon (▶️) for `RUNNING`, and a checkmark (✅) for `COMPLETE`. The tooltip will provide an ETA or queue position.
        d.  **Orchestration Tag:** It will display a simple text label with the content of the `tab.orchestration` string. This element can be hidden if the string is empty.
    5.  **Content Area:** Below the tab strip, the component will render the content for the *active* tab only. For V1, this content area will primarily be the "Planning Session" view component (specified in Task 3.2).
    6.  **User Interactions:**
        *   When a tab is clicked, the component sends a `setActiveTab` message to the Extension Host with the corresponding `sessionId`.
        *   When a tab's "close" button is clicked, it sends a `closeSession` message to the backend, which will trigger the `GitWorktreeManager.removeWorktree` flow.
        *   A global "New Chain" button will send a `createNewChain` message to the backend.

*   **Mandatory Testing Criteria:**
    *   **Rendering:** A component test must verify that given a `WorkbenchState` with two tabs, two tab buttons are rendered in the UI.
    *   **Status Indicator Mapping:** Tests must verify the correct mapping for each status system:
        *   Given `health: 'RED'`, a stoplight with a "red" CSS class must be present.
        *   Given `overlap: 'CLASH'`, a text label containing the word "Clash" must be present.
        *   Given `queue: 'QUEUED'`, an element representing the "queued" icon (e.g., with a specific class or data-attribute) must be present.
    *   **Event Emission:** A test must verify that clicking a tab's close button dispatches a `closeSession` event with the correct `sessionId` payload.
    *   **Active Tab Display:** A test must verify that only the content for the tab whose `sessionId` matches the `activeTabId` is visible.