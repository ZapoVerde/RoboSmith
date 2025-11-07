# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   The primary objective is to refactor the workflow engine's source code and test suite to eliminate structural ambiguity and redundancy. This change is necessary to align the codebase with its own architectural standards, making the system more maintainable, easier to reason about, and more robust.

### **1.1 Detailed Description**
*   This refactoring will address a core structural flaw where the main workflow engine's implementation was given a misleadingly specific name, causing confusion and leading to the creation of duplicated, overlapping test files. The fix involves renaming the primary source file for the workflow engine to accurately reflect its role as the central orchestrator. Subsequently, the fragmented and redundant test suites will be consolidated into a new, single, authoritative test suite for the engine, ensuring all its behaviors are tested in one clear location. A second, highly focused test suite will also be created to unit test a specific, pure helper function that was previously tested alongside the main engine.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
*   **Apparent Simplicity:** The refactor directly serves this principle by making the developer-facing architecture simpler, more intuitive, and safer to modify, reducing cognitive complexity.
*   **Determinism:** By consolidating tests and eliminating redundancy, we improve the auditability and predictability of the core engine, ensuring its behavior is more rigorously and clearly verified.
*   **No Unnecessary Context (Developer Experience):** The current structure provides confusing and redundant context to developers. The refactor will ensure each file and test has a single, clear purpose.

*   **Blueprint-Specific Principles:**
*   The primary, stateful workflow engine class MUST be housed in a file whose name clearly identifies it as the main orchestrator.
*   There MUST be a single, comprehensive test suite for the stateful orchestrator class that covers all of its integrated behaviors (state transitions, context management, error handling, etc.).
*   Any pure, stateless helper functions used by the orchestrator SHOULD have their own dedicated, focused unit test suite.
*   The names of all source files and their corresponding test files MUST follow a strict and predictable 1-to-1 mapping.

### **3. Architectural Flows**
*   **User Flow:**
*   This is a purely internal, developer-facing refactor. The end-user's journey and the system's external behavior will be completely unaffected.
*   **Data Flow:**
*   The data flows within the application remain unchanged. State and context objects will continue to be passed between the same logical components as before.
*   **Logic Flow:**
*   The core execution logic of the workflow engine will not be modified.
*   The logic of the tests will be migrated and consolidated. Tests that verify state transitions and tests that verify context assembly will be moved from their separate files into a single, unified test suite.
*   The logic for unit testing the pure context-assembly helper function will be isolated into its own new, dedicated test suite.

### **4. Overall Acceptance Criteria**
*   The source file containing the main `Orchestrator` class must be renamed to accurately reflect its central role.
*   A new, single, consolidated test suite for the `Orchestrator` class must be created.
*   All existing tests for state transitions (`JUMP`, `CALL`, `RETURN`, default fallback), context boundaries (`context_inheritance`), and payload assembly (`payload_merge_strategy`) must be successfully moved into the new consolidated test suite.
*   A new, separate, and focused unit test suite must be created for the pure context-assembly helper function.
*   The original, now-redundant test files must be deleted.
*   The entire project's test suite must pass, confirming that no regressions were introduced during the refactor.
*   The final file structure must be clear, logical, and free of the previously identified redundancies.