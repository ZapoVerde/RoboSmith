# High-Level UX Vision: The Principle of Apparent Simplicity

## 1. Core Philosophy: The Director's Chair

The user of RoboSmith is not a coder in the trenches; they are a manager, a director, and a supervisor. The entire user experience is crafted to empower this role. The system's immense underlying complexity—AI orchestration, dynamic Git worktree management, programmatic workspace manipulation, real-time context assembly—is a burden that the system itself must bear. It must never be exposed to the user.

Our single, immutable guiding principle is the **"Principle of Apparent Simplicity":**
> No matter how powerful or complex the feature, it must always seem simple, intuitive, and safe to the user.

To enforce this, we adhere to a strict architectural pattern: the **"Clear Separation of Worlds."** The user is always in one of two states: the familiar, pure VS Code environment of their main project, or the self-contained, focused "cockpit" of a RoboSmith workflow. There is no ambiguous middle ground. This separation is the foundation of the tool's clarity and safety.

---

## 2. The Anatomy of the Interface: A Three-Part System

The user experience is delivered through three distinct but deeply interconnected UI components. Each has a single, clear purpose, designed to work in concert to provide a seamless flow from high-level supervision to deep-dive inspection.

| UI Area | Component | Purpose & Metaphor |
| :--- | :--- | :--- |
| **Bottom Status Bar**| **The Status Bar Navigator** | The **"Doorway."** A single, dedicated, and unambiguous control for switching between the VS Code and RoboSmith worlds. It is the only mechanism for navigating between workflows. |
| **Main Editor Area**| **The Mission Control Panel** | The **"Cockpit."** A rich, interactive, and live-updating visualization of a *single* active workflow. It is where you supervise the automation as a "living Visio diagram." |
| **Bottom Panel Area**| **The Inspector Panels** | The **"Gauges."** A set of on-demand, context-aware panels that provide deep, transparent details about any selected step in the Mission Control Panel. |

---

## 3. The User Journey: A Full, Narrative Flow

This is the complete user journey, from starting a new task to finalizing the work, demonstrating how the principles and components come together.

### 3.1. The "Lobby": The Clean Starting State
The journey begins in a place of familiarity and calm. The user opens their project, and the VS Code environment is exactly as they expect. The File Explorer shows their single project root. The Source Control panel is synced to their main branch.

The only hint of RoboSmith's power is the clean, unobtrusive item in the bottom-left status bar: `🤖 RoboSmith: My Project (main)`. This is the user's home base, the "Lobby."

### 3.2. The "Doorway": A Deliberate Context Switch
The user decides to start a new automated task. They click the `🤖 RoboSmith` Status Bar item. A fast, native Quick Pick dropdown appears at the top of the screen—this is the **Navigator**. It lists the main project, any existing workflows, and the all-important `[+] Create New Workflow...` command.

The user selects "Create New Workflow." They give it a name: "Implement Login Form."

This single, deliberate action is the trigger. In a seamless, sub-second transition, the system does three things:
1.  **Orchestrates the Backend:** It creates a new, isolated Git worktree and branch.
2.  **Transforms the Workspace:** It programmatically redraws the entire VS Code UI. The File Explorer now shows *only* the new worktree's folder. The Source Control panel now tracks the new branch. The world has been safely and completely refocused.
3.  **Opens the Cockpit:** The **Mission Control Panel** appears in the main editor area, ready to display the workflow.

The user has been teleported from the "Lobby" into the "Cockpit" of a single task. There was no confusion, no manual setup, just a single click.

### 3.3. The "Cockpit": Supervising the Living Visio Diagram
The Mission Control Panel is the heart of the experience. It is not a static list; it is a live-rendering of the `Orchestrator` engine's brain.

*   **The View:** The user sees a flowchart of the workflow's blocks, connected by arrows. Each arrow is explicitly labeled with the `Signal` keyword that triggers it (e.g., `SIGNAL:SUCCESS`).
*   **The Flow:** The user watches as the execution moves through the diagram. The active block pulsates with a blue "in-progress" border. As it completes, it turns green `[✅]`, and the arrow for the signal it emitted briefly glows, creating a "lit path" that shows the user not just *what* is happening next, but *why*.
*   **The Diversion:** A test fails. The user sees the `Run Tests` block turn red `[❌]`. The `SIGNAL:FAILURE` arrow glows, and the "lit path" visibly diverts to the `Troubleshoot Code` block, which begins to pulsate. The system is attempting to self-correct, and the user has a perfect, real-time view of this "troubleshooting loop."

### 3.4. The "Glass Box": On-Demand, Surgical Transparency
The user is curious about the failure[cite: 1556]. They click the red `Run Tests` block in the diagram[cite: 1557]. This single action populates the unified **"Intervention Panel"** in the bottom panel area[cite: 1558].

* The "black box" of automation is gone. The user has a complete, interactive "glass box" to understand any step of the process[cite: 1562].
* This single panel displays the full context for the selected block: the "little icons" representing the input context *and* the scrollable chat history (`ExecutionPayload`) showing the step's inputs and outputs [cite: 1559-1561].
* If the block is *halted*, this same panel also displays the interactive controls, merging observability and intervention into one view.

### 3.5. The Final Decision: The Integration Panel
The workflow completes. The Mission Control Panel is replaced by the clean, focused **Integration Panel**. The automation is over; it is time for the director's final decision. The user is presented with a clear choice, embodied by four buttons:

1.  `[🚀 Open Terminal in Worktree]`: The primary validation tool.
2.  `[✅ Accept and Merge Branch]`: The "happy path" to integrate the work.
3.  `[❌ Reject and Discard Branch]`: The "escape hatch" to destroy the work.
4.  `[⏸️ Finish & Hold Branch]`: The crucial "pause button" to save the work for later without merging.

### 3.6. The Return Journey: Simplicity Restored
The user, satisfied with the work, clicks `[✅ Accept and Merge Branch]`.

The system performs the complex Git operations in the background. Once complete, the workspace instantly transforms back. The File Explorer reverts to showing the main project. The Status Bar Navigator reads `🤖 RoboSmith: My Project (main)` again. The task is gone from the navigator list.

The user is back in the "Lobby." The cockpit has vanished. The world is simple and familiar again, but now it contains the fruits of the automated labor. The separation of worlds is maintained, and apparent simplicity is achieved.