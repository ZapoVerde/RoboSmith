Acknowledged. I will now execute **Phase 4: Finalization**.

---

# **Blueprint (Finalized)**

### **1. File Manifest (Complete Scope)**
*   `packages/client/src/lib/workflow/Orchestrator.ts` (New, from rename)
*   `packages/client/src/lib/workflow/Orchestrator.spec.ts` (New test file)
*   `packages/client/src/lib/workflow/Orchestrator.context.spec.ts` (New test file)
*   `packages/client/src/events/handler.ts` (Modified)
*   `packages/client/src/events/handler.spec.ts` (Modified)
*   `packages/client/src/lib/workflow/Orchestrator.transitions.ts` (Deleted)
*   `packages/client/src/lib/workflow/Orchestrator.context.spec.ts` (Deleted)
*   `packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts` (Deleted)

### **2. Logical Change Summary (Complete)**

#### **Core Changes:**
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.ts`**: This file will be renamed to `Orchestrator.ts` to accurately reflect that it contains the primary, stateful `Orchestrator` class for the entire workflow engine.
*   **`packages/client/src/lib/workflow/Orchestrator.context.spec.ts`**: This file will be deleted. Its high-value tests will be migrated to the new, consolidated `Orchestrator.spec.ts` suite.
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts`**: This file will be deleted and replaced by the new, consolidated `Orchestrator.spec.ts` suite.

#### **Collateral (Fixing) Changes:**
*   **`packages/client/src/events/handler.ts`**: The import statement for the `Orchestrator` class will be updated to point to the newly renamed `Orchestrator.ts` file.
*   **`packages/client/src/events/handler.spec.ts`**: The import statement for the `Orchestrator` class will be updated to point to the newly renamed `Orchestrator.ts` file to ensure the test's mock target is correct.

### **3. API Delta Ledger (Complete)**
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.ts`**: None.
*   **`packages/client/src/events/handler.ts`**: None.
*   **`packages/client/src/events/handler.spec.ts`**: None.

---

# **Blueprint (Test Assessment)**

*   **`packages/client/src/lib/workflow/Orchestrator.transitions.ts`**: Requires new test file (Reason: This is the core engine class. Its new, consolidated test suite will verify all integrated behaviors as per the refactoring plan).
*   **`packages/client/src/lib/workflow/Orchestrator.context.spec.ts`**: No test file required (Reason: This test file is being deleted).
*   **`packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts`**: No test file required (Reason: This test file is being deleted).
*   **`packages/client/src/events/handler.ts`**: Covered by existing tests (Reason: The change is limited to updating an import path, which does not alter the file's logic or public contract. The existing test file will be updated to match).
*   **`packages/client/src/lib/workflow/Orchestrator.context.ts`**: Requires new test file (Reason: While the source is unchanged, the architectural plan mandates creating a new, dedicated unit test suite for the pure `assembleContext` function to ensure focused coverage and complete the separation of concerns).

# **Implementation Plan (Finalized)**

### Phase 1: Restructure Core Orchestrator Source Files

#### Task 1.1: `packages/client/src/lib/workflow/Orchestrator.transitions.ts` (Deletion via Rename)
*   This file will be renamed to `Orchestrator.ts`. This action effectively deletes the file at this path.

#### Task 1.2: `packages/client/src/lib/workflow/Orchestrator.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration, State Store Ownership).
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.ts
     * @stamp S-20251107T130000Z-C-REFACTOR-FINALIZE
     * @architectural-role Orchestrator
     * @description The deterministic, stateful, graph-based execution engine for all workflows. It is the central class that manages the execution loop, runtime state, and delegation to I/O services.
     * @core-principles
     * 1. IS a deterministic state machine, not a speculative agent.
     * 2. OWNS the execution loop and runtime state (Execution Payload, Return Stack, Current Block).
     * 3. DELEGATES all AI calls, context slicing, and action parsing to injected services and helpers.
     *
     * @api-declaration
     *   - export class WorkflowHaltedError extends Error
     *   - export class Orchestrator
     *   -   public constructor(manifest, contextService, apiManager, onStateUpdate)
     *   -   public async executeNode(startNodeId: string, worktreePath: string): Promise<void>
     *
     * @contract
     *   assertions:
     *     - purity: "mutates"       # Owns and mutates its internal runtime state.
     *     - external_io: "https_apis" # Delegates to ApiPoolManager which performs external I/O.
     *     - state_ownership: "['currentBlockId', 'executionPayload', 'returnStack']"
     */
    ```

#### Task 1.3: `packages/client/src/events/handler.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration).
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/events/handler.ts
     * @stamp S-20251107T130100Z-C-REFACTOR-FINALIZE
     * @architectural-role Orchestrator
     * @description A factory for creating an event handler. It routes commands from the UI to the appropriate backend services, which are provided via a context object. This version is updated to import from the correctly named Orchestrator module.
     * @core-principles
     * 1. IS the single entry point for all commands from the UI layer.
     * 2. MUST delegate all business logic to the appropriate service or store.
     * 3. MUST NOT contain any business logic itself.
     */
    ```

---
### Phase 2: Consolidate and Refactor Orchestrator Test Suites

#### Task 2.1: `packages/client/src/lib/workflow/Orchestrator.context.spec.ts` (Deletion)
*   This test file will be deleted. Its tests are being migrated.

#### Task 2.2: `packages/client/src/lib/workflow/Orchestrator.transitions.spec.ts` (Deletion)
*   This test file will be deleted. Its tests are being migrated.

#### Task 2.3: `packages/client/src/lib/workflow/Orchestrator.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.spec.ts
     * @stamp S-20251107T130200Z-C-REFACTOR-FINALIZE
     * @test-target packages/client/src/lib/workflow/Orchestrator.ts
     * @description A comprehensive, consolidated integration test suite for the main Orchestrator class. It verifies all integrated behaviors, including state transitions (JUMP, CALL, RETURN), context boundary enforcement, payload merging, default fallbacks, and error handling.
     * @criticality The test target is CRITICAL, as it is the central execution engine of the application. 
     * @testing-layer Integration
     */
    ```

#### Task 2.4: `packages/client/src/lib/workflow/Orchestrator.context.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/workflow/Orchestrator.context.spec.ts
     * @stamp S-20251107T130300Z-C-REFACTOR-FINALIZE
     * @test-target packages/client/src/lib/workflow/Orchestrator.context.ts
     * @description A focused unit test suite for the pure `assembleContext` helper function. It verifies the five-layer memory model assembly, context inheritance rules, and payload merge strategy execution in complete isolation.
     * @criticality The test target is not independently critical, but it provides a core capability to a CRITICAL component.
     * @testing-layer Unit
     */
    ```

#### Task 2.5: `packages/client/src/events/handler.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/events/handler.spec.ts
     * @stamp S-20251107T130400Z-C-REFACTOR-FINALIZE
     * @test-target packages/client/src/events/handler.ts
     * @description Verifies that the event handler correctly routes commands and properly instantiates its dependencies, including the newly renamed Orchestrator class.
     * @criticality The test target is CRITICAL as it is a core orchestrator.
     * @testing-layer Unit
     */
    ```