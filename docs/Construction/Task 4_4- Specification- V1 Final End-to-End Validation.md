
---

# Specification: V1 Final End-to-End Validation

## 1. High-Level Summary
This specification defines the process and criteria for the final end-to-end (E2E) validation of the RoboSmith V1 release. This is not a component specification but a **test plan specification**. Its purpose is to define a concrete, demonstrable scenario that forces all the major V1 components—from the `ApiPoolManager` and `Orchestrator` to the `GitWorktreeManager` and the UI panels—to work together in concert.

Successfully completing this test plan is the final gate before the V1 release. It serves as the ultimate proof that the system not only works in isolated parts but functions as a cohesive, reliable, and economically viable tool, fulfilling all the success criteria laid out in Chapter 5 of the main `RoboSmith_spec.md`.

## 2. The E2E Test Scenario: "The Conflicting Feature Race"

This scenario is designed to stress-test the most critical and complex interactions in the system: multi-session parallelism and automated conflict resolution.

**Setup:**

1.  A simple, runnable sample project will be used as the test bed (e.g., a basic React app with a few components).
2.  The `.vision/workflows.json` manifest will be configured with a simple `Implement` node that creates a new file and adds content to it.
3.  The `ApiPoolManager` will be configured with at least two API keys, where the first key is designed to fail (e.g., has an invalid secret) to test the failover logic.

**Execution Steps:**

1.  **[Launch RoboSmith]:** The user opens the sample project in VS Code, and the RoboSmith extension activates.

2.  **[Task 1 - Create Feature A]:**
    a.  The user opens the RoboSmith Workbench.
    b.  They click "New Chain" to create **Tab A**.
    c.  They provide a simple work plan that requires creating a new file: `src/components/FeatureA.tsx`.
    d.  They click `[ 🚀 Implement ]`. This submits a task to the `WorktreeQueueManager` with a `changePlan` of `['src/components/FeatureA.tsx']`.

3.  **[Task 2 - Create Feature B (Conflicting)]:**
    a.  **Immediately after starting Task 1**, the user clicks "New Chain" again to create **Tab B**.
    b.  They provide a work plan that requires modifying the **same file** as another, unrelated new file: `src/components/FeatureA.tsx` and `src/components/FeatureB.tsx`.
    c.  They click `[ 🚀 Implement ]`. This submits a second task with a `changePlan` of `['src/components/FeatureA.tsx', 'src/components/FeatureB.tsx']`.

4.  **[Observe Conflict & Queuing]:** The user observes the Workbench UI.
    *   **Tab A** should show its status as `▶️ Running`.
    *   **Tab B**'s Overlap label must immediately show **"Clash"**, and its Queue icon must show **"⏳ Queued"**. A tooltip should indicate it is waiting for Tab A.

5.  **[Observe API Failover]:** The user monitors the extension's output log. The log must show that the first AI call (for Tab A) initially failed with the first API key and was then successfully retried with the second key.

6.  **[Complete Task 1]:** The workflow for Tab A completes. The **Integration Panel** appears.
    a.  The user clicks `[ 🚀 Open Terminal in Worktree ]`. A new terminal must open, scoped to the `worktree` for Tab A.
    b.  The user manually runs a command (e.g., `ls`) to verify they are in the correct, isolated directory.
    c.  The user clicks `[ ✅ Commit, Merge & Push ]` (or a simplified "Mark as Done" for the test).

7.  **[Observe Auto-Advancement]:** The moment Task 1 is marked as complete, the user observes the Workbench UI again.
    *   **Tab B**'s status must automatically transition from `⏳ Queued` to `▶️ Running` as the queue is processed.

8.  **[Complete Task 2]:** The workflow for Tab B completes, and its own Integration Panel is shown.

## 3. Mandatory Validation Criteria (Mapping to V1 Success Criteria)

To pass, the E2E test must meet the following criteria, which directly correspond to the formal V1 "Definition of Done":

*   **[Criterion 5.1 & 5.2 - Autonomous Execution]:** The `Implement` node for both Task A and Task B must run autonomously from start to finish without requiring any user intervention (other than the initial `[Implement]` click). The "Planning Session" view for each tab must show the steps transitioning from `in_progress` to `complete`.

*   **[Criterion 5.3 - Validate a Feature]:** The `[ 🚀 Open Terminal in Worktree ]` button for Tab A **must** successfully open a terminal whose current working directory is correctly set to the isolated Git worktree created for that specific task.

*   **[Criterion 5.4 - Economic Viability]:** The extension's output log must provide clear, verifiable evidence that the `ApiPoolManager` automatically failed over from the invalid first key to the valid second key during the execution of Task A.

*   **[Criterion 6.2 (Mitigation) - Queuing & UI Signaling]:** The UI for Tab B **must** provide the correct, decoupled signals in real-time: an Overlap label of **"Clash"** and a Queue icon of **"⏳ Queued"** while Tab A is running, and these must automatically update to `▶️ Running` after Tab A is completed. This demonstrates that the entire conflict detection and FIFO queuing system is working as specified.