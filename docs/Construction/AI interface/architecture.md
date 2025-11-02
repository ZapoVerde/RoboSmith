Excellent. Locking down the specifications before implementation is the core of this methodology. Here is the full replacement for `docs/Construction/AI interface/architecture.md`.

This new version is a pure translation of our final, hardened architectural decisions into the formal specification format. It replaces the old, multi-component design with a single, powerful, and stateful **`ApiPoolManager`** that directly orchestrates calls, aligning with our latest conversation.

---

# **Architectural Report: AI Service Layer**

### **1. High-Level Goal & Rationale**

- **Goal:** To create a centralized, robust, and economically-viable service layer to manage all interactions with external AI models.
- **Rationale:** This architecture is explicitly designed to be a resilient, stateful singleton that abstracts the complexities of API key management, load balancing, and transient error handling from the rest of the application. It directly implements the project's core principles of **Economic Viability** and **Robustness** by providing a single, reliable gateway for all AI requests.

### **1.1. Detailed Description**

- This architecture establishes a single, stateful orchestrator, the **`ApiPoolManager`**, which serves as the exclusive gateway for all AI completions. The system is composed of three logical parts, managed within this single service:
    1.  A secure persistence layer, which delegates to the `SecureStorageService` to manage the lifecycle of user-provided API keys.
    2.  An in-memory "key carousel," a stateful mechanism that tracks the pool of available keys, manages cooldowns for failed keys, and performs round-robin selection to distribute load.
    3.  A stateless execution façade that dynamically selects the correct provider-specific logic (e.g., for OpenAI, Google) based on the chosen key's metadata, makes the external network call, and normalizes the response.
- This unified design ensures the `ApiPoolManager` is a simple, powerful, and easily testable service that provides a single, clear entry point (`execute`) to the rest of the application.

### **2. Core Principles & Constraints**

- **Governing Principles (From Project Docs):**
  - **Economic Viability:** The system MUST minimize API costs by spreading load across multiple keys and maximizing free-tier usage. [cite: RoboSmith_spec.md]
  - **Robustness:** The system MUST gracefully handle retryable, transient network and API errors (e.g., HTTP 429, 503) without failing the entire operation. [cite: RoboSmith_spec.md]
  - **Singleton Gateway Pattern:** All communication with external AI services MUST be routed through a single, application-wide `ApiPoolManager` instance. [cite: docs/architecture/Horizontal_Principles.MD]
  - **Separation of Concerns:** The stateful logic of key selection and failover MUST be decoupled from the stateless logic of making a specific API call. [cite: docs/architecture/Horizontal_Principles.MD]

- **Blueprint-Specific Principles:**
  - **Provider Contract:** All provider-specific modules (e.g., `OpenAiProvider`) **MUST** implement a single, shared `IAiProvider` interface, making them perfectly interchangeable.
  - **Stateful Orchestrator, Stateless Execution:** The `ApiPoolManager` **MUST** be stateful (managing the key pool and cooldowns) but **MUST** delegate the actual, stateless network I/O to the appropriate provider module.
  - **Decoupled UI:** This entire service layer is a headless, backend-only system. It **MUST NOT** contain any UI code.

### **3. Architectural Flows**

- **User Flow:**
  1.  The user provides their LLM API keys via a dedicated settings UI. The UI sends a command to the backend to securely store these credentials.
  2.  The application's `Orchestrator Engine` initiates a request to the `ApiPoolManager` by passing it a `WorkOrder`.
  3.  The `ApiPoolManager` transparently handles the complex logic of selecting a key, making the API call, and managing any transient errors.
  4.  The user receives the AI-generated result, completely shielded from the underlying complexity of key rotation and failover.

- **Data Flow:**
  1.  The `Orchestrator Engine` creates a `WorkOrder` data object and passes it to the `ApiPoolManager.execute()` method.
  2.  The `ApiPoolManager` retrieves the full roster of stored `ApiKey` data objects from the `SecureStorageService`.
  3.  The `ApiPoolManager` selects a specific `ApiKey` based on its internal "key carousel" logic.
  4.  The `ApiPoolManager` instantiates the corresponding `Provider` module (e.g., `OpenAiProvider`) based on the selected key's `provider` metadata.
  5.  The `ApiPoolManager` delegates the call to the `OpenAiProvider`'s `generateCompletion` method, passing the `WorkOrder` and the key's `secret`.
  6.  The `OpenAiProvider` transforms the `WorkOrder` into a provider-specific HTTP request, makes the external network call, and parses the response.
  7.  The normalized `ApiResult` is returned to the `ApiPoolManager`.
  8.  The `ApiPoolManager` returns the `ApiResult` to the `Orchestrator Engine`.

- **Logic Flow (Failover-Driven Round-Robin):**
  1.  A request is received by the `ApiPoolManager`. It runs its stateful "key carousel" logic to select the next-best `ApiKey` from its pool, skipping any keys on cooldown.
  2.  It delegates the execution to the appropriate stateless `Provider` module (e.g., `OpenAiProvider`).
  3.  The `Provider` module executes the direct, provider-specific network call.
  4.  **If the call fails with a retryable error (e.g., 429):** The `ApiPoolManager` catches the error, places the failed key's ID on a cooldown map with a timestamp, advances its carousel, and **repeats the logic flow from step 1 with the next available key.**
  5.  **If the call fails with a non-retryable error (e.g., 401):** The `ApiPoolManager` immediately returns a failed `ApiResult`, terminating the loop.
  6.  **If the call succeeds:** The `ApiPoolManager` updates its internal state to remember the last successfully used key and returns the successful `ApiResult`.
  7.  If the loop completes without a single successful call, a final failed `ApiResult` is returned, indicating that all available keys are currently unavailable.

### **4. Overall Acceptance Criteria**

- A strict `IAiProvider` interface must exist, and all concrete provider modules (e.g., for OpenAI) must successfully implement it.
- The `ApiPoolManager` must successfully demonstrate round-robin key selection for consecutive successful requests.
- The `ApiPoolManager` must successfully demonstrate failover by automatically retrying a request with a second key when the first key's provider is mocked to return a rate-limit error. **(This fulfills V1 Success Criterion 5.4)**.
- API keys must be stored securely using the host's native `vscode.SecretStorage` API, accessed via the `SecureStorageService`.
- The final system must expose a single, simple entry point (`ApiPoolManager.execute`) to the rest of the application, successfully abstracting all internal complexity.