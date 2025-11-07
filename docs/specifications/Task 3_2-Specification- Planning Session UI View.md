
# Specification: The Interactive Mission Control Panel

## 1. High-Level Summary
This specification defines the primary UI for supervising an active RoboSmith workflow: the **Interactive Mission Control Panel**. This component is a rich, dynamic WebView that appears in the main editor area and serves as the user's "director's chair," providing a transparent, real-time view of the automation engine's execution.

Its core purpose is to be a "living Visio diagram" of the workflow. It replaces a simple text log with an interactive, graphical state machine, fulfilling the "Principle of Apparent Simplicity" by making a complex backend process intuitive and observable. It is the central hub from which the user can understand, debug, and take control of the AI's behavior.

## 2. Core Data Contracts
This view is a "dumb" component driven entirely by a single, rich state object sent from the Extension Host. This object contains all the information necessary to render the entire interactive experience.

```typescript
/**
 * Represents the complete, real-time state of the Mission Control panel,
 * sent from the Extension Host to the WebView with every update.
 */
export interface WorkflowViewState {
  /**
   * The static blueprint of the currently executing workflow node's graph.
   * This is used to draw the flowchart.
   */
  graph: {
    nodeId: string;
    blocks: Record<string, { name: string }>; // e.g., { "Block:GenerateCode": { name: "Generate Code" } }
    transitions: Array<{ from: string; to: string; signal: string }>; // The arrows and their labels
  };

  /**
   * A map of the live status for each block in the graph.
   * e.g., { "Block:GenerateCode": "complete", "Block:RunTests": "active" }
   */
  statuses: Record<string, 'complete' | 'active' | 'pending' | 'failed'>;

  /**
   * The most recent transition that occurred, used to animate the "lit path."
   * e.g., { fromBlock: "Block:GenerateCode", toBlock: "Block:RunTests", signal: "SIGNAL:SUCCESS" }
   */
  lastTransition: {
    fromBlock: string;
    toBlock: string;
    signal: string;
  } | null;

  /**
   * A complete, detailed log of all inputs and outputs for every block that
   * has executed. Used to populate the inspector panels when a block is selected.
   */
  executionLog: Record<string, {
    context: ContextSegment[]; // The inputs ("little icons" data)
    conversation: ContextSegment[]; // The outputs (chatbox data)
  }>;

  /**
   * A summary of all active workflows, used to render the top status ticker.
   */
  allWorkflowsStatus: Array<{
    sessionId: string;
    name: string;
    health: 'GREEN' | 'AMBER' | 'RED';
    queue: 'IDLE' | 'QUEUED' | 'RUNNING' | 'COMPLETE';
  }>;
}
```

## 3. Component Specification

### Component: MissionControlPanel (Svelte)
*   **Architectural Role:** UI Component (View)
*   **Core Responsibilities:**
    *   Render the read-only **Status Ticker** at the top of the panel, showing the status of all active workflows.
    *   Render the **interactive workflow graph** (the "Visio diagram") based on the `graph` data.
    *   Apply dynamic styles (colors, borders, animations) to the graph's blocks and arrows based on the `statuses` and `lastTransition` data.
    *   Manage the local UI state for which block is currently selected by the user.
    *   Emit an event whenever a block is selected, so that other UI panels (like the Chatbox) can update themselves.

*   **Public API (Svelte Component Signature):**
    ```svelte
    <!-- MissionControlPanel.svelte -->
    <script lang="ts">
      import type { WorkflowViewState } from './types';

      /**
       * The complete, real-time state of the UI, passed in as a prop.
       */
      export let state: WorkflowViewState;
    </script>
    ```

*   **Detailed Behavioral Logic (The Algorithm):**
    1.  The component receives the `WorkflowViewState` object as its `state` prop, triggering a re-render.
    2.  **Status Ticker Rendering:** It iterates through the `state.allWorkflowsStatus` array to render the read-only "lozenge" for each workflow at the top of the panel. The currently active workflow is highlighted.
    3.  **Workflow Graph Rendering:**
        a.  The component uses a rendering library (e.g., Mermaid.js) to generate an SVG flowchart from the `state.graph.blocks` and `state.graph.transitions` data.
        b.  The `signal` from each transition is used as the label for the corresponding arrow.
    4.  **Live State Visualization:**
        a.  After rendering, the component iterates through the `state.statuses` map. For each `blockId`, it finds the corresponding element in the SVG and applies a CSS class (e.g., `status-complete`, `status-active`) to change its border color and icon.
        b.  If `state.lastTransition` is present, it finds the corresponding arrow element and applies a brief "glow" animation to visualize the "lit path."
    5.  **Interactivity:**
        a.  The component attaches a click event listener to each block element in the SVG graph.
        b.  When a user clicks a block, the handler function:
            i.   Updates a local state variable, `selectedBlockId`, with the ID of the clicked block. This will visually highlight the block in the UI.
            ii.  Dispatches a custom `blockSelected` event to the rest of the application, with a payload containing the `selectedBlockId` and the relevant data from `state.executionLog`. This allows the Chatbox and Context Inspector panels to filter their content accordingly.

*   **Mandatory Testing Criteria:**
    *   **Graph Rendering:** A component test must verify that given a `WorkflowViewState` with 2 blocks and 1 transition, the rendered output contains the correct number of nodes and an arrow with the correct `signal` label.
    *   **Status Styling:** A test must verify that given a `statuses` map where a block is `'failed'`, the corresponding rendered element has the `status-failed` CSS class.
    *   **"Lit Path" Animation:** A test must verify that when the `lastTransition` prop is updated, the correct arrow element temporarily receives an "active-transition" CSS class.
    *   **Event Emission:** A test must verify that clicking on a rendered block element dispatches a `blockSelected` event containing the correct `blockId` as its payload.
