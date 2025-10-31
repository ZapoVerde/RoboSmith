# **Blueprint (Finalized)**

### **1. File Manifest (Complete Scope)**
*   `packages/client/src/lib/ai/types.ts`
*   `packages/client/src/lib/ai/SecureStorageService.ts`
*   `packages/client/src/lib/ai/providers/IAiProvider.ts`
*   `packages/client/src/lib/ai/providers/OpenAiProvider.ts`
*   `packages/client/src/lib/ai/aiClient.ts`
*   `packages/client/src/lib/ai/ApiPoolManager.ts`
*   `packages/client/src/extension.ts`
*   `packages/client/src/features/settings/state/SettingsStore.ts`
*   `packages/client/src/events/handler.ts`
*   `src/shared/types.ts`
*   `webview-ui/src/components/ApiKeyManager.svelte`
*   `packages/client/src/lib/ai/SecureStorageService.spec.ts`
*   `packages/client/src/lib/ai/providers/OpenAiProvider.spec.ts`
*   `packages/client/src/lib/ai/aiClient.spec.ts`
*   `packages/client/src/lib/ai/ApiPoolManager.spec.ts`
*   `packages/client/src/extension.spec.ts`
*   `packages/client/src/features/settings/state/SettingsStore.spec.ts`
*   `packages/client/src/events/handler.spec.ts`
*   `webview-ui/src/components/ApiKeyManager.spec.ts`

### **2. Logical Change Summary (Complete)**

#### **Core Changes:**
*   **`packages/client/src/lib/ai/types.ts`**: This new file will be created to serve as the single source of truth for all data contracts within the AI Service Layer. It will define the `ApiKey`, `WorkOrder`, and `ApiResult` interfaces, ensuring a stable and unambiguous data model for all other components in this feature to consume.
*   **`packages/client/src/lib/ai/SecureStorageService.ts`**: This new file will be created to implement a secure wrapper around the host's native secret storage API. Its sole responsibility will be to manage the lifecycle (Create, Read, Update, Delete) of `ApiKey` objects, handling all necessary serialization and deserialization, and abstracting the underlying storage mechanism from the rest of the application.
*   **`packages/client/src/lib/ai/providers/IAiProvider.ts`**: This new file will define the strict `IAiProvider` interface, which acts as the formal contract for all provider-specific implementations. It will specify the required methods, such as `generateCompletion`, ensuring that all provider modules are interchangeable.
*   **`packages/client/src/lib/ai/providers/OpenAiProvider.ts`**: This new file will provide the concrete implementation for interacting with the OpenAI API. It will implement the `IAiProvider` interface and contain all the logic necessary to format an OpenAI-specific request, execute the network call, and parse the corresponding response into a standardized result.
*   **`packages/client/src/lib/ai/aiClient.ts`**: This new file will implement a stateless façade and factory. Its primary responsibility is to receive a request, inspect the provider specified in the configuration, and delegate the call to the appropriate concrete provider module.
*   **`packages/client/src/lib/ai/ApiPoolManager.ts`**: This new file will implement the core stateful orchestrator for the AI Service Layer. It will manage the pool of `ApiKey`s, execute the "key carousel" round-robin logic for load distribution, and handle the failover strategy for transient errors by delegating calls to the `aiClient` façade.
*   **`webview-ui/src/components/ApiKeyManager.svelte`**: This new UI component will be created to provide a user interface for managing API keys. It will handle local form state for adding, viewing, and deleting keys, and will communicate user actions to the backend via the event bus.

#### **Collateral (Fixing) Changes:**
*   **`packages/client/src/extension.ts`**: The `activate` function will be updated to instantiate the new singleton services (`SecureStorageService`, `ApiPoolManager`). It will then call the initialization method on the `ApiPoolManager` to load the stored keys and prepare the service for use.
*   **`packages/client/src/features/settings/state/SettingsStore.ts`**: The store will be updated to manage the state of the user's `AiConnection`s. New actions will be added to handle CRUD operations for API keys, which will delegate the actual persistence logic to the `SecureStorageService`.
*   **`packages/client/src/events/handler.ts`**: The central event handler will be updated to listen for new command types originating from the UI (e.g., `addApiKey`, `deleteApiKey`). It will route these commands to the appropriate new actions on the `SettingsStore`.
*   **`src/shared/types.ts`**: The shared message type definitions for the event bus will be updated. The discriminated union for the `command` property will be expanded to include the new commands for API key management, and the `payload` types will be defined to ensure type safety across the WebView-Extension Host boundary.

You are right to call that out. My previous response was incomplete. An "API" isn't just about state stores; every new file that exports a class, function, or interface is defining its public contract for the first time.

Thank you for the correction. Here is the completed and accurate API Delta Ledger for the entire scope of work.

### **3. API Delta Ledger (Complete)**

---
#### **New Core Files (Initial Public API)**

*   **File:** `packages/client/src/lib/ai/types.ts`
    *   **Symbol:** `ApiKey` (Interface)
    *   **Before:** None.
    *   **After:** `export interface ApiKey { id: string; secret: string; provider: 'openai' | 'google' | ...; }`
    *   **Symbol:** `WorkOrder` (Interface)
    *   **Before:** None.
    *   **After:** `export interface WorkOrder { model: string; prompt: string; ... }`
    *   **Symbol:** `ApiResult` (Interface)
    *   **Before:** None.
    *   **After:** `export interface ApiResult { success: boolean; content?: string; ... }`

*   **File:** `packages/client/src/lib/ai/SecureStorageService.ts`
    *   **Symbol:** `SecureStorageService` (Class)
    *   **Before:** None.
    *   **After:** `export class SecureStorageService { constructor(...); storeApiKey(...); getAllApiKeys(...); removeApiKey(...); }`

*   **File:** `packages/client/src/lib/ai/providers/IAiProvider.ts`
    *   **Symbol:** `IAiProvider` (Interface)
    *   **Before:** None.
    *   **After:** `export interface IAiProvider { generateCompletion(...); }`

*   **File:** `packages/client/src/lib/ai/providers/OpenAiProvider.ts`
    *   **Symbol:** `OpenAiProvider` (Class)
    *   **Before:** None.
    *   **After:** `export class OpenAiProvider implements IAiProvider { ... }`

*   **File:** `packages/client/src/lib/ai/aiClient.ts`
    *   **Symbol:** `aiClient` (Singleton Instance/Class)
    *   **Before:** None.
    *   **After:** `export const aiClient = { generateCompletion(...); }`

*   **File:** `packages/client/src/lib/ai/ApiPoolManager.ts`
    *   **Symbol:** `ApiPoolManager` (Class)
    *   **Before:** None.
    *   **After:** `export class ApiPoolManager { static getInstance(...); initialize(); execute(...); }`

*   **File:** `webview-ui/src/components/ApiKeyManager.svelte`
    *   **Symbol:** Component `props` and `events`
    *   **Before:** None.
    *   **After:** (Props) `keys: ApiKey[]`, (Events) `on:addKey`, `on:deleteKey`

---
#### **Modified Collateral Files (Changes to Existing API)**

*   **File:** `packages/client/src/features/settings/state/SettingsStore.ts`
    *   **Symbol:** `useSettingsStore` (State Slice)
    *   **Before:** (State shape without AI connection management)
    *   **After:** (State shape with new properties `aiConnections: ApiKey[]` and new actions `addApiKey`, `removeApiKey`, `loadApiKeys`)

*   **File:** `src/shared/types.ts`
    *   **Symbol:** `Message['command']` (Discriminated Union Type)
    *   **Before:** `'[existing commands]'`
    *   **After:** `'[existing commands]' | 'addApiKey' | 'removeApiKey' | 'loadApiKeys'`


    ---

    # **Implementation Plan (Finalized)**

### Phase 1: Establish Foundational Contracts & Secure Storage

#### Task 1.1: `packages/client/src/lib/ai/types.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Domain Model Definition)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/types.ts
     * @architectural-role Type Definition
     * @description Defines the canonical, shared data contracts for the entire AI Service Layer. This file ensures type safety and a stable, unambiguous interface between all components of the service.
     * @core-principles
     * 1. IS the single source of truth for the AI service's data shapes.
     * 2. MUST contain only pure TypeScript type/interface definitions.
     * 3. MUST NOT contain any executable code or business logic.
     */
    ```

#### Task 1.2: `packages/client/src/lib/ai/SecureStorageService.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Security & Authentication Context, I/O & Concurrency Management)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/SecureStorageService.ts
     * @architectural-role Configuration
     * @description Implements a secure wrapper around the VS Code SecretStorage API. It is the single, authoritative module for persisting and retrieving sensitive `ApiKey` data.
     * @core-principles
     * 1. IS the exclusive gateway for all `ApiKey` persistence operations.
     * 2. MUST abstract the underlying `vscode.SecretStorage` API from the rest of the application.
     * 3. MUST NOT contain any business logic beyond the secure storage and retrieval of secrets.
     */
    ```

#### Task 1.3: `packages/client/src/lib/ai/SecureStorageService.spec.ts` (Verification)
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
    ```---
### Phase 2: Implement Provider Pattern & Façade

#### Task 2.1: `packages/client/src/lib/ai/providers/IAiProvider.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Domain Model Definition)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/providers/IAiProvider.ts
     * @architectural-role Type Definition
     * @description Defines the `IAiProvider` interface, which serves as the strict contract for all external AI provider implementations.
     * @core-principles
     * 1. IS the single source of truth for the provider contract.
     * 2. ENFORCES interchangeability between different provider implementations (e.g., OpenAI, Google).
     * 3. MUST NOT contain any executable code or concrete implementations.
     */
    ```

#### Task 2.2: `packages/client/src/lib/ai/providers/OpenAiProvider.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: I/O & Concurrency Management)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/providers/OpenAiProvider.ts
     * @architectural-role Business Logic
     * @description A concrete implementation of the `IAiProvider` interface for the OpenAI API. It encapsulates all logic required to format requests, execute network calls, and parse responses specific to OpenAI.
     * @core-principles
     * 1. MUST strictly implement the `IAiProvider` interface.
     * 2. OWNS all provider-specific logic for the OpenAI API.
     * 3. MUST be stateless and receive all required configuration for each call.
     */
    ```

#### Task 2.3: `packages/client/src/lib/ai/providers/OpenAiProvider.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/providers/OpenAiProvider.spec.ts
     * @test-target packages/client/src/lib/ai/providers/OpenAiProvider.ts
     * @description Verifies the OpenAiProvider, ensuring it correctly formats outgoing requests and parses incoming responses based on a mocked network layer.
     * @criticality The test target is CRITICAL as it manages external I/O.
     * @testing-layer Unit
     */
    ```

#### Task 2.4: `packages/client/src/lib/ai/aiClient.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/aiClient.ts
     * @architectural-role Orchestrator
     * @description Implements a stateless façade that acts as a factory for AI providers. It selects and delegates calls to the appropriate concrete provider based on the request's configuration.
     * @core-principles
     * 1. IS a stateless façade; it does not hold or manage any long-lived state.
     * 2. OWNS the logic for selecting the correct provider for a given request.
     * 3. DELEGATES all actual network I/O to the concrete provider implementations.
     */
    ```

#### Task 2.5: `packages/client/src/lib/ai/aiClient.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/aiClient.spec.ts
     * @test-target packages/client/src/lib/ai/aiClient.ts
     * @description Verifies the aiClient façade, ensuring it correctly instantiates and delegates calls to the appropriate mocked provider based on the input configuration.
     * @criticality The test target is CRITICAL as it contains core business logic.
     * @testing-layer Unit
     */
    ```
---
### Phase 3: Construct the Core Orchestrator

#### Task 3.1: `packages/client/src/lib/ai/ApiPoolManager.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: State Store Ownership, Core Business Logic Orchestration)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/ApiPoolManager.ts
     * @architectural-role Orchestrator
     * @description Implements the core stateful orchestrator for the AI Service Layer. It manages the pool of `ApiKey`s, executes the "key carousel" logic, and handles failover.
     * @core-principles
     * 1. IS the single, stateful entry point for all AI requests from the application.
     * 2. OWNS the key pool, the round-robin state, and the failover logic.
     * 3. DELEGATES all actual network I/O to the stateless `aiClient` façade.
     */
    ```

#### Task 3.2: `packages/client/src/lib/ai/ApiPoolManager.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/lib/ai/ApiPoolManager.spec.ts
     * @test-target packages/client/src/lib/ai/ApiPoolManager.ts
     * @description Verifies the ApiPoolManager's orchestration logic, including the key carousel (round-robin) and failover mechanisms, using a mocked aiClient.
     * @criticality The test target is CRITICAL as it orchestrates core business logic and manages state.
     * @testing-layer Unit
     */
    ```
---
### Phase 4: Integrate Service Layer into the Application Backend

#### Task 4.1: `src/shared/types.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: Core Domain Model Definition)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file src/shared/types.ts
     * @architectural-role Type Definition
     * @description Defines the shared message interface for the asynchronous event bus, ensuring type safety between the WebView (frontend) and the Extension Host (backend).
     * @core-principles
     * 1. IS the single source of truth for the event bus message contract.
     * 2. MUST contain only pure TypeScript type/interface definitions.
     */
    ```

#### Task 4.2: `packages/client/src/features/settings/state/SettingsStore.ts` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: State Store Ownership)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/features/settings/state/SettingsStore.ts
     * @architectural-role State Management
     * @description Defines the central Zustand store for user settings. This version is updated to include state and actions for managing the user's collection of `AiConnection`s.
     * @core-principles
     * 1. IS the single source of truth for all user settings state.
     * 2. ORCHESTRATES persistence by delegating to repository services.
     * 3. MUST provide actions for CRUD operations on AI connections.
     */
    ```

#### Task 4.3: `packages/client/src/features/settings/state/SettingsStore.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/features/settings/state/SettingsStore.spec.ts
     * @test-target packages/client/src/features/settings/state/SettingsStore.ts
     * @description Verifies the new actions and state slices in the SettingsStore related to managing AI connections, ensuring state is updated correctly.
     * @criticality The test target is CRITICAL as it is a central state store.
     * @testing-layer Unit
     */
    ```

#### Task 4.4: `packages/client/src/events/handler.ts` (Source)
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

#### Task 4.5: `packages/client/src/events/handler.spec.ts` (Verification)
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

#### Task 4.6: `packages/client/src/extension.ts` (Source)
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

#### Task 4.7: `packages/client/src/extension.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file packages/client/src/extension.spec.ts
     * @test-target packages/client/src/extension.ts
     * @description Verifies the extension's activation logic, ensuring that new services like the ApiPoolManager are correctly instantiated and initialized.
     * @criticality The test target is CRITICAL as it is the application's entry point.
     * @testing-layer Integration
     */
    ```
---
### Phase 5: Implement the User-Facing Management UI

#### Task 5.1: `webview-ui/src/components/ApiKeyManager.svelte` (Source)
*   **6-Point Rubric Assessment:** Critical (Reason: I/O & Concurrency Management - it manages cross-thread communication)
*   **Validation Tier:** Tier 2: Required by Planner
*   **Preamble:**
    ```html
    <!--
     * @file webview-ui/src/components/ApiKeyManager.svelte
     * @architectural-role UI Component
     * @description Provides the user interface for managing `ApiKey` objects. It handles local form state for adding/editing keys and communicates with the backend via the event bus.
     * @core-principles
     * 1. IS the single source of truth for the API key management UI.
     * 2. OWNS local UI state (e.g., form inputs, modal visibility).
     * 3. DELEGATES all persistence and business logic to the backend via asynchronous events.
    -->
    ```

#### Task 5.2: `webview-ui/src/components/ApiKeyManager.spec.ts` (Verification)
*   **6-Point Rubric Assessment:** Not Applicable
*   **Validation Tier:** Tier 1: Human Review
*   **Preamble:**
    ```typescript
    /**
     * @file webview-ui/src/components/ApiKeyManager.spec.ts
     * @test-target webview-ui/src/components/ApiKeyManager.svelte
     * @description Verifies the ApiKeyManager component's behavior, including rendering the list of keys, handling user input, and correctly dispatching events to the mocked event bus.
     * @criticality The test target is CRITICAL as it handles user interaction for a core feature.
     * @testing-layer Integration
     */
    ```