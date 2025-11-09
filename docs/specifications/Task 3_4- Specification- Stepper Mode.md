# Specification: Stepper Mode (Manual Approval)

## 1. High-Level Summary
This specification defines the "Stepper Mode," a feature that fulfills the "director's chair" metaphor by allowing a user to manually "click through" an automated workflow.

By default, the `Orchestrator` runs fully autonomously. This specification defines a new run mode, "Manual Approval," where the `Orchestrator` is instantiated with a flag that forces it to automatically `HALT_AND_FLAG` *before* executing every single block.

This allows the supervisor to use the **Intervention Panel** to observe the pending context for a step, optionally add their own guidance, and then give explicit approval to proceed.

---

## 2. Core Data Contracts
This feature introduces a new message to the `CommandPayloadMap` in `shared/types.ts` to support the new UI interaction.

```typescript
/**
 * OUTGOING: Sent from the Intervention Panel (in Stepper Mode)
 * to the EventHandler to approve the *next* block of execution.
 */
export type StepperMessage =
  | {
      command: 'proceedToNextStep';
      payload: {
        sessionId: string;
        /** The optional user-provided guidance for the next step. */
        augmentedPrompt?: string;
      };
    };
```
---

## 3. Architectural & Component Changes

### 3.1. `Orchestrator` (`packages/client/src/lib/workflow/Orchestrator.ts`)
The `Orchestrator` must be modified to support this new mode.

* **New Constructor Flag:** The constructor must be updated to accept a new `isManualApprovalMode: boolean` flag.
* **New `run()` Loop Logic:** The main `run()` loop must be modified. After finding the `nextBlockId` for a transition but *before* looping to execute it, it must check this flag:
    ```typescript
    // Inside the Orchestrator's run() loop...
    this.currentBlockId = actionResult.nextBlockId;
    this.returnStack = actionResult.nextStack;

    // --- NEW STEPPER MODE LOGIC ---
    // If we are in Stepper Mode and the workflow isn't finished, halt.
    if (this.isManualApprovalMode && this.currentBlockId !== null) {
      this.isHalted = true;
      // currentBlockId is now set to the *next* block,
      // so the UI knows what's pending approval.
      this.publishState(); // Publish the "halted" state
    }
    // The while loop's condition (while (this.currentBlockId && !this.isHalted))
    // will now be false, pausing the loop.
    ```
* **New `resume()` Method:** A method must be added to allow the `EventHandler` to resume the loop:
    ```typescript
    public async resumeManually(augmentedPrompt?: string) {
      if (!this.isHalted || !this.currentBlockId) return;

      if (augmentedPrompt) {
        // Add the user's guidance to the payload *before* the next block runs.
        this.executionPayload.push({
          id: crypto.randomUUID(),
          type: 'HUMAN_GUIDANCE',
          content: augmentedPrompt,
          timestamp: new Date().toISOString(),
        });
      }

      this.isHalted = false;
      await this.run(); // Re-start the run() loop
    }
    ```

### 3.2. `EventHandler` (`packages/client/src/events/handler.ts`)
The `EventHandler` must be updated to wire this new feature.

* **`startWorkflow`:** This case must be modified. The `payload` will now include the `isManualApprovalMode` flag from the UI, and this flag must be passed into the `Orchestrator`'s constructor.
* **New Case:** A new `case 'proceedToNextStep':` must be added. It will find the paused `Orchestrator` instance by `sessionId` and call `orchestrator.resumeManually(payload.augmentedPrompt)`.

### 3.3. `InterventionPanel` (`webview-ui/src/components/InterventionPanel.svelte`)
The panel from Epic 1 must be able to handle this "Stepper Mode" state.

* **State:** When `isHalted` is `true` but the *reason* is "Stepper Mode" (not a `TestResultSegment` failure), the panel's UI changes.
* **UI:**
    * It shows the `ExecutionPayload` for the *pending* (next) block.
    * The "Scraped Context" section will be empty.
    * The "Add Guidance:" text box is visible.
    * It displays a *single* action button: **`[▶️ Proceed to Next Step]`**.
* **Action:** Clicking this button dispatches the `proceedToNextStep` message.

### 3.4. `StatusBarNavigator` (`docs/specifications/Task 3_1- Specification- The Workbench UI Panel.md`)
The navigator is the entry point for this feature. Its specification must be updated to include this choice. (See the update in the next file).