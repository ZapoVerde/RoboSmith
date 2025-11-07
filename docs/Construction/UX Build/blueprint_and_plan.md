# **Blueprint (Finalized)**

### **1. File Manifest (Complete Scope)**
*   `packages/client/src/extension.ts`
*   `packages/client/src/extension.spec.ts`
*   `packages/client/src/events/handler.ts`
*   `packages/client/src/events/handler.spec.ts`
*   `packages/client/src/lib/workflow/Orchestrator.transitions.ts`
*   `packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts`
*   `packages/client/src/lib/git/GitWorktreeManager.ts`
*   `packages/client/src/lib/git/GitWorktreeManager.spec.ts`
*   `packages/client/src/shared/types.ts`
*   `webview-ui/src/App.svelte`
*   `webview-ui/src/App.spec.ts`
*   `webview-ui/src/main.ts`
*   `webview-ui/src/components/MissionControlPanel.svelte`
*   `webview-ui/src/components/MissionControlPanel.spec.ts`
*   `webview-ui/src/components/MissionControlPanel.logic.ts`
*   `webview-ui/src/components/MissionControlPanel.logic.spec.ts`
*   `webview-ui/src/components/IntegrationPanel.svelte`
*   `webview-ui/src/components/IntegrationPanel.spec.ts`
*   `webview-ui/src/components/IntegrationPanel.logic.ts`
*   `webview-ui/src/components/IntegrationPanel.logic.spec.ts`

### **2. Logical Change Summary (Complete)**

#### **Core Changes:**
*   **`packages/client/src/extension.ts`**: This file will register a new global command responsible for creating and displaying the **Status Bar Navigator**. The command's handler will orchestrate fetching all active workflow sessions, building the `vscode.QuickPick` dropdown menu, and executing the programmatic workspace switch upon user selection. It will also be responsible for managing the primary WebView panel's lifecycle, switching its view between the Mission Control Panel and the Integration Panel based on workflow state events.
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.ts`**: The logic for publishing state updates will be enhanced. The orchestrator will now assemble and emit a comprehensive `WorkflowViewState` object via its `onStateUpdate` callback. This object will contain not only the live execution payload but also the static structural definition of the current node's graph (blocks and transitions) to enable the "living Visio diagram" UI. Upon graceful termination, it will signal completion to allow the UI layer to display the Integration Panel.
*   **`packages/client/src/events/handler.ts`**: The event handler's primary switch statement will be expanded to process new messages originating from the Integration Panel and Mission Control Panel. It will add cases for `blockSelected`, `openTerminalInWorktree`, `acceptAndMerge`, `rejectAndDiscard`, and `finishAndHold`. The logic for these new cases will delegate the required Git and state management operations to the appropriate services, primarily the `GitWorktreeManager`.
*   **`packages/client/src/shared/types.ts`**: This central contract file will be updated with new type definitions to support the entire UI phase. A `WorkflowViewState` interface will be added to define the rich state object for the Mission Control Panel. New message types will be defined for the full communication contract of the Integration Panel, detailing the payloads for both showing the panel and for handling the user's final decision.
*   **`webview-ui/src/components/MissionControlPanel.svelte`**: This new Svelte component will serve as the primary supervisory UI. It will be a purely presentational component that receives the comprehensive `WorkflowViewState` object as a prop. Its logic will be confined to rendering the workflow as an interactive flowchart, applying dynamic styles to reflect real-time execution status, and importing and delegating all user interactions (such as clicking a block) to the `MissionControlPanel.logic.ts` module.
*   **`webview-ui/src/components/MissionControlPanel.logic.ts`**: Following the established headless component pattern, this new file will contain the pure, testable logic for the Mission Control Panel. It will export functions to handle user interactions, such as `handleBlockClick`, which will be responsible for creating and dispatching the correctly formatted `blockSelected` event payload to the backend.
*   **`webview-ui/src/components/IntegrationPanel.svelte`**: This new Svelte component provides the UI for the final step of a workflow. It will display the results of the completed task and render the primary user actions for validation and disposition. It will be a purely presentational component that imports and delegates all user-initiated actions to its corresponding `IntegrationPanel.logic.ts` file.
*   **`webview-ui/src/components/IntegrationPanel.logic.ts`**: This new file will implement the headless, testable logic for the Integration Panel, conforming to the established pattern. It will export functions such as `handleAccept`, `handleReject`, `handleHold`, and `handleOpenTerminal`. These functions will be responsible for creating the correctly-typed `FinalDecisionMessage` payloads and dispatching them to the backend event handler.

#### **Collateral (Fixing) Changes:**
*   **`packages/client/src/lib/git/GitWorktreeManager.ts`**: A new public method, `getAllSessions`, will be added. This method will return a readonly array of all currently active `WorktreeSession` objects from the service's internal state map, providing the necessary data for the Status Bar Navigator to build its UI.
*   **`webview-ui/src/App.svelte`**: This root component will be updated to act as the main view controller for the webview. It will implement a message listener to handle incoming state updates from the extension host and manage a local state variable to determine which primary view (`MissionControlPanel` or `IntegrationPanel`) is currently visible, conditionally rendering the appropriate component.
*   **`webview-ui/src/main.ts`**: No logical changes are required. This file's purpose as the application entry point remains the same.
*   **`webview-ui/src/components/MissionControlPanel.logic.spec.ts`**: This new test file will be created to provide unit test coverage for the `MissionControlPanel.logic.ts` module, verifying its event creation and dispatching logic.
*   **`webview-ui/src/components/IntegrationPanel.logic.spec.ts`**: This new test file will be created to provide unit test coverage for the `IntegrationPanel.logic.ts` module, ensuring it correctly creates and dispatches all `FinalDecisionMessage` payloads.
*   **`packages/client/src/lib/git/GitWorktreeManager.spec.ts`**: The existing test suite will be updated to include a new test case for the `getAllSessions` method, ensuring it accurately returns the current state of the internal session map.

### **3. API Delta Ledger (Complete)**
*   **File:** `packages/client/src/lib/workflow/Orchestrator.transitions.ts`
    *   **Symbol:** `onStateUpdate` (callback in constructor)
    *   **Before:** `(state: PlanningState) => void`
    *   **After:** `(state: WorkflowViewState) => void`
*   **File:** `packages/client/src/shared/types.ts`
    *   **Symbol:** (New Export) `WorkflowViewState`
    *   **Before:** N/A
    *   **After:** `export interface WorkflowViewState { graph: object; statuses: object; lastTransition: object | null; executionLog: object; allWorkflowsStatus: object[]; }`
    *   **Symbol:** (New Export) `TaskReadyForIntegrationMessage`
    *   **Before:** N/A
    *   **After:** `export interface TaskReadyForIntegrationMessage { command: 'taskReadyForIntegration'; payload: { sessionId: string; branchName: string; ... }; }`
    *   **Symbol:** (New Export) `FinalDecisionMessage`
    *   **Before:** N/A
    *   **After:** `export type FinalDecisionMessage = | { command: 'openTerminalInWorktree'; ... } | { command: 'acceptAndMerge'; ... } | { command: 'rejectAndDiscard'; ... } | { command: 'finishAndHold'; ... };`
*   **File:** `packages/client/src/lib/git/GitWorktreeManager.ts`
    *   **Symbol:** (New Export) `getAllSessions`
    *   **Before:** N/A
    *   **After:** `public getAllSessions(): readonly WorktreeSession[]`

    ---

    # **Blueprint (Test Assessment)**

*   **`packages/client/src/extension.ts`**: Requires new/updated test file (Reason: Introduces new business logic for command registration and UI orchestration).
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.ts`**: Requires new/updated test file (Reason: The public API contract of the `onStateUpdate` callback has changed).
*   **`packages/client/src/events/handler.ts`**: Requires new/updated test file (Reason: Introduces new business logic to handle events from new UI components).
*   **`packages/client/src/shared/types.ts`**: No test file required (Reason: Contains only type definitions).
*   **`webview-ui/src/components/MissionControlPanel.svelte`**: Requires new test file (Reason: New UI component that requires rendering and interaction tests).
*   **`webview-ui/src/components/MissionControlPanel.logic.ts`**: Requires new test file (Reason: New module containing testable business logic).
*   **`webview-ui/src/components/IntegrationPanel.svelte`**: Requires new test file (Reason: New UI component that requires rendering and interaction tests).
*   **`webview-ui/src/components/IntegrationPanel.logic.ts`**: Requires new test file (Reason: New module containing testable business logic).
*   **`packages/client/src/lib/git/GitWorktreeManager.ts`**: Requires new/updated test file (Reason: A new public method will be added to expose the session list to the UI layer).
*   **`webview-ui/src/App.svelte`**: Requires new/updated test file (Reason: Core UI composition logic will change to manage the visibility of the new panels).
*   **`webview-ui/src/main.ts`**: No test file required (Reason: Trivial configuration file).
*   **`webview-ui/src/components/MissionControlPanel.logic.spec.ts`**: Is a new test file.
*   **`webview-ui/src/components/IntegrationPanel.logic.spec.ts`**: Is a new test file.
*   **`packages/client/src/lib/git/GitWorktreeManager.spec.ts`**: Is an updated test file.

---

# **Implementation Plan (Finalized)**

### **Phase 1: Establish Core UI Data Contracts**

#### **Task 1.1: `packages/client/src/shared/types.ts` (Source)**
*   **6-Point Rubric Assessment:** Critical (Reason: Core Domain Model Definition)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    /**
     * @file packages/client/src/shared/types.ts
     * @stamp <STAMP>
     * @architectural-role Type Definition
     * @description
     * Defines the complete, bidirectional message contract for the asynchronous event
     * bus and the core data contracts for the Block/Node Workflow Engine. It is the
     * single source of truth for all type-safe communication and workflow manifest
     * structures.
     * @core-principles
     * 1. IS the single source of truth for the client's event bus and workflow contracts.
     * 2. MUST contain only pure TypeScript type/interface definitions.
     * 3. ENFORCES the final, hardened architectural model of Nodes, Blocks, and Payloads.
     *
     * @api-declaration
     *   - Type Aliases for Event Bus: `Message`, `ExtensionMessage`
     *   - Interfaces for Workflow Engine: `ContextSegment`, `Transition`, `BlockDefinition`, `NodeDefinition`, `WorkflowViewState`
     *   - Type Alias for Workflow Engine: `ExecutionPayload`
     */

---
### **Phase 2: Evolve Backend Services for UI Orchestration**

#### **Task 2.1: `packages/client/src/lib/workflow/Orchestrator.transitions.ts` (Source)**
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.transitions.ts
     * @stamp <STAMP>
     * @architectural-role Orchestrator
     * @description The deterministic, graph-based execution engine. This module contains the core state machine logic and depends on injected services for all I/O.
     * @core-principles
     * 1. IS a deterministic state machine, not a speculative agent.
     * 2. OWNS the execution loop and runtime state (Payload, Return Stack).
     * 3. DELEGATES all AI calls and context slicing to injected services.
     *
     * @api-declaration
     *   - export class Orchestrator
     *   -   constructor(..., onStateUpdate: (state: WorkflowViewState) => void)
     *   -   public async executeNode(startNodeId: string, worktreePath: string): Promise<void>
     */

#### **Task 2.2: `packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts` (Verification)**
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts
     * @stamp <STAMP>
     * @test-target packages/client/src/lib/workflow/Orchestrator.transitions.ts
     * @description
     * An integration test suite for the Orchestrator's core state transition and
     * execution logic. It verifies all Action DSL commands, default fallback paths,
     * and the correct assembly and emission of the `WorkflowViewState` object.
     */

#### **Task 2.3: `packages/client/src/lib/git/GitWorktreeManager.ts` (Source)**
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    /**
     * @file packages/client/src/lib/git/GitWorktreeManager.ts
     * @stamp <STAMP>
     * @architectural-role Orchestrator
     * @description
     * The authoritative service for orchestrating the lifecycle, state, and
     * conflict detection of all Git worktrees. It is a pure orchestrator that
     * depends on an injected IGitAdapter to perform all I/O.
     * @core-principles
     * 1. OWNS the stateful logic for the worktree reconciliation loop.
     * 2. DELEGATES all Git commands, file system reads, and state persistence to the adapter.
     * 3. MUST be fully testable in isolation with a mock adapter.
     *
     * @api-declaration
     *   - export class GitWorktreeManager
     *   -   public async initialize(): Promise<void>
     *   -   public async createWorktree(args: CreateWorktreeArgs): Promise<WorktreeSession>
     *   -   public async removeWorktree(sessionId: string): Promise<void>
     *   -   public async runConflictScan(newChangePlan: string[]): Promise<ConflictScanResult>
     *   -   public getAllSessions(): readonly WorktreeSession[]
     */

#### **Task 2.4: `packages/client/src/lib/git/GitWorktreeManager.spec.ts` (Verification)**
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    /**
     * @file packages/client/src/lib/git/GitWorktreeManager.spec.ts
     * @stamp <STAMP>
     * @test-target packages/client/src/lib/git/GitWorktreeManager.ts
     * @description Verifies the orchestration logic of the GitWorktreeManager in
     * isolation using a mocked IGitAdapter. It tests the reconciliation loop,
     * state management, command delegation, and the new `getAllSessions` method.
     */

#### **Task 2.5: `packages/client/src/events/handler.ts` (Source)**
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    /**
     * @file packages/client/src/events/handler.ts
     * @stamp <STAMP>
     * @architectural-role Orchestrator
     * @description A factory for creating an event handler. It routes commands from
     * the UI to the appropriate backend services, including new commands for UI
     * orchestration and final workflow disposition.
     * @core-principles
     * 1. IS the single entry point for all commands from the UI layer.
     * 2. DELEGATES all business logic to the appropriate service or store.
     * 3. ENFORCES testability by design through state encapsulation.
     */

#### **Task 2.6: `packages/client/src/events/handler.spec.ts` (Verification)**
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    /**
     * @file packages/client/src/events/handler.spec.ts
     * @stamp <STAMP>
     * @test-target packages/client/src/events/handler.ts
     * @description Verifies that the event handler correctly routes all commands,
     * including the new `acceptAndMerge`, `rejectAndDiscard`, etc., to the
     * correct backend service methods.
     */

#### **Task 2.7: `packages/client/src/extension.ts` (Source)**
*   **6-Point Rubric Assessment:** Critical (Reason: High Fan-Out (System-Wide Dependency))
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    /**
     * @file packages/client/src/extension.ts
     * @stamp <STAMP>
     * @architectural-role Feature Entry Point
     * @description The main activation entry point for the VS Code extension. It is
     * responsible for initializing all singleton services and setting up the
     * application's composition root, including registering the new Status Bar Navigator command.
     * @core-principles
     * 1. IS the composition root for the entire backend application.
     * 2. OWNS the initialization and lifecycle of all singleton services.
     * 3. DELEGATES all ongoing work to other services after initialization.
     */

#### **Task 2.8: `packages/client/src/extension.spec.ts` (Verification)**
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    /**
     * @file packages/client/src/extension.spec.ts
     * @stamp <STAMP>
     * @test-target packages/client/src/extension.ts
     * @description Verifies the extension's activation logic, ensuring that all
     * services are correctly instantiated and that the new `roboSmith.showNavigator`
     * command is correctly registered.
     */

---
### **Phase 3: Implement Headless Logic for UI Components**

#### **Task 3.1: `webview-ui/src/components/MissionControlPanel.logic.ts` (Source)**
*   **6-Point Rubric Assessment:** Not Critical
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    /**
     * @file webview-ui/src/components/MissionControlPanel.logic.ts
     * @stamp <STAMP>
     * @architectural-role Business Logic
     * @description Headless logic for the MissionControlPanel component. Isolates
     * event dispatching from the Svelte UI, making it independently testable.
     * @core-principles
     * 1. IS the single source of truth for the MissionControlPanel's behavior.
     * 2. OWNS the logic for creating event payloads for user interactions.
     * 3. MUST be pure TypeScript with no dependencies on Svelte or the DOM.
     *
     * @api-declaration
     *   - function handleBlockClick(dispatch: function, blockId: string): void
     */

#### **Task 3.2: `webview-ui/src/components/MissionControlPanel.logic.spec.ts` (Verification)**
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    /**
     * @file webview-ui/src/components/MissionControlPanel.logic.spec.ts
     * @stamp <STAMP>
     * @test-target webview-ui/src/components/MissionControlPanel.logic.ts
     * @description Verifies the contract of the headless `MissionControlPanel.logic`
     * module, ensuring it correctly creates and dispatches the `blockSelected` event payload.
     */

#### **Task 3.3: `webview-ui/src/components/IntegrationPanel.logic.ts` (Source)**
*   **6-Point Rubric Assessment:** Not Critical
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    /**
     * @file webview-ui/src/components/IntegrationPanel.logic.ts
     * @stamp <STAMP>
     * @architectural-role Business Logic
     * @description Headless logic for the IntegrationPanel component. Isolates
     * event dispatching for all final disposition actions from the Svelte UI.
     * @core-principles
     * 1. IS the single source of truth for the IntegrationPanel's behavior.
     * 2. OWNS the logic for creating and dispatching all `FinalDecisionMessage` payloads.
     * 3. MUST be pure TypeScript with no dependencies on Svelte or the DOM.
     *
     * @api-declaration
     *   - function handleAccept(dispatch: function, sessionId: string): void
     *   - function handleReject(dispatch: function, sessionId: string): void
     *   - function handleHold(dispatch: function, sessionId: string): void
     *   - function handleOpenTerminal(dispatch: function, sessionId: string): void
     */

#### **Task 3.4: `webview-ui/src/components/IntegrationPanel.logic.spec.ts` (Verification)**
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    /**
     * @file webview-ui/src/components/IntegrationPanel.logic.spec.ts
     * @stamp <STAMP>
     * @test-target webview-ui/src/components/IntegrationPanel.logic.ts
     * @description Verifies the contract of the headless `IntegrationPanel.logic`
     * module, ensuring it correctly creates and dispatches all final decision event payloads.
     */

---
### **Phase 4: Construct and Integrate Presentational UI Components**

#### **Task 4.1: `webview-ui/src/components/MissionControlPanel.svelte` (Source)**
*   **6-Point Rubric Assessment:** Not Critical
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    /**
     * @file webview-ui/src/components/MissionControlPanel.svelte
     * @stamp <STAMP>
     * @architectural-role UI Component
     * @description Provides the UI for the "living Visio diagram." It is a purely
     * presentational component that renders the `WorkflowViewState` and delegates
     * all business logic to its headless `.logic.ts` module.
     * @core-principles
     * 1. IS a purely presentational component.
     * 2. OWNS the DOM structure for the workflow graph.
     * 3. DELEGATES all business logic to the imported logic module.
     *
     * @api-declaration
     *   - PROPS:
     *     - export let state: WorkflowViewState;
     *   - EVENTS:
     *     - on:blockSelected (payload: { blockId: string })
     */

#### **Task 4.2: `webview-ui/src/components/MissionControlPanel.spec.ts` (Verification)**
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    /**
     * @file webview-ui/src/components/MissionControlPanel.spec.ts
     * @stamp <STAMP>
     * @test-target webview-ui/src/components/MissionControlPanel.svelte
     * @description Verifies the rendering contract of the MissionControlPanel, ensuring
     * it correctly visualizes the graph and applies status styles based on the input `state` prop.
     */

#### **Task 4.3: `webview-ui/src/components/IntegrationPanel.svelte` (Source)**
*   **6-Point Rubric Assessment:** Not Critical
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    /**
     * @file webview-ui/src/components/IntegrationPanel.svelte
     * @stamp <STAMP>
     * @architectural-role UI Component
     * @description Provides the UI for the final workflow disposition step. It is a
     * purely presentational component that delegates all business logic to its
     * headless `.logic.ts` module.
     * @core-principles
     * 1. IS a purely presentational component.
     * 2. OWNS the DOM structure for the final action buttons.
     * 3. DELEGATES all business logic to the imported logic module.
     *
     * @api-declaration
     *   - PROPS:
     *     - export let taskDetails: TaskReadyForIntegrationMessage['payload'];
     *   - EVENTS:
     *     - on:accept | on:reject | on:hold | on:openTerminal
     */

#### **Task 4.4: `webview-ui/src/components/IntegrationPanel.spec.ts` (Verification)**
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    /**
     * @file webview-ui/src/components/IntegrationPanel.spec.ts
     * @stamp <STAMP>
     * @test-target webview-ui/src/components/IntegrationPanel.svelte
     * @description Verifies the rendering contract of the IntegrationPanel, ensuring
     * it correctly displays task details and that its buttons are wired to the correct logic handlers.
     */

#### **Task 4.5: `webview-ui/src/App.svelte` (Source)**
*   **6-Point Rubric Assessment:** Not Critical
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    /**
     * @file webview-ui/src/App.svelte
     * @stamp <STAMP>
     * @architectural-role UI Component
     * @description The root UI component for the webview. It acts as a view
     * controller, listening for messages from the extension host and conditionally
     * rendering the correct primary view (e.g., MissionControlPanel, IntegrationPanel).
     * @core-principles
     * 1. IS the top-level container for all webview UI.
     * 2. OWNS the state that determines which primary view is visible.
     * 3. DELEGATES all complex UI to child components.
     */

#### **Task 4.6: `webview-ui/src/App.spec.ts` (Verification)**
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    /**
     * @file webview-ui/src/App.spec.ts
     * @stamp <STAMP>
     * @test-target webview-ui/src/App.svelte
     * @description Verifies the view-switching logic of the root App component,
     * ensuring that it correctly renders child components based on simulated
     * messages from the extension host.
     */

#### **Task 4.7: `webview-ui/src/main.ts` (Source)**
*   **6-Point Rubric Assessment:** Not Critical
*   **Validation Tier:** Tier 3: Not Required by Planner
*   **Preamble:**
    /**
     * @file webview-ui/src/main.ts
     * @stamp <STAMP>
     * @architectural-role Configuration
     * @description The main entry point for the Svelte webview application. Its
     * sole responsibility is to instantiate and mount the root App component.
     */