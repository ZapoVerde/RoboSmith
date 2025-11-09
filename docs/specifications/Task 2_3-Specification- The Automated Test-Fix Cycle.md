
---

# Specification: The Automated Test-Fix Cycle

## 1. High-Level Summary
This specification defines the architectural pattern for the **Automated Test-Fix Cycle**, the core mechanism that fulfills RoboSmith's promise of self-correcting code generation.

This cycle is the **second line of defense** against AI errors, designed to catch *logical* failures. It is preceded by the **"Validation-Fix Cycle"** (defined in `docs/architecture/AI_Output_Processing.md`), which catches *structural* errors before they are ever written to disk.

This is not a single, monolithic service but rather an orchestrated workflow pattern implemented through the interplay of several specialized, single-purpose Blocks within the `workflows.json` manifest. Its purpose is to create a closed loop where code (that is already structurally valid) is written to the file system and then validated by an automated test runner. If the tests fail, the system does not halt for human intervention. Instead, the Orchestrator, guided by the manifest, automatically jumps to a dedicated "Troubleshoot" Block, providing it with the precise error log needed to attempt a fix.

This cycle of **Generate -> (Validate) -> Write -> Test -> Fix** is the foundational pillar of the system's robustness and autonomy .

## 2. Core Data Contracts
The Test-Fix cycle operates by passing a specific, structured payload between its constituent Blocks. The key data contract is the output of the test execution, which must clearly communicate failure details.

```typescript
/**
 * @id .../workflow-types.ts#TestResultSegment
 * @description A specialized ContextSegment within the ExecutionPayload that contains the structured output from a test runner. This is the primary artifact used by the "Troubleshoot" Block.
 */
export interface TestResultSegment extends ContextSegment {
  /** The semantic type MUST be 'TEST_RESULT'. */
  type: 'TEST_RESULT';
  /** The content of the segment, containing the raw stdout/stderr from the test runner. */
  content: string;
  /** Metadata indicating the outcome of the test run. */
  outcome: 'PASS' | 'FAIL';
}
```

## 3. Component Specifications
This feature is realized through two primary components: a new internal Worker responsible for executing tests, and the manifest pattern that orchestrates the workflow.

### Component 1: The `Internal:TestRunner` Worker
*   This workflow pattern is driven by the Internal:TestRunner worker, whose detailed specification is defined in docs/Internal_Workers_and_Actions.md

---

### Component 2: The Manifest Orchestration Pattern (The Self-Correction Loop)
The Test-Fix cycle is not code; it is a pattern defined in `workflows.json`. The following structure is the canonical implementation of the loop.

*   **Architectural Role:** `Orchestration`
*   **Core Responsibilities:**
    *   To define the explicit, directed graph that constitutes the Test-Fix loop.
    *   To ensure that a `SIGNAL:FAILURE` from a test run correctly routes the execution flow to a troubleshooting Block.
    *   To ensure that the troubleshooting Block receives the necessary error context from the `ExecutionPayload`.
    *   To route the output of the troubleshooting Block back into the `WriteArtifacts` Block to complete the loop.

*   **Detailed Behavioral Logic (The Manifest Graph):**
    The loop is a sequence of `JUMP` actions connecting four distinct Blocks.
    1.  **`Feature_Implement__GenerateCode`:** The AI Worker generates the initial code. On success, its manifest transition is `JUMP:Core_IO__WriteArtifacts`.
    2.  **`Core_IO__WriteArtifacts`:** This Block writes the generated code to the file system. On success, its manifest transition is `JUMP:Core_Validate__RunTests`.
    3.  **`Core_Validate__RunTests`:** This Block invokes the `Internal:TestRunner` Worker. This is the critical decision point. Its manifest contains two transitions:
        *   `{ "on_signal": "SIGNAL:SUCCESS", "action": "JUMP:Feature_Implement__GenerateDocs" }` (Proceeds to the next logical phase of the project).
        *   `{ "on_signal": "SIGNAL:FAILURE", "action": "JUMP:Feature_Troubleshoot__FixCode" }` (Jumps to the fix-it Block).
    4.  **`Feature_Troubleshoot__FixCode`:** This AI Worker Block is specifically designed to fix code. Its `payload_merge_strategy` in the manifest **MUST** be configured to prioritize the `TestResultSegment` from the previous step, giving the AI the exact error log it needs to find a solution. On success, its manifest transition is `JUMP:Core_IO__WriteArtifacts`, thus restarting the loop with the attempted fix.

*   **Mandatory Testing Criteria:**
    *   An integration test of the Orchestrator must prove that when the `TestRunner` Worker is mocked to emit `SIGNAL:FAILURE`, the Orchestrator's next state is correctly set to the `Feature_Troubleshoot__FixCode` Block ID.
    *   The test must verify that the `ExecutionPayload` passed to the `Feature_Troubleshoot__FixCode` Block contains the error log from the mocked `TestRunner`.
    *   The test must verify that after the `Troubleshoot` block is mocked to return `SUCCESS`, the Orchestrator correctly jumps back to the `Core_IO__WriteArtifacts` Block.