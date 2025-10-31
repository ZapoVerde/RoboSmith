# RoboSmith Detailed Specification: Chapter 1

## 1. High-Level Summary

This chapter defines the foundational principles, goals, and core identity of the RoboSmith project. It serves as the primary directive for all subsequent development decisions. The system's identity, philosophy, and mission must be reflected in every component that is built.

---

### 1.1. Project Title

#### 1.1.1. Statement
The official project title is **RoboSmith**.

#### 1.1.2. Elaboration for Implementation
- **Internal Identifier:** The canonical, machine-readable identifier for this project shall be `robo-smith`.
- **VS Code Extension ID:** The extension identifier in the `package.json` file shall be `robo-smith-extension`.
- **Code Naming Conventions:** All internal classes, modules, and major components should be prefixed or clearly associated with the `RoboSmith` name (e.g., `RoboSmithOrchestrator`, `RoboSmithWorktreeManager`).

---

### 1.2. Core Philosophy

#### 1.2.1. Statement
To create a "best-in-class" implementation of a proven, human-supervised AI development workflow, directly integrated into the VS Code environment. The system is built on the principle of **"No unnecessary context, but all the necessary context,"** aiming to eliminate friction and automate tedious tasks, while keeping the human user in a strategic, supervisory role.

#### 1.2.2. Elaboration for Implementation
This philosophy translates into the following non-negotiable architectural mandates:

- **Mandate A: The System is a Deterministic Orchestrator, Not a Speculative Agent.**
  - The core logic of RoboSmith is a deterministic state machine. Its behavior MUST be explicitly defined and driven by the declarative `workflows.json` manifest. The system does not "decide" what to do next; it executes the defined workflow program.
  - All AI interactions are structured as calls to specialized "Workers," not as open-ended conversations with a general-purpose assistant.

- **Mandate B: Context is Surgically Precise and Multi-Layered.**
  - The principle of "No unnecessary context, but all the necessary context" MUST be implemented via the integration of a **Programmable Context Partitioner** (based on `roberto-mcp`).
  - This partitioner is a high-performance, polyglot, compiled binary (e.g., written in Rust) that is executed as a command-line tool.
  - It will be guided by a **dual-preamble system** within each source file:
    1.  A **Machine-Readable Header:** A single-line JSON comment (e.g., `// roberto: {...}`) for high-speed, programmatic analysis by the partitioner.
    2.  An **Architectural Contract:** A rich, multi-line JSDoc block providing deep intent and principles for the AI Workers.
  - The workflow manifest (`workflows.json`) will specify which named "slice" of context (as defined by the partitioner's configuration) is required for each step, ensuring each worker receives the minimal, purpose-built context it needs.

- **Mandate C: The User's Role is "Management by Exception."**
  - The default state of any workflow is autonomous execution. The user initiates a process and observes its progress.
  - The system MUST only halt and require user input when a step in the workflow explicitly fails its validation check or is configured as a manual gate.

- **Mandate D: All Sources of Friction Must Be Actively Eliminated.**
  - The system must be designed to minimize user clicks, context switching, and manual data transfer, implemented via `auto-proceed` logic, `Git Worktree Isolation`, and `Smart Diffing`.

---

### 1.3. V1 Mission

#### 1.3.1. Statement
Deliver an economically viable, robust, and highly automated tool that faithfully implements the user's end-to-end process for creating and modifying software. The tool will act as a perfect digital assistant, orchestrating a team of specialized AI specialists according to a user-defined workflow, and presenting clear, actionable information for expert review at every stage.

#### 1.3.2. Elaboration for Implementation
This mission statement defines the following top-level feature requirements for the V1 release:

- **Requirement A: Economic Viability.**
  - All outgoing LLM API calls MUST be routed through the **`API Pool Manager`**.
  - The **`Programmable Context Partitioner`** is a primary feature for economic viability due to its token-saving function.

- **Requirement B: Robustness.**
  - The system MUST use **`Git Worktree Isolation`** for all file modification tasks.
  - The development environment MUST be defined by the **`Nix Flake`** to ensure reproducibility for the developers of RoboSmith itself.

- **Requirement C: Faithful Automation via a Declarative Engine.**
  - The core of the system is the **`Orchestrator`** engine, whose sole purpose is to interpret and execute the `workflows.json` manifest with perfect fidelity.
  - The engine's logic MUST be a state machine that fully supports the concepts of `Workers`, `Nodes`, `Steps`, and `Actions`, including multi-turn conversational nodes and conditional branching via the `execute_node` action.

- **Requirement D: Orchestration of AI Specialists.**
  - The system must implement the **`Worker`** concept. The user must be able to define a roster of workers in the manifest, each with a specific model and contract.
  - The orchestrator must be able to switch between different workers for different steps within the same node.

- **Requirement E: Clear, Actionable Information.**
  - The system must provide a clear, real-time view of its state using the **`Status System`** (color codes).
  - For final review, the **`Integration Panel`** must be presented, providing direct access to a terminal scoped to the correct worktree.
  - For debugging the system itself, the **`AI Call Inspector`** must be implemented, logging every AI call as a structured, replayable object.

## 2. Core Workflow & Architecture

This chapter defines the fundamental technical architecture of the RoboSmith extension. It details the platform, the separation of concerns between components, and the core concepts of the workflow engine. These architectural decisions are mandatory and form the non-negotiable foundation of the project.

---

### 2.1. Platform & Architecture

#### 2.1.1. Statement
- **Platform:** The tool will be a **VS Code Extension**.
- **Remote-First Design:** The architecture is designed for a "headless" backend and a web-based frontend.
  - **Backend (Server):** The VS Code Server will run on a user-controlled machine (e.g., a homelab PC). It hosts the files, terminals, and the extension's core logic.
  - **Frontend (Client):** The user interacts with the system via any standard web browser using the official `vscode.dev` service and its secure remote tunnel feature.

#### 2.1.2. Elaboration for Implementation
- **VS Code Extension Manifest (`package.json`):**
  - The `main` entry point shall be defined as `out/extension.js`.
  - The `"extensionKind"` property MUST be set to `["workspace"]`. This ensures the extension's core logic runs on the remote server (the "Extension Host").
  - The `activationEvents` shall be configured to activate the extension when the workspace contains a `.vision/` directory (e.g., `onWorkspaceContains:.vision/workflows.json`).

- **Backend (Server) Implementation Mandates:**
  - All core logic MUST be written with the assumption that it is running in a headless, Node.js environment on a remote machine.
  - All communication with the user interface MUST be routed through the Event Bus.
  - File system operations should prioritize the use of the `vscode.workspace.fs` API.

- **Frontend (Client) Implementation Mandates:**
  - All UI components MUST be implemented as VS Code WebViews.
  - The source code for the UI MUST be located in a dedicated directory (e.g., `webview-ui/`).
  - The UI MUST be designed to be stateless. The authoritative source of truth for the application's state resides in the Extension Host (backend).

---

### 2.2. Internal Architecture

#### 2.2.1. Statement
The extension will be architected with a strict separation between the UI and the core logic:
- **Extension Host (Backend):** A separate Node.js process that runs all heavy logic: AI calls, file system access, Git commands, and the workflow orchestrator.
- **WebView (Frontend):** The UI panels are rendered in an isolated WebView.
- **Event Bus:** All communication between the UI and the Extension Host is asynchronous via a `postMessage` event bus.

#### 2.2.2. Elaboration for Implementation
- **The Extension Host (Backend):**
  - This is the stateful core of the application. It is responsible for instantiating and managing all major singleton services, including:
    - The **Orchestrator Engine**
    - The **API Pool Manager**
    - The **Git Worktree Manager**
    - The **Context Partitioner Service** (the wrapper for `roberto-mcp`)
  - It maintains the complete state of all active workflow sessions.

- **The WebView (Frontend):**
  - The frontend code MUST be self-contained and not directly reference any VS Code APIs, with the exception of the `acquireVsCodeApi()` function.

- **The Event Bus:**
  - A standardized message interface MUST be defined in a shared types file (e.g., `src/shared/types.ts`).
  - All messages MUST conform to the following interface:
    ```typescript
    interface Message {
      command: string; // e.g., 'startWorkflow', 'updateStatus', 'taskComplete'
      payload: any;
    }
    ```
  - A complete list of all possible `command` values and their `payload` schemas MUST be defined in this shared file.

---

### 2.3. The Workflow Engine: Core Concepts

#### 2.3.1. Statement
The entire system is a deterministic state machine driven by a declarative manifest (`workflows.json`). It operates on a few core concepts:
- **Worker:** A specialized AI agent; a pre-configured combination of a specific model and a contract document.
- **Node:** A container for a sequence of steps designed to accomplish a high-level task. A node is defined by a shared secondary context stack and maintains a contiguous memory ("scratchpad") for its steps.
- **Step:** The smallest unit of work, defining a single AI call with a specific `worker`, `prompt`, `context_slice`, and `validation` condition.
- **Action:** A transition in the state machine. Each step defines `actions` for `onSuccess` and `onFailure`, allowing for complex workflow logic.

#### 2.3.2. Elaboration for Implementation
- **The Orchestrator Engine:** This is the central component of the backend. It is responsible for parsing and executing the `workflows.json` manifest.
  - **Worker Instantiation:** The orchestrator will contain a `WorkerFactory` responsible for creating worker instances based on the `workers` roster in the manifest.
  - **Node Execution:**
    - When a node is executed, the orchestrator MUST create a new **Node Execution Context**.
    - This context includes the **Contiguous Memory**, which SHALL be implemented as a `Map<string, any>` or `Record<string, any>`. The output of each successfully completed step MUST be stored in this map, keyed by the step's `name`.
    - The context also includes the **Shared Secondary Context Stack**. The orchestrator MUST, at the start of the node, load the content of all files listed in the node's `context` array. This content MUST be prepended to the prompt of every AI call made within that node.
  - **Step Execution:** The orchestrator's main loop processes one step at a time.
    - Before making the AI call, it MUST invoke the **`Context Partitioner Service`**, requesting the specific, named `context_slice` defined for that step in the manifest.
    - The resulting context package is then added to the prompt assembly.
  - **Action Handler:** The orchestrator MUST contain a dedicated `ActionHandler` module.
    - After a step is executed and its output validated, the `ActionHandler` is invoked.
    - It is responsible for determining the next state of the workflow, returning a command such as `PROCEED_TO_NEXT_STEP`, `HALT_AND_FLAG`, `JUMP_TO_NODE(nodeName)`, or `RETURN_FROM_SUBROUTINE`.


# RoboSmith Detailed Specification: Chapter 3

## 3. V1 Feature Specification

This chapter details the specific features required for the V1 release. Each feature must be implemented according to the provided elaboration, ensuring it aligns with the core principles and architecture defined in the preceding chapters.

---

### 3.1. The "Factory": The Manifest-Driven Engine

The Factory is the core orchestrator that executes the `workflows.json` manifest. It is a highly automated system that requires human intervention only on a failure or a pre-configured manual gate.

#### 3.1.1. Statement
- **The Workflow Manifest (`workflows.json`):** This is the "source code" for all AI workflows. It is a single, version-controllable file that declaratively defines all `workers`, `nodes`, and their constituent `steps` and `actions`.
- **"Planning Session" UI:** A UI that visualizes the real-time execution of the manifest, showing the status of each node and step. It defaults to "auto-proceed" on success.

#### 3.1.2. Elaboration for Implementation
- **Workflow Manifest (`workflows.json`) Parsing:**
  - The Extension Host MUST, upon activation, locate and parse the `.vision/workflows.json` file.
  - A dedicated `WorkflowService` shall be responsible for validating this file against a predefined JSON schema upon loading. If validation fails, a user-facing error must be shown.

- **"Planning Session" UI (WebView):**
  - The UI SHALL be implemented as a VS Code WebView panel.
  - It is a **reactive component** that renders a state object received from the Extension Host.
  - **State Object Schema:** The Extension Host will send a `planningStateUpdate` message to the UI. The payload MUST conform to this schema:
    ```typescript
    interface PlanningState {
      nodeId: string;
      currentStepIndex: number;
      steps: Array<{ name: string; status: 'pending' | 'in_progress' | 'action_required' | 'complete'; }>;
      lastOutput: string | null;
      isHalted: boolean;
      errorMessage: string | null;
    }
    ```
  - **Supervisor Controls Implementation:**
    - The UI will render buttons (`[Accept]`, `[Revise]`, `[Abort]`) only when `isHalted` is true.
    - Clicking a button MUST send a corresponding message to the Extension Host (e.g., `{ command: 'userAction', payload: { action: 'proceed' } }`).

---

### 3.2. The "Workbench": The Multi-Session Cockpit

The Workbench is the user's primary dashboard for initiating and managing the parallel execution of work plans.

#### 3.2.1. Statement
- **Multi-Session Tabs:** The Workbench UI supports multiple tabs, allowing the parallel execution of tasks. Each tab is a self-contained "universe" backed by a dedicated Git Worktree.
- **Unified Work Plan Panel:** A sidebar panel that lists all files from an approved plan. Each item has a single action: `[ 🚀 Implement ]`, which triggers the `Implement` node from the manifest in a new Workbench tab.
- **Automated QA Loop:** The default `Implement` node will be a multi-step process that automates quality assurance, using different workers for coding and validation, and automatically handling syntax errors.

#### 3.2.2. Elaboration for Implementation
- **Workbench UI Panel (WebView):**
  - This UI MUST be registered as a primary sidebar view in `package.json`.
  - It MUST be capable of rendering a tab for each active session managed by the Extension Host.
  - The tab header for each session MUST render the **decoupled UI systems** (Health stoplight, Overlap label, Queue icon) as defined in `docs/architecture/GitWorktree_System.md`.

- **Automated QA Loop Logic:**
  - Upon receiving an `implementTask` message, the Orchestrator MUST initiate the `Implement` node from the manifest.
  - A **heuristic check for squiggles** MUST be performed after the code generation step by calling `vscode.languages.getDiagnostics(uri)`. If errors are found, the Orchestrator initiates the `onFailure` action defined for that step (e.g., branching to a `Troubleshoot_Code` node).

---

### 3.3. Core Technical Features (All V1)

This section defines the implementation requirements for the core backend services.

#### 3.3.1. API Pool Manager
- **Implementation:** A singleton class `ApiPoolManager` will be instantiated in the Extension Host.
- **Configuration:** It MUST load its roster of keys from the `SecureStorageService`.
- **Interface:** It will expose a primary method, `execute(workOrder: WorkOrder): Promise<Result>`, which will contain the "failover-driven round-robin" logic.

#### 3.3.2. Git Worktree Isolation & Management
- **Authoritative Document:** The entire operational logic, including initialization, conflict detection, queuing, and UI signaling, is defined in the canonical architectural document: **`docs/architecture/GitWorktree_System.md`**.
- **Implementation:** A singleton class `GitWorktreeManager` will be instantiated. The implementation of this service and its related UI components MUST adhere strictly to the design laid out in the authoritative document.
- **Key Responsibilities:** The service's primary responsibilities include creating/removing worktrees, running the proactive overlap scan using the Context Partitioner's seed files, and managing the FIFO queue for conflicting tasks.

#### 3.3.3. The Integration Panel
- **Implementation:** A dedicated WebView panel.
- **Trigger:** It is shown when the Orchestrator sends a `taskReadyForIntegration` message, containing the `sessionId` and `branchName`.
- **Primary Action: `[ 🚀 Open Terminal in Worktree ]`**
  - This is the main user action. It sends a message to the Extension Host.
  - The backend handles this by using `vscode.window.createTerminal()`, providing the `cwd` option pointing to the correct worktree path.
- **Final Actions: User-Controlled Commit & Merge**
  - The panel will display the staged changes and a pre-populated commit message.
  - The `[ ✅ Commit, Merge & Push ]` button is the final step, which the user must explicitly click. The backend will then execute the necessary Git commands.

#### 3.3.4. Quick Fix Mode
- **Activation:** The extension MUST register a new command, `roboSmith.quickFix`, in `package.json`.
- **Context Gathering:** The command handler will get the active editor and selection using `vscode.window.activeTextEditor`.
- **UI:** It will create a temporary `WebviewPanel` for the chat interaction.
- **Applying Changes:** The final code change MUST be applied as a `vscode.WorkspaceEdit`.

#### 3.3.5. Programmable Context Partitioner (Integration)
- **Implementation:** A singleton class `ContextPartitionerService` will be instantiated.
- **Interface:** It MUST expose an async method `getContext(filePath: string, sliceName: string): Promise<string>`.
- **Logic:** This service is a wrapper around the compiled `roberto-mcp` binary.
  - It MUST select the correct binary for the host OS.
  - It will execute the binary as a child process, passing the `filePath` and `sliceName` as command-line arguments.
  - It will capture the `stdout` from the process and return the final context package as a string.

---

### 3.4. UI/UX: The Status System

#### 3.4.1. Statement
A consistent, decoupled signaling system will be used to provide clear, unambiguous status information for each session tab.

#### 3.4.2. Elaboration for Implementation
- **Decoupled Systems:** The UI for each tab header will be composed of several independent elements, as defined in `docs/architecture/GitWorktree_System.md`. This includes:
  - **Health System:** A color-coded stoplight (`Grey`, `Amber`, `Red`, `Green`) representing the technical integrity of the worktree.
  - **Overlap System:** A text-based label (`Clear`, `Context Overlap`, `Clash`) indicating the result of the conflict scan.
  - **Queue System:** An icon (`⏳`, `▶️`, `✅`) representing the task's status in the FIFO queue.
- **Shared Type Definition:** A shared `types.ts` file MUST define enums for each of these status systems (e.g., `HealthStatus`, `OverlapStatus`, `QueueStatus`).
- **State Management:** All state objects passed from the Extension Host to the WebViews MUST include properties for each of these status systems.


# RoboSmith Detailed Specification: Chapter 4

## 4. Development Environment & Tooling

This chapter specifies the environment, tools, and technologies that will be used to develop, build, and package the RoboSmith extension. Adherence to these standards is mandatory to ensure project consistency, reproducibility, and maintainability.

---

### 4.1. Development Environment

#### 4.1.1. Statement
The development environment for the RoboSmith extension itself will be fully defined and managed by a **Nix Flake**. This ensures a 100% reproducible and consistent toolchain for any developer working on the extension, eliminating setup friction.

#### 4.1.2. Elaboration for Implementation
- **`flake.nix` File:** A `flake.nix` file MUST be created at the root of the project repository.
- **Core Dependencies:** The flake's `devShell` MUST provide the following exact dependencies:
  - **Node.js:** A specific LTS version (e.g., 20.x).
  - **npm:** The version of npm bundled with the specified Node.js version.
  - **Git:** The version control system.
  - **Rust Toolchain (for the Partitioner):** The Rust compiler (`rustc`) and package manager (`cargo`) to allow for building and testing the `roberto-mcp` component.
- **`direnv` Integration:** The project MUST include a `.envrc` file with the content `use flake` to allow for automatic shell activation.
- **VS Code Settings:** The `.vscode/settings.json` file should be configured to integrate with the Nix environment, ensuring that the VS Code terminal and tasks automatically use the Nix-managed shell.
- **User Environment Agnosticism:** It must be clearly documented that the Nix Flake is a tool **for the development of RoboSmith only**. The final, packaged extension will have no dependency on Nix and will run in any standard VS Code environment, with the expectation that the user's remote server has the necessary runtimes (e.g., Python, Go) for the projects they are working on.

---

### 4.2. Core Technologies

#### 4.2.1. Statement
- **Language:** TypeScript
- **Platform:** VS Code Extension API
- **UI Framework:** Svelte
- **Context Partitioner:** A compiled Rust binary (`roberto-mcp`)

#### 4.2.2. Elaboration for Implementation
- **Language (TypeScript):**
  - **`tsconfig.json`:** The project MUST include separate `tsconfig.json` files for the Extension Host (backend) and the WebView (frontend) code.
  - **Strict Mode:** TypeScript's `strict` mode MUST be enabled.
  - **Linting:** ESLint with the TypeScript plugin MUST be configured. A pre-commit hook (using a tool like Husky) shall be set up to run the linter.
  - **Formatting:** Prettier MUST be used for code formatting.

- **Platform (VS Code Extension API):**
  - **Dependencies:** The project will use the `@types/vscode` package for type definitions and `@vscode/test-electron` for running integration tests.
  - **API Usage:** All interactions with the VS Code environment MUST be done through the official `vscode` API module.

- **UI Framework (Svelte):**
  - **Choice:** Svelte is selected for its high performance, small bundle size, and simple component-based architecture.
  - **Build Process:** A build script (using Vite) MUST be configured to compile the Svelte components and all other WebView assets into a single, bundled JavaScript file.
  - **Styling:** No large, third-party component libraries shall be used in V1. A custom set of CSS styles will be created, leveraging VS Code's own CSS variables (e.g., `--vscode-editor-background`) to ensure the UI feels native to the editor's current theme.

- **Context Partitioner (Rust Binary):**
  - **Integration Model:** The compiled `roberto-mcp` binary will be treated as a standalone command-line tool, executed by the `ContextPartitionerService`.
  - **Distribution:** Pre-compiled binaries for target platforms (Windows x64, macOS ARM64/x64, Linux x64) MUST be included in a `bin/` directory within the packaged extension.
  - **Dispatch Logic:** The `ContextPartitionerService` MUST contain logic to detect the host OS and architecture and select the correct binary to execute.

# RoboSmith Detailed Specification: Chapter 5

## 5. V1 Success Criteria (The "Definition of Done")

This chapter defines the specific, measurable, and demonstrable goals for the V1 release. The project is considered complete and successful only when all of the following criteria are met. These criteria will serve as the basis for the final acceptance testing.

---

### 5.1. Define a Complete Workflow

#### 5.1.1. Statement
Successfully define a multi-step, multi-worker node (like `Implement`) in `workflows.json` that includes a conditional side loop for troubleshooting.

#### 5.1.2. Elaboration for Implementation
- **Test Case:** A unit test for the `WorkflowService`.
- **Prerequisites:**
  - A test `workflows.json` file must be created that defines a main node and a separate "troubleshooting" node.
  - The main node must contain a step with an `onFailure` action of type `execute_node`, pointing to the troubleshooting node.
- **Execution:**
  - The `WorkflowService` must parse this manifest.
- **Acceptance Criteria:**
  - The service must parse the file without errors.
  - The parsed object in memory must correctly represent the defined structure, including the conditional branching logic. The test must assert that the `onFailure` action is correctly linked to the troubleshooting node definition.

---

### 5.2. Execute a Plan Autonomously

#### 5.2.1. Statement
Supervise the "Factory" as it autonomously executes a plan, only intervening when the system correctly identifies a failure and triggers a `stop_and_flag` action.

#### 5.2.2. Elaboration for Implementation
- **Test Case:** An integration test for the Orchestrator's "happy path" and "failure path."
- **Prerequisites:**
  - A manifest must define a node with at least two steps, where the first step is configured with an `onSuccess` action of type `proceed`.
- **Happy Path Execution:**
  - The test initiates the node.
  - The AI worker for the first step is mocked to provide a response that **includes** the required `proceedSignal`.
- **Happy Path Acceptance Criteria:**
  - The orchestrator must automatically proceed to the second step without requiring any user clicks.
  - The UI must receive an event sequence that shows the first step's status changing from `amber` to `green`, and the second step's status changing to `amber`.

- **Failure Path Execution:**
  - The test initiates the node.
  - The AI worker for the first step is mocked to provide a response that **does not include** the `proceedSignal`.
- **Failure Path Acceptance Criteria:**
  - The orchestrator must immediately execute the `onFailure` action, which should be `stop_and_flag`.
  - The UI must receive a final state update showing the first step's status as `🔴 Red (Action Required)`.

---

### 5.3. Validate a Feature

#### 5.3.1. Statement
Use the "Integration Panel" to successfully open a terminal in the correct worktree for a feature that was completed by the automated workflow.

#### 5.3.2. Elaboration for Implementation
- **Test Case:** A full end-to-end implementation test.
- **Prerequisites:**
  - A simple, runnable sample project will be used as the test bed.
  - A task must be successfully completed by the "Workbench," resulting in a staged (but not committed) Git Worktree.
- **Execution:**
  - The user is presented with the "Integration Panel" for the completed task.
  - The user clicks the `[ 🚀 Open Terminal in Worktree ]` button.
- **Acceptance Criteria:**
  - A new VS Code terminal must be created.
  - The terminal's name MUST be set to the task/branch name.
  - The terminal's current working directory MUST be correctly set to the absolute path of the isolated Git Worktree for that specific task.

---

### 5.4. Achieve Economic Viability

#### 5.4.1. Statement
Successfully use the "API Pool Manager" to complete a task by automatically failing over from a rate-limited or depleted key to a valid one.

#### 5.4.2. Elaboration for Implementation
- **Test Case:** An integration test for the `ApiPoolManager`.
- **Prerequisites:**
  - The extension's secure storage must be configured with a roster of at least two API keys.
- **Execution:**
  - An AI request is initiated.
  - The LLM API endpoint will be mocked to return a `429 Too Many Requests` error for the first key in the roster.
  - The same endpoint will be mocked to return a successful response for the second key.
- **Acceptance Criteria:**
  - The `ApiPoolManager` must successfully catch the `429` error.
  - It must automatically re-run the request using the second key.
  - The final result returned to the user must be the successful response from the second key.

---

### 5.5. Debug and Refine a Prompt

#### 5.5.1. Statement
Use the "AI Call Inspector" to successfully load a past AI call, modify its contract or prompt, and re-run it to compare the output.

#### 5.5.2. Elaboration for Implementation
- **Test Case:** A test of the debugging and replay functionality.
- **Prerequisites:**
  - At least one AI call must have been made and logged by the system to the `.vision/logs/` directory.
- **Execution:**
  - The user opens the "AI Call Inspector" UI.
  - The user selects a logged call from the history.
  - The UI must display the segmented JSON payload of the original request.
  - The user modifies the content of one of the prompt segments.
  - The user clicks the `[ 🔬 Re-run & Compare ]` button.
- **Acceptance Criteria:**
  - A new AI call must be made using the modified payload.
  - The UI must display a side-by-side diff view showing the original AI response on one side and the new AI response on the other.


# RoboSmith Detailed Specification: Chapter 6

## 6. Key Risks and Mitigation Strategies

This chapter identifies the most significant potential risks to the RoboSmith project's success. For each risk, a corresponding mitigation strategy is defined. These strategies are not afterthoughts; they are core principles that are already integrated into the V1 design and must be prioritized during implementation.

---

### 6.1. Risk: AI Output is Unreliable or Inconsistent

#### 6.1.1. Description
The core functionality of the system depends on the output of Large Language Models. These models are non-deterministic and can produce outputs that are subtly incorrect, poorly formatted, or logically flawed. A failure to handle this unreliability will result in a tool that is untrustworthy and frustrating to use.

#### 6.1.2. Mitigation Strategies
- **Primary Mitigation: The Manifest-Driven Workflow Engine with Conditional Branching.**
  - **Implementation Mandate:** The entire "Factory" and "Workbench" must be implemented as a state machine driven by the `workflows.json` manifest. This is the primary defense against AI unreliability. More importantly, the manifest's support for the `execute_node` action on failure allows the system to implement intelligent error handling. Instead of a simple retry, a failure can be routed to a specialized `Troubleshooter` node, which uses a different worker (e.g., Gemini 2.5 Flash) and a different contract specifically designed to fix broken code. This creates a robust, self-correcting system.

- **Secondary Mitigation: Automated Validation Signals.**
  - **Implementation Mandate:** The orchestrator's validation logic is a critical component. The system MUST implement the "keyword signal" (`validation.signal`) check after AI steps. If the signal is missing, the workflow MUST execute the defined `onFailure` action, triggering the robust branching logic described above. This prevents a "garbage in, garbage out" cascade.

- **Tertiary Mitigation: The AI Call Inspector.**
  - **Implementation Mandate:** The `AI Call Inspector` must be implemented as a core V1 feature. When an AI failure is too complex for the automated system to handle, this tool is the essential escape hatch for the human supervisor. It provides the necessary observability to understand *why* the AI failed and the tooling to experiment with prompt changes.

---

### 6.2. Risk: Git Worktree Management is Complex and Fragile

#### 6.2.1. Description
The use of Git Worktrees is a core architectural pillar for safety and parallelism. However, programmatic manipulation of Git state is inherently complex, and concurrent operations can lead to race conditions, data corruption, or a confusing user experience.

#### 6.2.2. Mitigation Strategies
- **Primary Mitigation: The Formalized Git Worktree System Architecture.**
  - **Implementation Mandate:** The risk is primarily mitigated by the detailed architectural plan laid out in **`docs/architecture/GitWorktree_System.md`**. This is the authoritative document. Its key features are:
    - **Proactive Conflict Detection:** A simple, fast, and 100% reliable conflict scan based on the intersection of the Context Partitioner's "seed files." This prevents dangerous file modification conflicts before they can occur.
    - **Deterministic Queuing:** A First-In-First-Out (FIFO) queue for conflicting tasks, which ensures that workflows proceed in a predictable order and that the assumptions of early tasks are preserved.

- **Secondary Mitigation: The Decoupled UI Signaling System.**
  - **Implementation Mandate:** The UI MUST implement the decoupled signaling system defined in the architecture document. By providing separate, unambiguous indicators for **Health**, **Overlap**, and **Queue** status, the user is given a clear and precise understanding of each task's state, preventing confusion and building trust.

- **Tertiary Mitigation: Robust Error Handling and Cleanup.**
  - **Implementation Mandate:** The `GitWorktreeManager` service MUST be built with comprehensive error handling. Additionally, the extension MUST register a `roboSmith.cleanupWorktrees` command to provide users with a safe and reliable recovery mechanism for any orphaned worktree directories.

---

### 6.3. Risk: API Costs Exceed Expectations

#### 6.3.1. Description
The system is designed to be highly automated, making many AI calls in the background. If not carefully managed, this could lead to unexpectedly high API bills for the user, rendering the tool economically non-viable.

#### 6.3.2. Mitigation Strategies
- **Primary Mitigation: The API Pool Manager.**
  - **Implementation Mandate:** This is a mandatory V1 feature. It directly addresses the risk by allowing users to spread load across multiple keys, taking advantage of free tiers and different pricing models.

- **Secondary Mitigation: The Programmable Context Partitioner.**
  - **Implementation Mandate:** This is the primary token-saving mechanism and is a core V1 feature. The `workflows.json` manifest MUST be able to specify a named `context_slice` for each step. This allows the system to provide the AI with the minimal, purpose-built context required for a specific task (e.g., a "Testing_Context" for a test-writing worker), which is far more efficient than a one-size-fits-all context.

- **Tertiary Mitigation: Observability via the AI Call Inspector.**
  - **Implementation Mandate:** Every logged AI call in the `AI Call Inspector` MUST include the token usage data (`tokens_used`) returned by the API. This gives the user a clear, auditable trail of their consumption, allowing them to identify which steps or workers in their workflow are the most expensive.


# RoboSmith Detailed Specification: Chapter 7

## 7. Non-Goals (Exclusions for V1)

This chapter explicitly defines the features and capabilities that are **out of scope** for the V1 release of RoboSmith. Establishing clear boundaries is a critical part of the project plan, ensuring that the development effort is focused on delivering a robust and complete core product. These items may be considered for future versions (V2+) but are not to be included in the initial implementation.

---

### 7.1. No Unsupervised, Speculative Agents

#### 7.1.1. Statement
The V1 system is highly automated but fully deterministic. It follows the explicit steps, branches, and subroutines defined in the workflow manifest. It does not have a general-purpose, open-ended "ReAct" (Reason+Act) loop to figure out what to do next.

#### 7.1.2. Elaboration for Implementation
- **Architectural Mandate:** The Orchestrator engine's design is a **state machine**, not an agentic loop. It reads a step, executes it, and based on the result, transitions to a well-defined next state according to the `actions` block in the manifest.
- **Implementation Constraint:** The AI is never asked to create its own plan to recover from a failure. All retry and branching logic is explicitly defined in the `workflows.json` manifest (e.g., branching to a `Troubleshoot_Code` node).

---

### 7.2. No Graphical Workflow Editor

#### 7.2.1. Statement
The workflow is configured by editing the `workflows.json` file directly. A GUI for building and managing workflows is a V2+ feature.

#### 7.2.2. Elaboration for Implementation
- **V1 Implementation Requirement:** The extension MUST be fully functional using a manually created and edited `workflows.json` file.
- **Schema Definition:** To support the manual editing process, a comprehensive JSON Schema file (`workflow.schema.json`) MUST be created and registered in the `package.json`. This schema will provide autocompletion, validation, and documentation directly within the VS Code editor for anyone editing the manifest file. This is a critical usability feature for the V1 text-based configuration.

---

### 7.3. No Architectural Review Layer

#### 7.3.1. Statement
The "Scaffolding" and "Refactoring Proposal" features, which insert a manual architectural sign-off step before implementation, are deferred to V2. V1 uses a direct "Plan -> Implement" model.

#### 7.3.2. Elaboration for Implementation
- **V1 Orchestrator Logic:** The orchestrator will not have a concept of an intermediate "stub" or "proposal" state. The output of the "Factory" (planning) phase is a "Work Plan."
- **V1 Workflow:** When a user clicks `[🚀 Implement]`, the system proceeds directly to the implementation, starting with either a blank file (for new files) or the full, current content of an existing file (for modifications).

---

### 7.4. No Support for Non-Git Projects

#### 7.4.1. Statement
The Git Worktree integration is fundamental to the system's safety and parallelism model. The extension will assume the user's project is a Git repository.

#### 7.4.2. Elaboration for Implementation
- **Activation Check:** Upon activation, the extension MUST check if the opened workspace is a valid Git repository. This can be done by checking for the existence of a `.git` directory at the project root.
- **Error Handling:** If the workspace is not a Git repository, the extension MUST disable its core functionality (e.g., the "Implement" buttons). It should show a clear, one-time notification to the user stating, "RoboSmith requires the project to be a Git repository to function."
