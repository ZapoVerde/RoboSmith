# **Blueprint (Test Assessment)**

*   **`packages/client/src/lib/git/GitWorktreeManager.ts`**: Requires updated test file (Reason: The file is CRITICAL and its internal logic is being rewritten to use the new `IGitAdapter` dependency, requiring a complete change in testing strategy from mocking `vscode` to mocking the adapter).
*   **`packages/client/src/lib/context/R_Mcp_ServerManager.ts`**: Requires updated test file (Reason: The file is CRITICAL and its process spawning logic is being rewritten to use the new `IProcessSpawner` dependency, requiring a new testing strategy).
*   **`packages/client/src/lib/context/ContextPartitionerService.ts`**: Requires updated test file (Reason: The file is CRITICAL and its constructor is changing for dependency injection, requiring tests to be updated to reflect the new instantiation pattern).
*   **`packages/client/src/extension.ts`**: Requires updated test file (Reason: The file is CRITICAL as the application's entry point and is being refactored into a composition root, changing its core initialization and dependency management logic).
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.ts`**: Requires updated test file (Reason: The file is CRITICAL and its constructor is changing to accept injected services, requiring tests to be updated to provide these new dependencies).
*   **`packages/client/src/events/handler.ts`**: Requires updated test file (Reason: The file is CRITICAL and the method by which it receives its service dependencies via its context object is changing, requiring tests to be updated).

# **Blueprint (Finalized)**

### **1. File Manifest (Complete Scope)**
*   `packages/client/src/lib/git/IGitAdapter.ts`
*   `packages/client/src/lib/context/IProcessSpawner.ts`
*   `packages/client/src/lib/git/RealGitAdapter.ts`
*   `packages/client/src/lib/context/RealProcessSpawner.ts`
*   `packages/client/src/lib/git/GitWorktreeManager.ts`
*   `packages/client/src/lib/context/R_Mcp_ServerManager.ts`
*   `packages/client/src/lib/context/ContextPartitionerService.ts`
*   `packages/client/src/extension.ts`
*   `packages/client/src/lib/workflow/Orchestrator.transitions.ts`
*   `packages/client/src/events/handler.ts`
*   `packages/client/src/lib/git/GitWorktreeManager.spec.ts`
*   `packages/client/src/lib/context/R_Mcp_ServerManager.spec.ts`
*   `packages/client/src/lib/context/ContextPartitionerService.spec.ts`
*   `packages/client/src/extension.spec.ts`
*   `packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts`
*   `packages/client/src/events/handler.spec.ts`

### **2. Logical Change Summary (Complete)**

#### **Core Changes:**
*   **`packages/client/src/lib/git/IGitAdapter.ts`**: This new file will be created to formally define the `IGitAdapter` interface, which will serve as the abstract, testable contract for all low-level Git, file system, and state persistence operations.
*   **`packages/client/src/lib/context/IProcessSpawner.ts`**: This new file will be created to define the `IManagedProcess` and `IProcessSpawner` interfaces, providing the abstract boundary for spawning and managing child processes.
*   **`packages/client/src/lib/git/RealGitAdapter.ts`**: This new file will provide the concrete, "real" implementation of the `IGitAdapter` interface, encapsulating all direct calls to the `vscode` API and the Git CLI.
*   **`packages/client/src/lib/context/RealProcessSpawner.ts`**: This new file will provide the concrete, "real" implementation of the `IProcessSpawner` interface, encapsulating all direct calls to the Node.js `child_process` module.
*   **`packages/client/src/lib/git/GitWorktreeManager.ts`**: The service will be refactored to implement Dependency Inversion. All direct I/O calls will be replaced with calls to an injected `IGitAdapter` instance, making the manager a pure orchestrator.
*   **`packages/client/src/lib/context/R_Mcp_ServerManager.ts`**: The service will be refactored to decouple it from the `child_process` module. All process spawning logic will be replaced with a single call to an injected `IProcessSpawner` instance.
*   **`packages/client/src/lib/context/ContextPartitionerService.ts`**: The service will be refactored to make its dependency on the `R_Mcp_ServerManager` explicit via constructor injection, removing the hidden dependency in the static `getInstance` method.

#### **Collateral (Fixing) Changes:**
*   **`packages/client/src/extension.ts`**: The `activate` function will be refactored into the application's **composition root**. It will be responsible for instantiating the new `RealGitAdapter` and `RealProcessSpawner`, and then injecting these concrete dependencies into the constructors of the high-level services (`GitWorktreeManager`, `R_Mcp_ServerManager`, etc.).
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.ts`**: The constructor already accepts its dependencies (`ContextPartitionerService`, `ApiPoolManager`), but the way it is instantiated by the `EventHandler` will be updated to receive the fully-injected service instances from the composition root.
*   **`packages/client/src/events/handler.ts`**: The logic within the `startWorkflow` command case will be updated. The instantiation of the `Orchestrator` will now use the fully-formed, dependency-injected services provided in its `EventHandlerContext`.

### **3. API Delta Ledger (Complete)**

---
#### **New Core Files (Initial Public API)**
*   **File:** `packages/client/src/lib/git/IGitAdapter.ts`
    *   **Symbol:** `IGitAdapter` (Interface)
    *   **Before:** None.
    *   **After:**
        ```typescript
        export interface IGitAdapter {
          exec(args: string[], options: { cwd: string }): Promise<{ stdout: string; stderr: string }>;
          readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]>;
          getGlobalState<T>(key: string): T | undefined;
          updateGlobalState(key: string, value: unknown): Promise<void>;
        }
        ```
*   **File:** `packages/client/src/lib/context/IProcessSpawner.ts`
    *   **Symbol:** `IManagedProcess` & `IProcessSpawner` (Interfaces)
    *   **Before:** None.
    *   **After:**
        ```typescript
        export interface IManagedProcess { /* ...streams and methods... */ }
        export interface IProcessSpawner { spawn(binaryPath: string, cwd: string): IManagedProcess; }
        ```

---
#### **Modified Files (Changes to Existing API)**

*   **File:** `packages/client/src/lib/git/GitWorktreeManager.ts`
    *   **Symbol:** `GitWorktreeManager` (Class Constructor)
    *   **Before:** `public constructor()`
    *   **After:** `public constructor(private readonly gitAdapter: IGitAdapter)`
    *   **Symbol:** `initialize` (Public Method)
    *   **Before:** `public async initialize(context: vscode.ExtensionContext): Promise<void>`
    *   **After:** `public async initialize(): Promise<void>`

*   **File:** `packages/client/src/lib/context/R_Mcp_ServerManager.ts`
    *   **Symbol:** `R_Mcp_ServerManager` (Class Constructor)
    *   **Before:** `private constructor(clientFactory: JsonRpcClientFactory)`
    *   **After:** `public constructor(private readonly spawner: IProcessSpawner, private readonly clientFactory: JsonRpcClientFactory)`

*   **File:** `packages/client/src/lib/context/ContextPartitionerService.ts`
    *   **Symbol:** `ContextPartitionerService` (Class Constructor)
    *   **Before:** `private constructor(serverManager: R_Mcp_ServerManager)`
    *   **After:** `public constructor(private readonly serverManager: R_Mcp_ServerManager)`

*   **File:** `packages/client/src/lib/workflow/Orchestrator.transitions.ts`
    *   **Symbol:** `Orchestrator` (Class Constructor)
    *   **Before:** (Implicit dependencies)
    *   **After:** `constructor(manifest: WorkflowManifest, contextService: ContextPartitionerService, apiManager: ApiPoolManager, onStateUpdate: (state: PlanningState) => void)`
    *   **Note:** The constructor signature itself is unchanged, but its role as a consumer of injected dependencies is now formally part of the architectural pattern.

    # **Implementation Plan (Finalized)**

### Phase 1: Establish the Abstraction Layer

#### Task 1.1: `packages/client/src/lib/git/IGitAdapter.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Domain Model Definition - this file defines a core architectural contract for I/O).
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/git/IGitAdapter.ts
     * @architectural-role Type Definition
     * @description Defines the abstract contract for all Git, file system, and state
     * persistence operations. It is the architectural boundary between the
     * GitWorktreeManager's pure orchestration logic and the underlying system I/O.
     * @core-principles
     * 1. IS the single, authoritative contract for Git and file system abstractions.
     * 2. ENFORCES the Dependency Inversion Principle for all consuming services.
     * 3. MUST NOT contain any concrete implementations or executable logic.
     */
    ```

#### Task 1.2: `packages/client/src/lib/context/IProcessSpawner.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Domain Model Definition - this file defines a core architectural contract for process management).
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/context/IProcessSpawner.ts
     * @architectural-role Type Definition
     * @description Defines the abstract contract for spawning and managing child processes.
     * It is the architectural boundary that decouples the R_Mcp_ServerManager from
     * the Node.js 'child_process' module.
     * @core-principles
     * 1. IS the single, authoritative contract for process spawning abstractions.
     * 2. ENFORCES the Dependency Inversion Principle for the R_Mcp_ServerManager.
     * 3. MUST define all necessary interfaces for a testable process lifecycle.
     */
    ```

---
### Phase 2: Implement Concrete I/O Adapters

#### Task 2.1: `packages/client/src/lib/git/RealGitAdapter.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: I/O & Concurrency Management - this is the sole implementation for all Git and file system I/O).
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/git/RealGitAdapter.ts
     * @architectural-role Utility
     * @description Provides the concrete, "real" implementation of the IGitAdapter
     * interface. This class encapsulates all direct interactions with the Git CLI,
     * the vscode.workspace.fs API, and vscode.ExtensionContext for state persistence.
     * @core-principles
     * 1. MUST strictly implement the IGitAdapter interface.
     * 2. IS the single, authoritative implementation for real Git and FS operations.
     * 3. OWNS all logic for executing external commands and interacting with VS Code APIs.
     */
    ```

#### Task 2.2: `packages/client/src/lib/context/RealProcessSpawner.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: I/O & Concurrency Management - this is the sole implementation for spawning child processes).
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/context/RealProcessSpawner.ts
     * @architectural-role Utility
     * @description Provides the concrete, "real" implementation of the IProcessSpawner
     * interface. This class encapsulates all direct interactions with the Node.js
     * 'child_process' module.
     * @core-principles
     * 1. MUST strictly implement the IProcessSpawner interface.
     * 2. IS the single, authoritative implementation for spawning real child processes.
     * 3. OWNS all platform-specific logic for resolving binary paths.
     */
    ```

---
### Phase 3: Refactor Core Services to Use Adapters

#### Task 3.1: `packages/client/src/lib/git/GitWorktreeManager.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: State Store Ownership, Core Business Logic Orchestration).
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/git/GitWorktreeManager.ts
     * @architectural-role Orchestrator
     * @description The authoritative service for orchestrating the lifecycle, state, and
     * conflict detection of all Git worktrees. It is a pure orchestrator that
     * depends on an injected IGitAdapter to perform all I/O.
     * @core-principles
     * 1. OWNS the stateful logic for the worktree reconciliation loop.
     * 2. DELEGATES all Git commands, file system reads, and state persistence to the adapter.
     * 3. MUST be fully testable in isolation with a mock adapter.
     */
    ```

#### Task 3.2: `packages/client/src/lib/git/GitWorktreeManager.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/git/GitWorktreeManager.spec.ts
     * @test-target packages/client/src/lib/git/GitWorktreeManager.ts
     * @description Verifies the orchestration logic of the GitWorktreeManager in
     * isolation by providing a mocked IGitAdapter. It tests the self-healing
     * reconciliation loop, state management, and command delegation.
     * @criticality The test target is CRITICAL.
     * @testing-layer Unit
     */
    ```

#### Task 3.3: `packages/client/src/lib/context/R_Mcp_ServerManager.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: State Store Ownership, Core Business Logic Orchestration).
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/context/R_Mcp_ServerManager.ts
     * @architectural-role Orchestrator
     * @description A stateful service that manages the lifecycle of R-MCP server
     * processes. It is a pure orchestrator that depends on an injected IProcessSpawner
     * to perform the actual process creation.
     * @core-principles
     * 1. OWNS the in-memory map of active R-MCP server processes.
     * 2. DELEGATES all process spawning and termination to the injected adapter.
     * 3. MUST be fully testable in isolation with a mock spawner.
     */
    ```

#### Task 3.4: `packages/client/src/lib/context/R_Mcp_ServerManager.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/context/R_Mcp_ServerManager.spec.ts
     * @test-target packages/client/src/lib/context/R_Mcp_ServerManager.ts
     * @description Verifies the process lifecycle orchestration logic of the
     * R_Mcp_ServerManager by providing a mocked IProcessSpawner. It tests the
     * spin-up, spin-down, and error-handling logic for server management.
     * @criticality The test target is CRITICAL.
     * @testing-layer Unit
     */
    ```

---
### Phase 4: Integrate and Refactor Downstream Consumers

#### Task 4.1: `packages/client/src/lib/context/ContextPartitionerService.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration, High Fan-Out).
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/context/ContextPartitionerService.ts
     * @architectural-role Utility
     * @description A stateless façade for all context queries. It routes requests from
     * the Orchestrator to the correct R-MCP server instance via the injected
     * R_Mcp_ServerManager dependency.
     * @core-principles
     * 1. IS a stateless façade for context queries.
     * 2. DELEGATES all process awareness to the R_Mcp_ServerManager.
     * 3. OWNS the logic for translating method calls into JSON-RPC messages.
     */
    ```

#### Task 4.2: `packages/client/src/lib/context/ContextPartitionerService.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/context/ContextPartitionerService.spec.ts
     * @test-target packages/client/src/lib/context/ContextPartitionerService.ts
     * @description Verifies the query routing logic of the ContextPartitionerService
     * by providing a mocked R_Mcp_ServerManager.
     * @criticality The test target is CRITICAL.
     * @testing-layer Unit
     */
    ```

#### Task 4.3: `packages/client/src/lib/workflow/Orchestrator.transitions.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration).
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.transitions.ts
     * @architectural-role Orchestrator
     * @description The deterministic, graph-based execution engine. This module contains
     * the core state machine logic and depends on injected services for all I/O.
     * @core-principles
     * 1. IS a deterministic state machine, not a speculative agent.
     * 2. OWNS the execution loop and runtime state (Payload, Return Stack).
     * 3. DELEGATES all AI calls and context slicing to injected services.
     */
    ```

#### Task 4.4: `packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts
     * @test-target packages/client/src/lib/workflow/Orchestrator.transitions.ts
     * @description Verifies the core state transition logic of the Orchestrator by
     * providing mocked service dependencies (ApiPoolManager, ContextPartitionerService).
     * @criticality The test target is CRITICAL.
     * @testing-layer Integration
     */
    ```

#### Task 4.5: `packages/client/src/events/handler.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration).
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/events/handler.ts
     * @architectural-role Orchestrator
     * @description A factory for creating an event handler. It routes commands from
     * the UI to the appropriate backend services, which are provided via a context object.
     * @core-principles
     * 1. IS the single entry point for all commands from the UI layer.
     * 2. DELEGATES all business logic to the appropriate service or store.
     * 3. ENFORCES testability by design through state encapsulation.
     */
    ```