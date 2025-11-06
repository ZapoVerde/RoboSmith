# **Blueprint (Test Assessment)**

*   **`packages/client/lib/workflow/WorkflowService.ts`**: Requires new test file (Reason: CRITICAL new file that introduces core business logic for manifest loading and performs file system I/O).
*   **`packages/client/src/shared/types.ts`**: No test file required (Reason: Contains only TypeScript type definitions; its correctness is verified by the compiler and tests of consuming files).
*   **`packages/client/lib/workflow/ActionHandler.ts`**: Requires new test file (Reason: CRITICAL new file containing the core business logic for all state transitions in the workflow engine).
*   **`packages/client/lib/workflow/Orchestrator.transitions.ts`**: Requires new/updated test file (Reason: CRITICAL file being completely rewritten with complex state management and orchestration logic).
*   **`packages/client/src/events/handler.ts`**: Requires updated test file (Reason: CRITICAL file whose logic for instantiating the `Orchestrator` is changing to accommodate new dependencies).
*   **`packages/client/src/extension.ts`**: Requires updated test file (Reason: CRITICAL file whose construction of the `EventHandlerContext` is changing, affecting the dependencies passed to the command handler).
*   **`packages/client/src/lib/ai/ApiPoolManager.ts`**: Requires updated test file (Reason: CRITICAL file whose public `execute` method signature is changing, altering its public contract).

---

# **Blueprint (Finalized)**

### **1. File Manifest (Complete Scope)**
*   `packages/client/src/events/handler.spec.ts`
*   `packages/client/src/events/handler.ts`
*   `packages/client/src/extension.spec.ts`
*   `packages/client/src/extension.ts`
*   `packages/client/src/lib/ai/ApiPoolManager.spec.ts`
*   `packages/client/src/lib/ai/ApiPoolManager.ts`
*   `packages/client/src/lib/workflow/ActionHandler.spec.ts`
*   `packages/client/src/lib/workflow/ActionHandler.ts`
*   `packages/client/src/lib/workflow/Orchestrator.context.spec.ts`
*   `packages/client/src/lib/workflow/Orchestrator.context.ts`
*   `packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts`
*   `packages/client/src/lib/workflow/Orchestrator.transitions.ts`
*   `packages/client/src/lib/workflow/WorkflowService.spec.ts`
*   `packages/client/src/lib/workflow/WorkflowService.ts`
*   `packages/client/src/shared/types.ts`

### **2. Logical Change Summary (Complete)**

#### **Core Changes:**
*   **`packages/client/src/lib/workflow/WorkflowService.ts`**: This new singleton service will be created to act as the authoritative loader for the workflow manifest. Its sole responsibility will be to locate, read, parse, and perform schema validation on the `.vision/workflows.json` file, abstracting all related file system I/O and ensuring the Orchestrator receives a guaranteed-valid set of instructions.
*   **`packages/client/src/shared/types.ts`**: This file will be refactored to define the new, canonical data contracts for the workflow engine. All previous "Step"-based interfaces will be removed and replaced with the core architectural entities: `ContextSegment`, `ExecutionPayload`, `Transition`, `BlockDefinition`, and `NodeDefinition`.
*   **`packages/client/src/lib/workflow/ActionHandler.ts`**: This new, stateless utility module will be created to exclusively own the logic for parsing and executing the workflow engine's action DSL. It will contain a pure function that accepts an action string (e.g., `JUMP:TargetId`, `CALL:NodeId`, `RETURN`) and the current runtime state (the return stack), and will return the new state, cleanly separating this atomic transition logic from the Orchestrator's main loop.
*   **`packages/client/src/lib/workflow/Orchestrator.context.ts`**: This new, stateless utility module will be created to own all logic related to context and memory assembly. It will be responsible for implementing the five-layer memory model, respecting context inheritance boundaries, and processing payload merge strategies.
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.ts`**: This file will be rewritten to implement the new core `Orchestrator` engine. Its primary responsibility is to manage the main execution loop: delegate context assembly, execute a Block's designated worker, capture the resulting `Signal`, look up the corresponding `Action` in the manifest's transition table (including the `SIGNAL:FAIL_DEFAULT` fallback), and delegate that action's execution to the `ActionHandler`. It will own the complete runtime state, including the `ExecutionPayload` and the `ReturnStack`.
*   **`packages/client/src/events/handler.ts`**: The central event handler will be refactored. The logic for the `startWorkflow` command case will be updated to instantiate the new `Orchestrator` engine, providing it with all necessary service dependencies (such as the `ApiPoolManager` and `ContextPartitionerService`) which are passed in via its context object. It will then invoke the Orchestrator's public `executeNode` method to begin the workflow.

#### **Collateral (Fixing) Changes:**
*   **`packages/client/src/extension.ts`**: The `activate` function, acting as the application's composition root, will be updated. When creating the `EventHandlerContext`, it will now pass the fully instantiated and initialized `ContextPartitionerService` and `ApiPoolManager` singleton instances to conform to the `EventHandlerContext` interface's new contract.
*   **`packages/client/src/lib/ai/ApiPoolManager.ts`**: The `execute` method will be refactored to align with the new workflow data contracts. Its `workOrder` parameter will now expect a `context` property of type `ExecutionPayload` (an array of `ContextSegment` objects), replacing any previous data structure.

### **3. API Delta Ledger (Complete)**

---
#### **New Core Files (Initial Public API)**

*   **File:** `packages/client/src/lib/workflow/WorkflowService.ts`
    *   **Symbol:** `WorkflowService` (Class)
    *   **Before:** None.
    *   **After:** `export class WorkflowService { static getInstance(): WorkflowService; public async loadWorkflow(workspaceRoot: string): Promise<WorkflowManifest>; }`
*   **File:** `packages/client/src/lib/workflow/ActionHandler.ts`
    *   **Symbol:** `executeAction` (Function)
    *   **Before:** None.
    *   **After:** `export function executeAction(params: ActionParams): ActionResult`
*   **File:** `packages/client/src/lib/workflow/Orchestrator.context.ts`
    *   **Symbol:** `assembleContext` (Function)
    *   **Before:** None.
    *   **After:** `export function assembleContext(...): ContextSegment[]`

---
#### **Modified Files (Changes to Existing API)**

*   **File:** `packages/client/src/shared/types.ts`
    *   **Symbol:** `NodeDefinition`, `BlockDefinition`, `ExecutionPayload`, etc. (Interfaces/Types)
    *   **Before:** None.
    *   **After:** `export interface NodeDefinition { ... }`, `export interface BlockDefinition { ... }`, etc.
*   **File:** `packages/client/src/lib/workflow/Orchestrator.transitions.ts`
    *   **Symbol:** `Orchestrator` (Class Constructor)
    *   **Before:** (Implicit or old dependencies)
    *   **After:** `constructor(manifest: WorkflowManifest, contextService: ContextPartitionerService, apiManager: ApiPoolManager, onStateUpdate: (state: PlanningState) => void)`
    *   **Symbol:** `executeNode` (Public Method)
    *   **Before:** `public async executeNode(nodeId: string): Promise<void>`
    *   **After:** `public async executeNode(startNodeId: string): Promise<void>`
*   **File:** `packages/client/src/events/handler.ts`
    *   **Symbol:** `EventHandlerContext` (Interface)
    *   **Before:** `{ secureStorageService: SecureStorageService; panel: WebviewPanel; manifest: WorkflowManifest; }`
    *   **After:** `{ secureStorageService: SecureStorageService; panel: WebviewPanel; manifest: WorkflowManifest; contextService: ContextPartitionerService; apiManager: ApiPoolManager; }`
*   **File:** `packages/client/src/lib/ai/ApiPoolManager.ts`
    *   **Symbol:** `execute` (Public Method in `ApiPoolManager`)
    *   **Before:** `public async execute(workOrder: { worker: string; /* old context type */ }): Promise<WorkerResult>`
    *   **After:** `public async execute(workOrder: { worker: string; context: ExecutionPayload }): Promise<WorkerResult>`

    ---

    # **Implementation Plan (Finalized)**

### Phase 1: Establish Foundational Contracts & Manifest Loading

#### Task 1.1: `packages/client/src/shared/types.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Domain Model Definition)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/shared/types.ts
     * @architectural-role Type Definition
     * @description Defines the bidirectional message contract for the event bus and the core data contracts for the Block/Node Workflow Engine. It is the single source of truth for all type-safe communication and manifest structures.
     * @core-principles
     * 1. IS the single source of truth for the client's event bus and workflow contracts.
     * 2. MUST contain only pure TypeScript type/interface definitions.
     * 3. ENFORCES the final, hardened architectural model of Nodes, Blocks, and Payloads.
     */
    ```

#### Task 1.2: `packages/client/src/lib/workflow/WorkflowService.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: I/O & Concurrency Management, Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/WorkflowService.ts
     * @architectural-role Configuration
     * @description A singleton service responsible for locating, reading, parsing, and validating the `.vision/workflows.json` manifest file. It acts as the secure loader for the Orchestrator, ensuring that any workflow manifest is structurally sound and type-safe before execution.
     * @core-principles
     * 1. IS the single source of truth for loading the workflow manifest.
     * 2. MUST guarantee the structural integrity of the manifest via schema validation.
     * 3. MUST abstract all file system I/O related to loading the configuration.
     */
    ```

#### Task 1.3: `packages/client/src/lib/workflow/WorkflowService.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/WorkflowService.spec.ts
     * @test-target packages/client/src/lib/workflow/WorkflowService.ts
     * @description Verifies the contract of the WorkflowService, ensuring it correctly locates, reads, and validates the `workflows.json` manifest, and that it throws specific, user-friendly errors for all anticipated failure modes.
     * @criticality The test target is CRITICAL as it is the loader for the Orchestrator's instructions.
     * @testing-layer Unit
     */
    ```

### Phase 2: Construct the Core Orchestrator Engine

#### Task 2.1: `packages/client/src/lib/workflow/ActionHandler.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/ActionHandler.ts
     * @architectural-role Utility
     * @description Contains the pure, stateless logic for executing the atomic actions (`JUMP`, `CALL`, `RETURN`) of the workflow engine's Domain Specific Language (DSL).
     * @core-principles
     * 1. IS a pure function module; it contains no state of its own.
     * 2. OWNS the parsing and execution logic for the action DSL string.
     * 3. MUST NOT contain any business logic beyond state transitions.
     */
    ```

#### Task 2.2: `packages/client/src/lib/workflow/ActionHandler.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/ActionHandler.spec.ts
     * @test-target packages/client/src/lib/workflow/ActionHandler.ts
     * @description Verifies the contract of the `executeAction` function, ensuring it correctly parses and executes all atomic workflow commands and handles invalid or malformed actions gracefully.
     * @criticality The test target is CRITICAL as it contains core business logic for state transitions.
     * @testing-layer Unit
     */
    ```

#### Task 2.3: `packages/client/src/lib/workflow/Orchestrator.context.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.context.ts
     * @architectural-role Business Logic
     * @description A dedicated module for handling all context assembly and memory management for the Orchestrator engine. It is responsible for implementing the five-layer memory model, respecting context inheritance boundaries, and processing payload merge strategies.
     * @core-principles
     * 1. OWNS all logic related to context and memory assembly.
     * 2. IS a pure, stateless module that operates on inputs from the Orchestrator.
     * 3. ENFORCES context boundaries defined by the `context_inheritance` flag.
     */
    ```

#### Task 2.4: `packages/client/src/lib/workflow/Orchestrator.context.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.context.spec.ts
     * @test-target packages/client/src/lib/workflow/Orchestrator.context.ts
     * @description Test suite for the Orchestrator's context management, verifying correct handling of nested node calls, context inheritance boundaries, and payload assembly.
     * @criticality The test target is CRITICAL as it contains core business logic.
     * @testing-layer Integration
     */
    ```

#### Task 2.5: `packages/client/src/lib/workflow/Orchestrator.transitions.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: State Store Ownership, Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.transitions.ts
     * @architectural-role Orchestrator
     * @description The deterministic, graph-based execution engine. This module contains the core state machine logic and depends on injected services for all I/O.
     * @core-principles
     * 1. IS a deterministic state machine, not a speculative agent.
     * 2. OWNS the execution loop and runtime state (Payload, Return Stack).
     * 3. DELEGATES all AI calls and context slicing to injected services.
     */
    ```

#### Task 2.6: `packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts
     * @test-target packages/client/src/lib/workflow/Orchestrator.transitions.ts
     * @description Verifies the core state transition logic of the Orchestrator by providing mocked service dependencies (ApiPoolManager, ContextPartitionerService).
     * @criticality The test target is CRITICAL.
     * @testing-layer Integration
     */
    ```

### Phase 3: Integrate Engine and Update Service Dependencies

#### Task 3.1: `packages/client/src/lib/ai/ApiPoolManager.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration, I/O & Concurrency Management)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/ApiPoolManager.ts
     * @architectural-role Orchestrator
     * @description Implements the core stateful orchestrator for the AI Service Layer. It manages the pool of `ApiKey`s, executes the "key carousel" logic, and handles failover.
     * @core-principles
     * 1. IS the single, stateful entry point for all AI requests from the application.
     * 2. OWNS the key pool, the round-robin state, and the failover logic.
     * 3. DELEGATES all actual network I/O to the stateless `aiClient` façade.
     */
    ```

#### Task 3.2: `packages/client/src/lib/ai/ApiPoolManager.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/ApiPoolManager.spec.ts
     * @test-target packages/client/src/lib/ai/ApiPoolManager.ts
     * @description Verifies the ApiPoolManager's orchestration logic, including the key carousel (round-robin) and failover mechanisms, using a mocked aiClient.
     * @criticality The test target is CRITICAL as it orchestrates core business logic and manages state.
     * @testing-layer Unit
     */
    ```

#### Task 3.3: `packages/client/src/events/handler.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/events/handler.ts
     * @architectural-role Orchestrator
     * @description A factory for creating an event handler. It routes commands from the UI to the appropriate backend services, which are provided via a context object.
     * @core-principles
     * 1. IS the single entry point for all commands from the UI layer.
     * 2. MUST delegate all business logic to the appropriate service or store.
     * 3. MUST NOT contain any business logic itself.
     */
    ```

#### Task 3.4: `packages/client/src/events/handler.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/events/handler.spec.ts
     * @test-target packages/client/src/events/handler.ts
     * @description Verifies that the event handler correctly routes the 'startWorkflow' command to instantiate and execute the Orchestrator with the correct dependencies.
     * @criticality The test target is CRITICAL as it is a core orchestrator.
     * @testing-layer Unit
     */
    ```

#### Task 3.5: `packages/client/src/extension.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/extension.ts
     * @architectural-role Feature Entry Point
     * @description The main activation entry point for the VS Code extension. It is responsible for initializing all singleton services and setting up the application's composition root.
     * @core-principles
     * 1. IS the composition root for the entire backend application.
     * 2. OWNS the initialization and lifecycle of all singleton services.
     * 3. DELEGATES all ongoing work to other services after initialization.
     */
    ```

#### Task 3.6: `packages/client/src/extension.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/extension.spec.ts
     * @test-target packages/client/src/extension.ts
     * @description Verifies the extension's activation logic, ensuring that the `EventHandlerContext` is correctly assembled with all necessary service instances.
     * @criticality The test target is CRITICAL as it is the application's entry point.
     * @testing-layer Integration
     */
    ```