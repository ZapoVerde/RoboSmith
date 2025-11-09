# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   The primary objective is to implement a single, unified "Intervention Panel" that serves as the exclusive user interface for both observing and controlling an active workflow. This change replaces previous, disparate UI concepts to create a streamlined, context-aware experience that aligns with the project's core UX vision.

### **1.1 Detailed Description**
*   This architecture defines a new, dual-mode UI component that lives in the editor's bottom panel area. By default, it operates in a read-only "Observability Mode," displaying the detailed conversational history and context for any workflow step the user selects. When the backend workflow engine enters a paused state, the panel automatically transitions to its "Intervention Mode," revealing interactive controls. In this mode, it presents the user with the context of the halt (such as a test failure), provides a text input for them to offer manual guidance, and displays a clear set of action buttons to retry, resume, or abort the workflow.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
*   **Principle of Apparent Simplicity:** The unified panel simplifies the user experience by merging multiple functions into one component that intelligently reveals controls only when needed [cite: docs/architecture/ux_vision.md].
*   **Management by Exception:** This panel is the direct implementation of this principle, serving as the primary tool for user intervention when the autonomous system halts [cite: docs/architecture/RoboSmith_spec.md].
*   **On-Demand Transparency (The "Glass Box"):** The panel provides a transparent, on-demand view into any step of the workflow, allowing the user to inspect the exact inputs and outputs without cluttering the primary UI [cite: docs/architecture/ux_vision.md].

*   **Blueprint-Specific Principles:**
*   **Single Unified Component:** There must be only one component for user interaction. All previous "chat" or "quick fix" UIs must be removed and their functionality consolidated into this panel.
*   **State-Driven Modality:** The panel's mode (Read-Only vs. Interactive) must be determined exclusively by a boolean `isHalted` flag received from the backend's authoritative state model. The UI contains no logic for this decision.
*   **Decoupled UI:** The panel is a "dumb" component. Its sole responsibility is to render the state provided by the backend and dispatch well-defined, atomic event messages back to the backend. It contains no business logic.

### **3. Architectural Flows**
*   **User Flow:**
    1.  **Observability:** While supervising a running workflow in the "Mission Control Panel," the user clicks on a completed or in-progress block to understand its history. The Intervention Panel appears, displaying a read-only, scrollable history of that specific step's execution.
    2.  **Intervention:** A workflow step fails a validation check, causing the backend engine to pause. The Intervention Panel automatically gains focus. The user sees the error context, types a corrective instruction into the text input, and clicks the `[Retry Failed Block]` button. The workflow then resumes its execution using the user's new guidance.

*   **Data Flow:**
    1.  The backend's main orchestrator sends a comprehensive state object to the frontend whenever a change occurs. This object contains the full execution history for all steps and a simple boolean flag indicating if the workflow is currently halted.
    2.  The main UI view receives this state object and passes the relevant parts to the Intervention Panel component.
    3.  When the user interacts with an action button (e.g., `[Retry]`), the panel's logic creates a new, specific message object. This object contains the type of action and any text from the user guidance input field.
    4.  This message object is dispatched back to the backend's central event handler for processing.

*   **Logic Flow:**
    1.  The backend workflow engine encounters a failure and halts. Its internal logic sets its `isHalted` status to `true` and broadcasts its updated state to the UI.
    2.  The UI's main controller receives the new state. The presence of `isHalted: true` causes the Intervention Panel component to render its interactive elements (input box and action buttons).
    3.  The user clicks the `[Retry]` button. The UI component's event handler logic creates a `retryBlock` message, including the content from the guidance text box in its payload.
    4.  The backend's central event handler receives the `retryBlock` message. Its logic routes this message to the correct paused workflow engine instance.
    5.  The engine's `retry` method is invoked. It consumes the user's guidance from the payload, adds it to its conversational memory, sets its `isHalted` status back to `false`, and re-runs the failed step, thus completing the intervention loop.

### **4. Overall Acceptance Criteria**
*   A new, unified Intervention Panel UI component must exist and be integrated into the main application view.
*   When a workflow is running normally, the panel must correctly display a read-only history for any user-selected workflow block.
*   When the backend orchestrator's state indicates it is halted, the panel must automatically become interactive, displaying an input field and action buttons.
*   Clicking the `[Retry]` button must successfully dispatch a `retryBlock` message with the correct payload to the backend.
*   Clicking the `[Resume]` button must successfully dispatch a `resumeWorkflow` message with the correct payload to the backend.
*   All previously existing UI components related to "Quick Fix" or "RoboSmith Chat" must be fully removed from the application.