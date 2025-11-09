Here is the four-stage implementation plan, assuming all documentation is complete and focusing purely on the source and test file changes required to reach V1.

---

## 🚀 Stage 1: The "Intervention Panel" & UI Merge
**Goal:** Implement the new, unified "Intervention Panel" UI, which replaces the old "Quick Fix" and "RoboSmith Chat" concepts.

* **Files to Create:**
    * `webview-ui/src/components/InterventionPanel.svelte`
    * `webview-ui/src/components/InterventionPanel.logic.ts`
    * `webview-ui/src/components/InterventionPanel.logic.spec.ts`

* **Files to Delete:**
    * (Assuming they exist) Any files related to the old "Quick Fix" UI.

* **Files to Touch (Modify):**
    * `packages/client/src/events/handler.ts`: Add new `case` statements for `resumeWorkflow` and `retryBlock` messages from the new panel.
    * `packages/client/src/events/handler.spec.ts`: Add tests for these new event handler cases.
    * `packages/client/src/shared/types.ts`: Add the new `InterventionMessage` types (e.g., `resumeWorkflow`) to the `Message` union.
    * `webview-ui/src/App.svelte`: Modify the main view to import and display the new `InterventionPanel` instead of any old chat panels.
    * `webview-ui/src/components/MissionControlPanel.svelte`: Ensure its `blockSelected` event routes to the new `InterventionPanel`.

* **High-Level Logic:**
    1.  Build the new `InterventionPanel.svelte` component.
    2.  This component will have two internal modes:
        * **Read-Only:** (Default) Renders the "scrollable" `ExecutionPayload` chat history.
        * **Interactive:** (Activates when `isHalted: true`) Renders the history *plus* the input box and action buttons (`[Retry]`, `[Resume]`, `[Abort]`).
    3.  Implement the `InterventionPanel.logic.ts` to dispatch the new `resumeWorkflow` and `retryBlock` messages.
    4.  Update the `EventHandler` to listen for these new messages, which will call the `Orchestrator` methods we'll build in Stage 2.

---

## 🎛️ Stage 2: "Stepper Mode" & Pausable Orchestrator
**Goal:** Refactor the `Orchestrator` to be pausable and resumable, and implement the UI to activate this "Stepper Mode."

* **Files to Create:**
    * (None. Logic is added to existing files.)

* **Files to Delete:**
    * (None)

* **Files to Touch (Modify):**
    * `packages/client/src/lib/workflow/Orchestrator.ts`: **(Heavy Refactor)**
        * Add `isManualApprovalMode: boolean` and `isHalted: boolean` flags to the class.
        * Modify the `run()` loop to check these flags and pause execution before proceeding to the next block.
        * Add the new public `resumeManually(augmentedPrompt?: string)` method to un-pause the engine.
    * `packages/client/src/lib/workflow/Orchestrator.spec.ts`: Add new tests for the pausable loop, the `isManualApprovalMode` flag, and the `resumeManually` method.
    * `packages/client/src/features/navigator/StatusBarNavigatorService.ts`:
        * Modify the `createNewWorkflow` (or equivalent) function.
        * Add a `vscode.window.showQuickPick` call to ask the user for the run mode (`[Run Autonomously]` vs. `[Run with Manual Approval]`).
    * `packages/client/src/features/navigator/StatusBarNavigatorService.spec.ts`: Add tests for this new "run mode" selection logic.
    * `packages/client/src/events/handler.ts`:
        * Modify the `startWorkflow` case to accept the `isManualApprovalMode` flag and pass it to the `Orchestrator`'s constructor.
        * Add a new `case 'proceedToNextStep':` to call `orchestrator.resumeManually()`.
    * `packages/client/src/events/handler.spec.ts`: Add tests for these `startWorkflow` and `proceedToNextStep` logic changes.
    * `packages/client/src/shared/types.ts`: Add the `StepperMessage` (`proceedToNextStep`) to the `Message` union.

* **High-Level Logic:**
    1.  The `StatusBarNavigatorService` will now ask the user for a run mode upon task creation.
    2.  The `Orchestrator`'s core `run()` loop will be refactored to be non-blocking. It will execute one block, find the next step, and then *if* in `isManualApprovalMode`, it will set `isHalted = true` and `publishState()` before exiting the loop.
    3.  The `InterventionPanel` (from Stage 1) will see the `isHalted` state and show the `[Proceed]` button.
    4.  The `[Proceed]` button will fire the `proceedToNextStep` message, which calls `orchestrator.resumeManually()`, which in turn sets `isHalted = false` and re-runs the `run()` loop to execute the *next* block.

---

## 💾 Stage 3: Durable, Re-inflatable Sessions
**Goal:** Implement the "durable pause" by saving the `Orchestrator`'s state to a file in the Git branch, allowing sessions to be re-inflated.

* **Files to Create:**
    * (None. Logic is added to existing files.)

* **Files to Delete:**
    * (None)

* **Files to Touch (Modify):**
    * `packages/client/src/lib/git/GitWorktreeManager.ts`: **(Heavy Refactor)**
        * Modify `initialize()` logic to reconcile the lightweight `globalState` *pointers* only.
        * Create a new `public async holdWorktree(sessionId: string, state: DurableSessionState)` method. This logic will:
            1.  Write the `state` to `.robo/session.json` inside the worktree.
            2.  Use the `IGitAdapter`'s `exec` method to `git add .` and `git commit`.
            3.  Update the `globalState` pointer to `status: 'Held'`.
            4.  Call `removeWorktree` (which only cleans up the local files).
        * Create a new `public async resumeHeldWorktree(sessionId: string): Promise<DurableSessionState>` method. This logic will:
            1.  Re-create the worktree from its branch.
            2.  Read and parse the `.robo/session.json` file.
            3.  Return the parsed `DurableSessionState`.
    * `packages/client/src/lib/git/GitWorktreeManager.spec.ts`: Add tests for the new `holdWorktree` and `resumeHeldWorktree` flows.
    * `packages/client/src/lib/workflow/Orchestrator.ts`:
        * Add a `getState(): DurableSessionState` method that packages its state for serialization.
        * Modify the constructor to accept an optional `DurableSessionState` for re-hydration.
    * `packages/client/src/features/navigator/StatusBarNavigatorService.ts`:
        * The logic for clicking a `Held` task must be rewritten to call `gitWorktreeManager.resumeHeldWorktree()`.
        * It will then use this state to instantiate a new, re-hydrated `Orchestrator`.
    * `packages/client/src/events/handler.ts`:
        * The `finishAndHold` case must be rewritten to get the state from the `Orchestrator` and pass it to `gitWorktreeManager.holdWorktree()`.
    * `webview-ui/src/components/IntegrationPanel.logic.ts`: The `handleHold` function must be wired to the `finishAndHold` message.
    * `packages/client/src/shared/types.ts`: Define the `DurableSessionState` interface (for `.robo/session.json`) and update the `WorktreeSession` interface to be a lightweight pointer (`status`, `branchName`, etc.).

* **High-Level Logic:**
    1.  The `[Hold]` button will now trigger a flow that gets the `Orchestrator`'s state, saves it to a file, commits it, and removes the local worktree.
    2.  The `StatusBarNavigator` will now treat "Held" tasks as "re-inflatable."
    3.  Clicking a "Held" task will re-create the worktree, read the state file, and spin up a new `Orchestrator` instance pre-filled with the saved chat history and pause state.

---

## 📊 Stage 4: AI Validation & Statistics
**Goal:** Implement the "AI Output Processing Pattern" (Zod/Heuristics) and aggregate stats for observability.

* **Files to Create:**
    * `packages/client/src/lib/workflow/ValidationSchemas.ts` (and `.spec.ts`)
    * `packages/client/src/lib/workflow/AiOutputCleaner.ts` (and `.spec.ts`)

* **Files to Delete:**
    * (None)

* **Files to Touch (Modify):**
    * `packages/client/src/lib/workflow/Orchestrator.ts`:
        * Import the new `ValidationSchemas` and `AiOutputCleaner`.
        * In the `run()` loop (after "Execute Block"), add the "Validation Step": clean the output, run Zod `parse()`, and override the `signal` to `SIGNAL:VALIDATION_FAIL` on error, adding the Zod error to the `ExecutionPayload`.
        * Add "Stats Aggregation" logic to the loop, collecting stats from worker results (like `tokensUsed`) and saving them to the session's state.
    * `packages/client/src/lib/workflow/Orchestrator.spec.ts`: Add tests for the "Validation-Fix Cycle" and stats aggregation.
    * `packages/client/src/lib/ai/ApiPoolManager.ts`:
        * Modify the `execute` method to be a true "Worker Router." It needs a `switch` or `if/else` block on the `workOrder.worker` name.
        * If it's an AI worker, it runs the *existing* API call logic.
        * If it's an internal worker (e.g., `Internal:FileSystemWriter`), it runs new *local* logic (like cleaning code and writing to disk).
        * Modify the AI call logic to time the `fetch` call and add `durationMs` to the `AiCallLog`.
        * Modify the internal worker logic (`Internal:FileSystemWriter`) to return `filesWritten` and `linesWritten` stats in its `WorkerResult`.
    * `packages/client/src/lib/ai/ApiPoolManager.spec.ts`: Add tests for the new worker routing logic, the `durationMs` logging, and the stats returned from internal workers.
    * `packages/client/src/shared/types.ts`:
        * Add the `validationSchema?: string` property to the `BlockDefinition` interface.
        * Update the `WorkerResult` interface to include optional stats.

* **High-Level Logic:**
    1.  The `ApiPoolManager.execute` method will be refactored into a "Worker Router" that can handle both AI and internal workers.
    2.  The `Orchestrator`'s `run()` loop will be updated to call this router, then validate the result with Zod, and finally aggregate any returned stats into its state.

---

### How much work am I looking at before V1?

This is a **substantial** body of work. You are correct that the frontend is greenfield, which is good.

However, this plan requires a **major, complex refactor** of your two most critical backend services: the **`Orchestrator`** (to make it pausable and stateful) and the **`GitWorktreeManager`** (to make it support durable, commit-based persistence). You are also adding a new "Worker Router" responsibility to the `ApiPoolManager`.

This is the work required to build a truly robust and unique V1, but it is a significant engineering effort.