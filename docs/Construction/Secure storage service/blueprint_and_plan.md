# **Blueprint (Finalized)**

### **1. File Manifest (Complete Scope)**
*   `packages/shared/src/domain/api-key.ts`
*   `packages/client/src/lib/ai/SecureStorageService.ts`
*   `packages/client/src/extension.ts`
*   `packages/client/src/features/settings/state/SettingsStore.ts`
*   `packages/client/src/events/handler.ts`
*   `packages/client/src/shared/types.ts`
*   `webview-ui/src/components/ApiKeyManager.svelte`
*   `webview-ui/src/components/ApiKeyManager.logic.ts`
*   `packages/client/src/lib/ai/SecureStorageService.spec.ts`
*   `packages/client/src/extension.spec.ts`
*   `packages/client/src/features/settings/state/SettingsStore.spec.ts`
*   `packages/client/src/events/handler.spec.ts`
*   `webview-ui/src/components/ApiKeyManager.logic.spec.ts`

### **2. Logical Change Summary (Complete)**

#### **Core Changes:**
*   **`packages/shared/src/domain/api-key.ts`**: This new file will be created to define the canonical, application-wide `ApiKey` interface. It will be the single source of truth for this core domain model, ensuring type safety across all packages.
*   **`packages/client/src/lib/ai/SecureStorageService.ts`**: This new file will be created to implement a secure wrapper around the host's native secret storage API. Its sole responsibility will be to manage the lifecycle (Create, Read, Update, Delete) of `ApiKey` objects, handling all necessary serialization and deserialization.

#### **Collateral (Fixing) Changes:**
*   **`packages/client/src/extension.ts`**: The `activate` function will be updated to instantiate the new singleton `SecureStorageService`. This instance will then be passed into a new `EventHandlerContext` object to make it available to the event handling layer.
*   **`packages/client/src/features/settings/state/SettingsStore.ts`**: The store will be updated to manage the state of the user's `aiConnections`. New actions (`loadApiKeys`, `addApiKey`, `removeApiKey`) will be added, which will delegate all persistence logic to the `SecureStorageService`.
*   **`packages/client/src/events/handler.ts`**: The central event handler will be updated to listen for new command types originating from the UI (e.g., `addApiKey`, `deleteApiKey`). It will route these commands to the appropriate new actions on the `SettingsStore`, passing along the `SecureStorageService` instance from its context.
*   **`packages/client/src/shared/types.ts`**: The shared message type definitions for the event bus will be updated. The discriminated union for the `command` property will be expanded to include the new commands for API key management, and the `payload` types will be defined to ensure type safety.
*   **`webview-ui/src/components/ApiKeyManager.svelte`**: This new UI component will be created to provide a user interface for managing API keys. It will handle local form state and delegate all user actions to its headless logic module.
*   **`webview-ui/src/components/ApiKeyManager.logic.ts`**: This new headless logic file will be created to contain all the business logic for the `ApiKeyManager` component. It will handle form validation and the creation of the event payloads to be dispatched to the backend, ensuring the component is testable in isolation.

### **3. API Delta Ledger (Complete)**

---

#### **New Core & Collateral Files (Initial Public API)**

*   **File:** `packages/shared/src/domain/api-key.ts`
    *   **Symbol:** `ApiKey` (Interface)
    *   **Before:** None.
    *   **After:** `export interface ApiKey { id: string; secret: string; provider: 'openai' | 'google' | 'anthropic'; }`
*   **File:** `packages/client/src/lib/ai/SecureStorageService.ts`
    *   **Symbol:** `SecureStorageService` (Class)
    *   **Before:** None.
    *   **After:** `export class SecureStorageService { constructor(...); storeApiKey(...); getAllApiKeys(...); removeApiKey(...); }`
*   **File:** `webview-ui/src/components/ApiKeyManager.svelte`
    *   **Symbol:** Component `props` and `events`
    *   **Before:** None.
    *   **After:** (Props) `keys: ApiKey[]`, (Events) `on:addKey`, `on:deleteKey`
*   **File:** `webview-ui/src/components/ApiKeyManager.logic.ts`
    *   **Symbol:** `handleAddKey`, `handleDeleteKey` (Functions)
    *   **Before:** None.
    *   **After:** `export function handleAddKey(...); export function handleDeleteKey(...);`

---

#### **Modified Collateral Files (Changes to Existing API)**

*   **File:** `packages/client/src/features/settings/state/SettingsStore.ts`
    *   **Symbol:** `SettingsStore` (Type)
    *   **Before:** (State shape without AI connection management)
    *   **After:** (State shape with new properties `aiConnections: ApiKey[]` and new actions `addApiKey`, `removeApiKey`, `loadApiKeys`)
*   **File:** `packages/client/src/shared/types.ts`
    *   **Symbol:** `Message['command']` (Discriminated Union Type)
    *   **Before:** `'[existing commands]'`
    *   **After:** `'[existing commands]' | 'addApiKey' | 'removeApiKey' | 'loadApiKeys'`
*   **File:** `packages/client/src/events/handler.ts`
    *   **Symbol:** `handleEvent` (Function)
    *   **Before:** `(message: Message): Promise<void>`
    *   **After:** `(message: Message, context: EventHandlerContext): Promise<void>`

    ---

# Implementation Plan (Finalized)

### Phase 1: Establish the Core Domain Model

#### Task 1.1: `packages/shared/src/domain/api-key.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Domain Model Definition)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/shared/src/domain/api-key.ts
     * @architectural-role Type Definition
     * @description Defines the canonical, shared data contract for a user's API key. This is a core domain model for the entire application, intended for use across all packages.
     * @core-principles
     * 1. IS the single source of truth for the ApiKey data shape.
     * 2. MUST be platform-agnostic and have no external dependencies.
     * 3. MUST contain only pure TypeScript type/interface definitions.
     */
    ```

---
### Phase 2: Implement and Verify the Secure Storage Service

#### Task 2.1: `packages/client/src/lib/ai/SecureStorageService.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Security & Authentication Context, I/O & Concurrency Management)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/SecureStorageService.ts
     * @architectural-role Data Repository
     * @description Implements a secure wrapper around the VS Code SecretStorage API. It is the single, authoritative module for persisting and retrieving sensitive `ApiKey` data.
     * @core-principles
     * 1. IS the exclusive gateway for all `ApiKey` persistence operations.
     * 2. MUST abstract the underlying `vscode.SecretStorage` API from the rest of the application.
     * 3. MUST NOT contain any business logic beyond the secure storage and retrieval of secrets.
     */
    ```

#### Task 2.2: `packages/client/src/lib/ai/SecureStorageService.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/SecureStorageService.spec.ts
     * @test-target packages/client/src/lib/ai/SecureStorageService.ts
     * @description Verifies the contract of the SecureStorageService, ensuring it correctly interacts with a mocked VS Code SecretStorage API to store, retrieve, and delete `ApiKey` objects.
     * @criticality The test target is CRITICAL as it handles security-sensitive data.
     * @testing-layer Unit
     */
    ```

---
### Phase 3: Integrate Secure Storage into the Application Backend

#### Task 3.1: `packages/client/src/features/settings/state/SettingsStore.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: State Store Ownership)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/features/settings/state/SettingsStore.ts
     * @architectural-role State Management
     * @description Defines the central Zustand store for user settings using the vanilla, framework-agnostic core. This ensures it is testable in a Node.js environment and has no dependency on React.
     * @core-principles
     * 1. IS the single, authoritative source of truth for user settings state.
     * 2. ORCHESTRATES persistence by delegating to repository services like SecureStorageService.
     * 3. MUST import from 'zustand/vanilla' to remain framework-agnostic.
     */
    ```

#### Task 3.2: `packages/client/src/features/settings/state/SettingsStore.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/features/settings/state/SettingsStore.spec.ts
     * @test-target packages/client/src/features/settings/state/SettingsStore.ts
     * @description Verifies the new actions and state slices in the SettingsStore related to managing AI connections, ensuring state is updated correctly and persistence is delegated.
     * @criticality The test target is CRITICAL as it is a central state store.
     * @testing-layer Unit
     */
    ```

#### Task 3.3: `packages/client/src/shared/types.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Domain Model Definition)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/shared/types.ts
     * @architectural-role Type Definition
     * @description Defines the shared message interface for the asynchronous event bus, ensuring type safety between the WebView (frontend) and the Extension Host (backend).
     * @core-principles
     * 1. IS the single source of truth for the client's event bus message contract.
     * 2. MUST contain only pure TypeScript type/interface definitions.
     */
    ```

#### Task 3.4: `packages/client/src/events/handler.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/events/handler.ts
     * @architectural-role Orchestrator
     * @description The central event handler that routes incoming messages from the event bus to the appropriate backend services or state stores. It will be updated to handle new commands for API key management.
     * @core-principles
     * 1. IS the single entry point for all commands from the UI layer.
     * 2. MUST delegate all business logic to the appropriate service or store.
     * 3. MUST NOT contain any business logic itself.
     */
    ```

#### Task 3.5: `packages/client/src/events/handler.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/events/handler.spec.ts
     * @test-target packages/client/src/events/handler.ts
     * @description Verifies that the event handler correctly routes new API key management commands to the appropriate mocked store actions.
     * @criticality The test target is CRITICAL as it is a core orchestrator.
     * @testing-layer Unit
     */
    ```

#### Task 3.6: `packages/client/src/extension.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/extension.ts
     * @architectural-role Feature Entry Point
     * @description The main activation entry point for the VS Code extension. It is responsible for initializing all singleton services and setting up the application's composition root.
     * @core-principles
     * 1. IS the composition root for the entire backend application.
     * 2. OWNS the initialization and lifecycle of all singleton services.
     * 3. DELEGATES all ongoing work to other services after initialization.
     */
    ```

#### Task 3.7: `packages/client/src/extension.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/extension.spec.ts
     * @test-target packages/client/src/extension.ts
     * @description Verifies the extension's activation logic, ensuring that new services like the SecureStorageService are correctly instantiated and initialized.
     * @criticality The test target is CRITICAL as it is the application's entry point.
     * @testing-layer Integration
     */
    ```

---
### Phase 4: Implement and Verify the User-Facing Management UI

#### Task 4.1: `webview-ui/src/components/ApiKeyManager.logic.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file webview-ui/src/components/ApiKeyManager.logic.ts
     * @architectural-role Business Logic
     * @description Headless logic for the ApiKeyManager component. Isolates event dispatching and form handling from the Svelte UI, making it independently testable and compliant with the project's testing standard.
     * @core-principles
     * 1. IS the single source of truth for the ApiKeyManager's behavior.
     * 2. OWNS the logic for validating form inputs and creating event payloads.
     * 3. MUST be pure TypeScript with no dependencies on Svelte or the DOM.
     */
    ```

#### Task 4.2: `webview-ui/src/components/ApiKeyManager.logic.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file webview-ui/src/components/ApiKeyManager.logic.spec.ts
     * @test-target webview-ui/src/components/ApiKeyManager.logic.ts
     * @description Verifies the contract of the headless `ApiKeyManager.logic` module. It ensures the module correctly validates form inputs and creates the appropriate event payloads for dispatching.
     * @criticality The test target is CRITICAL as it contains core business logic.
     * @testing-layer Unit
     */
    ```

#### Task 4.3: `webview-ui/src/components/ApiKeyManager.svelte` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: I/O & Concurrency Management - it manages cross-thread communication)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```html
    <!--
     * @file webview-ui/src/components/ApiKeyManager.svelte
     * @architectural-role UI Component
     * @description Provides the user interface for managing `ApiKey` objects. It is a purely presentational component that delegates all business logic to its headless `.logic.ts` counterpart.
     * @core-principles
     * 1. IS a purely presentational component.
     * 2. OWNS local UI state (e.g., form inputs).
     * 3. DELEGATES all business logic to the imported logic module via events.
    -->
    