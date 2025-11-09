
---

# **Blueprint (Finalized)**

### **1. File Manifest (Complete Scope)**
*   `webview-ui/src/components/InterventionPanel.svelte`
*   `webview-ui/src/components/InterventionPanel.spec.ts`
*   `webview-ui/src/components/InterventionPanel.logic.ts`
*   `webview-ui/src/components/InterventionPanel.logic.spec.ts`
*   `packages/client/src/shared/types.ts`
*   `packages/client/src/events/handler.ts`
*   `packages/client/src/events/handler.spec.ts`
*   `webview-ui/src/App.svelte`
*   `webview-ui/src/App.spec.ts`
*   `webview-ui/src/components/MissionControlPanel.svelte`
*   `webview-ui/src/components/MissionControlPanel.spec.ts`

### **2. Logical Change Summary (Complete)**

#### **Core Changes:**
*   **`webview-ui/src/components/InterventionPanel.svelte`**: This new Svelte component will serve as the unified user interface for both observing and controlling a workflow. It will have two distinct, state-driven modes: a default "Read-Only" mode for displaying the execution history of a selected block, and an "Interactive" mode that activates when the workflow is paused. The interactive mode will render a text input for user guidance and action buttons to retry, resume, or abort the workflow.
*   **`webview-ui/src/components/InterventionPanel.logic.ts`**: This new, headless module will contain the pure, testable logic for the Intervention Panel. It will export functions that create and dispatch the new `resumeWorkflow` and `retryBlock` event messages to the backend, taking any user-provided guidance text as a payload.
*   **`packages/client/src/shared/types.ts`**: The shared message type definitions for the event bus will be updated. A new `InterventionMessage` type will be defined to represent the `resumeWorkflow` and `retryBlock` commands. This new type will be added to the main discriminated union for all possible messages, ensuring type safety across the WebView-to-Extension-Host boundary.
*   **`packages/client/src/events/handler.ts`**: The central event handler's primary switch statement will be expanded to process the new message types originating from the Intervention Panel. New `case` statements for `resumeWorkflow` and `retryBlock` will be added. The logic for these cases will delegate the required actions to the appropriate methods on the paused workflow engine instance.

#### **Collateral (Fixing) Changes:**
*   **`webview-ui/src/App.svelte`**: This root component will be updated to act as the main view controller. It will be responsible for importing the new `InterventionPanel` component and managing its visibility. It will listen for state updates from the backend and user interaction events from child components (like `MissionControlPanel`) to determine when to show the panel and what data to pass to it.
*   **`webview-ui/src/components/MissionControlPanel.svelte`**: The component's event handling will be updated. When a user clicks on a block in the workflow diagram, it must emit a `blockSelected` event. This event will notify the parent `App.svelte` component, which will then route the relevant historical data to the `InterventionPanel` for display.

### **3. API Delta Ledger (Complete)**
*   **File:** `packages/client/src/shared/types.ts`
    *   **Symbol:** `Message` (Discriminated Union Type)
    *   **Before:** `export type Message = | { command: 'existingCommand'; ... } | ...`
    *   **After:** `export type Message = | { command: 'existingCommand'; ... } | InterventionMessage | ...`

---

# **Blueprint (Test Assessment)**

*   **`webview-ui/src/components/InterventionPanel.svelte`**: Requires new test file (Reason: This is a CRITICAL new UI component that handles user interaction and requires tests to verify its rendering logic and event dispatching).
*   **`webview-ui/src/components/InterventionPanel.logic.ts`**: Requires new test file (Reason: This is a CRITICAL new file that introduces core, testable business logic for creating event payloads).
*   **`packages/client/src/shared/types.ts`**: No test file required (Reason: Contains only TypeScript type definitions; its correctness is verified by the compiler and the tests of all consuming files).
*   **`packages/client/src/events/handler.ts`**: Requires updated test file (Reason: The file is CRITICAL and its core command routing logic is being modified to handle new event types).
*   **`webview-ui/src/App.svelte`**: Requires updated test file (Reason: The file is CRITICAL as the root UI component, and its composition logic is changing to import and display the new panel).
*   **`webview-ui/src/components/MissionControlPanel.svelte`**: Requires updated test file (Reason: The file is CRITICAL, and its interaction logic is changing to correctly route events to the new panel).

---

# **Implementation Plan (Finalized)**

### Phase 1: Establish Core Contracts & Headless Logic

#### Task 1.1: `packages/client/src/shared/types.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Domain Model Definition)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/shared/types.ts
     * @architectural-role Type Definition
     * @description Defines the bidirectional message contract for the event bus. This version is updated to include the `InterventionMessage` type for resuming a halted workflow.
     * @core-principles
     * 1. IS the single source of truth for the client's event bus contract.
     * 2. MUST contain only pure TypeScript type/interface definitions.
     */
    ```

#### Task 1.2: `webview-ui/src/components/InterventionPanel.logic.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file webview-ui/src/components/InterventionPanel.logic.ts
     * @architectural-role Business Logic
     * @description Headless logic for the InterventionPanel component. It isolates the creation and dispatching of `InterventionMessage` payloads from the Svelte UI, making the core behavior independently testable.
     * @core-principles
     * 1. IS the single source of truth for the InterventionPanel's interactive behavior.
     * 2. OWNS the logic for creating event payloads for user interventions.
     * 3. MUST be pure TypeScript with no dependencies on Svelte or the DOM.
     */
    ```

#### Task 1.3: `webview-ui/src/components/InterventionPanel.logic.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file webview-ui/src/components/InterventionPanel.logic.spec.ts
     * @test-target webview-ui/src/components/InterventionPanel.logic.ts
     * @description Verifies the contract of the headless `InterventionPanel.logic` module, ensuring it correctly creates and dispatches the `resumeWorkflow` and `retryBlock` event payloads.
     * @criticality The test target is CRITICAL as it contains core business logic for controlling the workflow engine.
     * @testing-layer Unit
     */
    ```

---
### Phase 2: Construct the Presentational UI Component

#### Task 2.1: `webview-ui/src/components/InterventionPanel.svelte` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: I/O & Concurrency Management - it manages cross-thread communication via events)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```html
    <!--
     * @file webview-ui/src/components/InterventionPanel.svelte
     * @architectural-role UI Component
     * @description Provides the unified UI for observing and controlling a workflow. It operates in a read-only mode to display history or an interactive mode (when `isHalted` is true) to accept user guidance and resume execution.
     * @core-principles
     * 1. IS a purely presentational component.
     * 2. OWNS the local UI state (e.g., text input content).
     * 3. DELEGATES all business logic for event dispatching to the imported logic module.
    -->
    ```

#### Task 2.2: `webview-ui/src/components/InterventionPanel.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file webview-ui/src/components/InterventionPanel.spec.ts
     * @test-target webview-ui/src/components/InterventionPanel.svelte
     * @description Verifies the rendering contract of the InterventionPanel. It ensures the interactive controls are correctly shown/hidden based on the `isHalted` prop and that the action buttons are wired to the correct logic handlers.
     * @criticality The test target is CRITICAL as it is the primary user control surface for a halted workflow.
     * @testing-layer Integration
     */
    ```

---
### Phase 3: Integrate Panel into the Application Backend and Frontend

#### Task 3.1: `packages/client/src/events/handler.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/events/handler.ts
     * @architectural-role Orchestrator
     * @description The central event handler that routes incoming messages from the event bus. This version is updated to handle new `resumeWorkflow` and `retryBlock` commands from the Intervention Panel.
     * @core-principles
     * 1. IS the single entry point for all commands from the UI layer.
     * 2. MUST delegate all business logic to the appropriate service or store.
     * 3. MUST NOT contain any business logic itself.
     */
    ```

#### Task 3.2: `packages/client/src/events/handler.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/events/handler.spec.ts
     * @test-target packages/client/src/events/handler.ts
     * @description Verifies that the event handler correctly routes new `resumeWorkflow` and `retryBlock` commands to the appropriate (mocked) Orchestrator service methods.
     * @criticality The test target is CRITICAL as it is a core orchestrator.
     * @testing-layer Unit
     */
    ```

#### Task 3.3: `webview-ui/src/App.svelte` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration - it orchestrates the entire UI view)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```html
    <!--
     * @file webview-ui/src/App.svelte
     * @architectural-role UI Component
     * @description The root UI component for the webview. It acts as a view controller, listening for messages from the extension host and managing the visibility and state of its child components, including the new InterventionPanel.
     * @core-principles
     * 1. IS the top-level container for all webview UI.
     * 2. OWNS the state that determines which primary view is visible.
     * 3. DELEGATES all complex UI to child components.
    -->
    ```

#### Task 3.4: `webview-ui/src/App.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file webview-ui/src/App.spec.ts
     * @test-target webview-ui/src/App.svelte
     * @description Verifies the view-switching and data-routing logic of the root App component, ensuring that it correctly renders and passes state to the InterventionPanel based on simulated messages from the extension host.
     * @criticality The test target is CRITICAL as it is the root of the UI application.
     * @testing-layer Integration
     */
    ```

#### Task 3.5: `webview-ui/src/components/MissionControlPanel.svelte` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: I/O & Concurrency Management - it dispatches events across the webview-extension boundary)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```html
    <!--
     * @file webview-ui/src/components/MissionControlPanel.svelte
     * @architectural-role UI Component
     * @description Provides the UI for the "living Visio diagram." It is a purely presentational component that renders the workflow state and emits a `blockSelected` event when the user interacts with a block.
     * @core-principles
     * 1. IS a purely presentational component.
     * 2. OWNS the DOM structure for the workflow graph.
     * 3. DELEGATES all business logic to its parent or headless modules.
    -->
    ```

#### Task 3.6: `webview-ui/src/components/MissionControlPanel.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file webview-ui/src/components/MissionControlPanel.spec.ts
     * @test-target webview-ui/src/components/MissionControlPanel.svelte
     * @description Verifies the rendering contract of the MissionControlPanel and ensures that user clicks on workflow blocks correctly dispatch the `blockSelected` event for other components to consume.
     * @criticality The test target is CRITICAL as it handles user interaction for a core feature.
     * @testing-layer Integration
     */
    ```