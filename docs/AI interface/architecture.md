# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   The primary objective is to create a centralized, robust, and economically-viable service layer to manage all interactions with external AI models. This architecture is explicitly designed to be modular and maintainable, adhering to a strict 250 Line-of-Code limit per file, which ensures clarity and long-term extensibility.

### **1.1 Detailed Description**
*   This architecture establishes a dedicated, multi-component service layer that acts as the single gateway for all AI completions. The system is composed of several specialized modules: a secure service for managing user-provided API keys; a set of interchangeable "Provider" modules, each containing the specific logic to communicate with a single external API (e.g., OpenAI); a stateless façade that selects the correct Provider based on the task's configuration; and a central orchestrator. This orchestrator manages the "key carousel" logic, rotating through available keys to distribute load and automatically failing over to a standby key when a transient error is detected. This modular design ensures that each component is small, focused, and testable, while the system as a whole provides a resilient and unified interface to the rest of the application. All user interaction, such as managing keys, is handled by a separate, decoupled UI layer.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
    *   **The Principle of the 250 LOC Limit:** No single file shall exceed 250 lines of code to ensure clarity and maintainability. [cite: docs/architecture/Horizontal_Principles.MD]
    *   **Economic Viability:** The system must be designed to minimize API costs by spreading load across multiple keys. [cite: RoboSmith_spec.md]
    *   **Robustness:** The system must gracefully handle transient network and API errors, such as rate limiting, without failing the entire operation. [cite: RoboSmith_spec.md]
    *   **Simplicity through Modularity:** The architecture is composed of simple, single-responsibility components to manage complexity. [cite: docs/architecture/Horizontal_Principles.MD]
    *   **Singleton Gateway Pattern:** All communication with external AI services is ultimately routed through a single, application-wide orchestrator instance. [cite: docs/architecture/Horizontal_Principles.MD]
*   **Blueprint-Specific Principles:**
    *   **Provider Contract:** All provider-specific modules **MUST** implement a single, shared interface, making them perfectly interchangeable.
    *   **Stateless Façade:** The component responsible for selecting a provider **MUST** be stateless. Its only job is to delegate calls to the correct provider implementation based on the input configuration.
    *   **Stateful Orchestrator:** The component responsible for the key carousel and failover logic **MUST** be stateful (managing the key pool and cooldowns) but **MUST** delegate the actual network I/O to the stateless façade.
    *   **Decoupled UI:** This entire service layer is a headless, backend-only system. It **MUST NOT** contain any UI code and will interact with the user-facing UI only through an asynchronous event bus and state management layer.

### **3. Architectural Flows**
*   **User Flow:**
    1.  The user provides their LLM API keys via a dedicated settings UI. The UI sends a command to the backend to securely store these credentials.
    2.  When the user initiates a task requiring AI assistance (e.g., in the "Workbench"), they select a pre-configured AI connection to use.
    3.  The application's core logic initiates a request to the AI Service Layer using the selected connection's configuration.
    4.  The service layer transparently handles the complex logic of selecting the specific key from its pool, making the API call, and managing any transient errors.
    5.  The user receives the AI-generated result, completely shielded from the underlying complexity of the key rotation and failover mechanisms.
*   **Data Flow:**
    1.  The `Orchestrator Engine` creates a `WorkOrder` data object and passes it to the `ApiPoolManager`.
    2.  The `ApiPoolManager` retrieves the full roster of stored `ApiKey` data objects from the `SecureStorageService`.
    3.  The `ApiPoolManager` selects a specific `ApiKey` based on its internal "key carousel" logic.
    4.  The `ApiPoolManager` passes the selected key's connection details and the `WorkOrder` to the `aiClient` façade.
    5.  The `aiClient` inspects the connection's `provider` field and instantiates the corresponding `Provider` module (e.g., `OpenAiProvider`).
    6.  The `aiClient` delegates the call to the `OpenAiProvider` module.
    7.  The `OpenAiProvider` transforms the `WorkOrder` into an OpenAI-specific HTTP request payload, makes the external network call, and parses the response.
    8.  The normalized result is returned up the chain through the `aiClient` to the `ApiPoolManager`.
    9.  The `ApiPoolManager` wraps this in a final `ApiResult` data object and returns it to the `Orchestrator Engine`.
*   **Logic Flow:**
    1.  A request is received by the `ApiPoolManager`. It runs its stateful "key carousel" logic to select the next-best `ApiKey` from its pool, skipping any keys on cooldown.
    2.  It delegates the execution to the stateless `aiClient` façade, providing the details of the chosen key and the work to be done.
    3.  The `aiClient` performs a simple, stateless selection: it inspects the `provider` field and calls the appropriate concrete `Provider` module.
    4.  The selected `Provider` module executes the direct, provider-specific network call.
    5.  If the call fails with a temporary error, the result is returned to the `ApiPoolManager`. The `ApiPoolManager` catches the error, places the failed key on cooldown, advances its carousel, and repeats the logic flow from step 2 with the next available key.
    6.  If the call succeeds, the result is passed up the chain, and the `ApiPoolManager` updates its internal state to remember the last successfully used key before returning the final `ApiResult`.

### **4. Overall Acceptance Criteria**
*   The entire AI Service Layer must be implemented across multiple, small files, with **no single file exceeding the 250 LOC limit**.
*   A strict `IAiProvider` interface must exist, and all concrete provider modules (e.g., for OpenAI) must successfully implement it.
*   The `aiClient` façade must correctly delegate an incoming request to the appropriate provider module based on the connection configuration.
*   The `ApiPoolManager` must successfully demonstrate round-robin key selection for consecutive successful requests.
*   The `ApiPoolManager` must successfully demonstrate failover by automatically retrying a request with a second key when the first key's provider is mocked to return a rate-limit error.
*   API keys must be stored securely using the host's native secret management API.
*   The final system must expose a single, simple entry point (`ApiPoolManager.execute`) to the rest of the application, successfully abstracting all internal complexity.