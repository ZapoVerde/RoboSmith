# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   The primary objective is to create a single, authoritative, and secure service dedicated to managing the lifecycle of sensitive user credentials, such as API keys. This approach is mandated by the core principles of security and separation of concerns, ensuring that the rest of the application is completely isolated from the underlying mechanics of secure storage.

### **1.1 Detailed Description**
*   This architecture establishes a dedicated service that acts as the sole custodian for all API key persistence. It will be implemented as a singleton wrapper around the host environment's native secret storage API (e.g., VS Code's `SecretStorage`). The service's exclusive responsibilities are the creation, retrieval, updating, and deletion (CRUD) of API key objects. It internally manages the necessary serialization of the entire key collection into a single, storable JSON string and the deserialization of that string back into structured, usable objects, thereby presenting a clean, object-oriented interface to the rest of the application while maintaining a simple, atomic storage footprint.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
    *   **No Secrets in Source Code:** This service is the direct implementation of the mandate that secrets must never be in source code and must be managed securely. [cite: docs/coding and troubleshooting/coding_standard.md]
    *   **Separation of Concerns:** The service has a single, well-defined responsibility: to act as a secure vault. It knows nothing of key rotation, API providers, or other business logic. [cite: docs/AI interface/spec.md]
    *   **Security & Authentication Context:** The service handles security-sensitive data and is therefore classified as "CRITICAL," mandating that it be rigorously tested. [cite: docs/coding and troubleshooting/testing_standard.md]
*   **Blueprint-Specific Principles:**
    *   **Exclusive Gateway:** This service **MUST** be the only component in the entire application that directly interacts with the host's secret storage API.
    *   **Perfect Abstraction:** The service **MUST** completely hide the implementation details of the underlying storage. Consumers of the service will interact with structured `ApiKey` objects and will have no knowledge of the internal JSON serialization format.
    *   **Logic Purity:** The service **MUST NOT** contain any business logic beyond the secure storage and retrieval of secrets.
    *   **Atomic Operations:** All write operations (add, update, delete) **MUST** be performed atomically by reading the entire collection, modifying it in memory, and writing the entire collection back.

### **3. Architectural Flows**
*   **User Flow:**
    1.  The user interacts with a dedicated settings UI to manage their API keys.
    2.  When the user adds, updates, or deletes a key, the UI component sends a command with the relevant data to the application's backend.
    3.  A backend controller (e.g., an event handler or state store action) receives this command.
    4.  This controller then invokes the appropriate method on the `SecureStorageService` to execute the persistence logic.
    5.  The user is completely shielded from the storage mechanism; their experience is confined to the UI.
*   **Data Flow:**
    1.  To store a key, a structured `ApiKey` object is passed to the `SecureStorageService`.
    2.  The service first retrieves the single, master JSON string representing all currently stored keys from the host's secure vault.
    3.  It deserializes this string into an in-memory collection of `ApiKey` objects.
    4.  The new or updated key is added to this collection.
    5.  The entire, modified collection is then serialized back into a single JSON string.
    6.  This new string completely overwrites the previous one in the secure vault under a single, constant identifier.
    7.  To retrieve keys, this flow is reversed: the master string is read, deserialized, and the resulting collection of `ApiKey` objects is returned to the caller.
*   **Logic Flow:**
    1.  A write request is received by the service. The service's logic dictates that it must first fetch the current, complete state of all stored keys.
    2.  It then logically modifies this complete, in-memory collection by adding, updating, or removing the target key. This ensures the integrity of the entire dataset.
    3.  The service's final logical step is to serialize the newly modified collection and write it back in a single, atomic operation, ensuring that the stored state is always consistent.
    4.  For a read request, the logic is to fetch the single stored artifact. If it exists and is valid, the logic is to parse and transform it into the required collection of structured objects. If it does not exist, the logic is to return a valid, empty collection, ensuring the caller always receives a predictable data type.

### **4. Overall Acceptance Criteria**
*   A new `ApiKey` object passed to the service must be successfully persisted and be present in subsequent retrievals.
*   Persisting an `ApiKey` with an ID that already exists must correctly overwrite the previous data for that ID.
*   Deleting an `ApiKey` by its ID must ensure it is absent from subsequent retrievals.
*   Attempting to retrieve keys when none have been stored must result in a valid, empty collection, not an error or null.
*   The service must successfully serialize the entire key collection into a single JSON string for storage and correctly deserialize it back into structured objects upon retrieval.
*   Unit tests must verify that the service correctly interacts with a mocked version of the host's secret storage API for all create, read, update, and delete operations.