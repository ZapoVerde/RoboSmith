This is the perfect next step. You've finalized the architecture; now we need a precise and actionable plan to update the existing file system to reflect the new reality.

Since you had already implemented the original `Task 1_3`, we are now performing a **targeted refactoring**. The good news is that the "blast radius" is confined almost entirely to the workflow engine itself.

Here is the definitive file-by-file action plan to bring "The Block/Node Workflow Engine" into alignment.

---

### **File Action Plan: Refactoring the Workflow Engine**

#### **Phase 1: Update the Core Data Contracts (The Foundation)**

These are the most critical changes, as they define the new language of the system.

| File Path | Action | Rationale |
| :--- | :--- | :--- |
| **`packages/client/src/shared/types.ts`** | **REPLACE/REFACTOR** | This is the source of truth for all data contracts. You must: <br> 1. **DELETE** any old "Step" or "Node" interfaces. <br> 2. **CREATE** the new, definitive interfaces: `ContextSegment`, `ExecutionPayload`, `Transition`, `BlockDefinition`, and `NodeDefinition`. |
| **`packages/shared/src/domain/*`** | **NO CHANGE** | **Verification.** Your core domain models (like `ApiKey`) are completely decoupled from the workflow engine and should not be affected. |

#### **Phase 2: Refactor the Orchestrator Service (The Epicenter)**

This is where the bulk of the coding work will be. We will create a new, clean directory for the new engine to ensure a perfect separation.

| File Path | Action | Rationale |
| :--- | :--- | :--- |
| `packages/client/src/lib/workflow/` | **CREATE DIRECTORY** | A new home for the refactored engine. |
| **`packages/client/src/lib/workflow/Orchestrator.ts`** | **REPLACE/REWRITE** | This is the core engine. The old logic is discarded. The new file will contain the main `Orchestrator` class with its execution loop (`Assemble Context -> Execute Block -> ...`) and the private `returnStack`. |
| **`packages/client/src/lib/workflow/ActionHandler.ts`** | **CREATE NEW FILE** | A small, dedicated module that contains the `switch/case` logic for handling the atomic actions (`JUMP`, `CALL`, `RETURN`). This keeps the `Orchestrator` class cleaner. |
| **`packages/client/src/lib/workflow/types.ts`** | **DELETE or ARCHIVE** | The old types are now obsolete. All new types are defined in the shared `types.ts` file for global consistency. |
| `packages/client/src/lib/workflow/Orchestrator.spec.ts` | **REPLACE/REWRITE** | The old tests are invalid. A new suite of tests must be written to verify the new `Orchestrator`'s contract, including tests for the `ReturnStack`, the `Binary/Default Fallback`, and the `Context Boundary` logic. |

#### **Phase 3: Update the Integration Points (The Connective Tissue)**

These are the files that *use* the Orchestrator and need to be updated to speak its new language.

| File Path | Action | Rationale |
| :--- | :--- | :--- |
| **`packages/client/src/events/handler.ts`** | **REFACTOR** | The `startWorkflow` case in the `handleEvent` function needs to be updated. It will now instantiate the *new* `Orchestrator` and call its `execute(startNodeId)` method. The error handling logic (`try/catch`) remains valid. |
| **`packages/client/src/events/handler.spec.ts`** | **REFACTOR** | The tests for the `startWorkflow` command must be updated to mock the *new* `Orchestrator` class and its `execute` method. |
| **`docs/Construction/Task 1_3...md`** | **REPLACE** | You've already identified this. Replace its content with the new specification we just wrote. |
| **`docs/Construction/Task 2_3...md`** | **REPLACE** | You've already identified this. Replace its content with the new specification for the Test-Fix Cycle. |

**Summary of File Changes:**

*   **Create:** `ActionHandler.ts`
*   **Rewrite/Replace:** `Orchestrator.ts`, `Orchestrator.spec.ts`
*   **Refactor:** `handler.ts`, `handler.spec.ts`, `types.ts`
*   **Update Docs:** `Task 1_3...md`, `Task 2_3...md`

This is a manageable and highly focused set of changes that will bring the entire project into perfect alignment with the final, robust architecture. 