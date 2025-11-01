---

# **The AiAnvil Project: Coding Standard**

**Document-Type:** Engineering Standard & Style Guide

### **1. Authority & Philosophy**
This document defines the shared standards for code quality, style, and architectural clarity across the AiAnvil project. It exists to ensure that all contributors — human or AI — work from a common foundation of structure, intent, and maintainability.

---

### **PART I: FILE-CENTRIC STANDARDS**

_(This section governs the internal quality, structure, and documentation of individual files.)_

### **2. The Preamble Standard: The Source of Truth**

Every `.ts` and `.tsx` file begins with a structured preamble block that defines the file’s architectural role, purpose, and behavioral guarantees. The format of this preamble is fixed and must not be altered. It exists to support automated auditing, architectural clarity, and AI comprehension.

The content of each preamble is a live declaration of the file’s current intent. It must reflect the file’s actual responsibilities and constraints — not boilerplate or legacy assumptions. A well-maintained preamble ensures that each file remains single-purpose, tightly scoped, and aligned with the system’s design. Specific formats for source files, test files, and type definitions are defined in the following sections

#### **2.2 The Three Preamble Types**

There are three distinct preamble structures: one for **Source Files**, one for **Test Files**, and one for **Type Definitions**. Each has its own dedicated standard (Section 3, 4, and 5 respectively).

---

### **3. Preamble Standard for Source Files**

#### **3.1 Core Fields (Mandatory)**

- `@file`: The full, absolute path to the file (auto-managed).
- `@stamp`: A JSON object with the ISO 8601 UTC timestamp of the file's last modification.
- `@architectural-role`: A clear declaration of the file's primary responsibility. **MUST** be one of the roles defined in the Canonical Preamble Schema (Section 6).
- `@description`: A concise summary of the file's purpose.
- `@core-principles`: A bulleted list of 1-3 high-level architectural principles that are most directly embodied or enforced by this file's design. These principles (from `Horizontal Principles` or `Vertical Domains`) provide explicit architectural justification for the file's existence and structure. Each principle **MUST** start with one of the following declarative phrases:
- **Identity:** IS, IS NOT
- **Responsibility:** OWNS, DELEGATES, ORCHESTRATES
- **Constraints:** MUST, MUST NOT, ENFORCES
  - **Example:**
    ```typescript
    /**
     * @file src/packages/client/src/App.tsx
     * @description This is the top-level React component for the application.
     * @core-principles
     * 1. IS the composition root for the entire React application.
     * 2. MUST orchestrate application-level initializations.
     * 3. IS NOT responsible for direct business logic for features.
     * 4. DELEGATES all UI rendering to its children.
     * 5. OWNS the initialization and lifecycle of global providers.
     */
    ```

**Rationale for the Phrases:**

- **`IS` / `IS NOT`**: Defines identity and scope.
- **`MUST` / `MUST NOT`**: Establishes strict rules and boundaries.
- **`OWNS` / `DELEGATES`**: Clarifies responsibility and separation of concerns.
- **`ORCHESTRATES` / `SERVES AS` / `ENFORCES`**: Describes active roles and architectural functions.

These phrases provide a powerful, standardized vocabulary for encoding precise architectural intent directly within the `@core-principles` list. This will be exceptionally effective for AI comprehension and for maintaining structural integrity.

#### **3.2 The Auditable Contract System (Mandatory)**

- `@api-declaration`: A manifest of the file's public API.
- `@contract`: A set of machine-readable assertions about the file's internal behavior. All assertions **MUST** conform to the Canonical Preamble Schema (Section 6).
  - **Format:** `key: value # narrative`
  - **Example:**
    ```
    @contract
      assertions:
        purity: pure # This file MUST be a pure, stateless "accountant."
        external_io: none # It is architecturally forbidden from performing any I/O.
    ```

---

### **4. Preamble Standard for Test Files**

This standard applies to all test files (`.spec.ts`, `.test.ts`). The preamble acts as a formal "Test Plan."

#### **4.1 Core Fields (Mandatory)**

- `@file`: The full, absolute path to the test file (auto-managed).
- `@stamp`: The JSON timestamp of the test file's last modification.
- `@test-target`: The absolute path to the source file being tested.

#### **4.2 Strategic Assessment Fields (Mandatory)**

- `@description`: A concise summary of the scope and purpose of the test suite.
- `@criticality`: An explicit declaration of the test target's criticality. If critical, it **MUST** list the reasons from the 6-Point Rubric in section 10.6.
- `@testing-layer`: The primary layer of the Testing Pyramid this test suite operates at. **MUST** be one of `Unit`, `Integration`, or `E2E`.

#### **4.3 Contractual Field (Mandatory)**

- `@contract`: A set of machine-readable assertions about the test file's **own behavior**, which is audited to enforce good testing practices. Assertions **MUST** conform to the Canonical Preamble Schema (Section 6).

---

### **5. The Type Definition JSDoc Standard**

This standard applies to all exported `interface`, `type`, and `enum` declarations.

- **5.1 Mandatory JSDoc Comments:** Every exported `interface`, `type`, or `enum` definition **MUST** be immediately preceded by a comprehensive JSDoc-style comment block (`/** ... */`).
- **5.2 Canonical Identifier:** The JSDoc block **MUST** include a single, combined identifier for the type and its file path using the `@id` tag. This facilitates programmatic scraping and unambiguous referencing.
  - **Format:** `@id <full/path/to/file.ts>#<TypeName>`
  - **Example:** `@id src/features/game/logic/turn/types.ts#TurnContextPayload`
- **5.3 Purpose Description:** The JSDoc block **MUST** include a concise `@description` tag. This tag **MUST** describe the type's overall purpose, its architectural significance, and its high-level invariants.
  - **Content Focus:** _How_ this type serves the system, _what problem it solves_, and _what core architectural ideas it embodies_.
- **5.4 Field-Level Detail:**
  - For `interface` and object `type` aliases, **every single property** **MUST** have an individual JSDoc comment explaining its purpose, expected values, and any critical relationships or constraints with other fields.
  - For `enum` members, **every single member** **MUST** have an individual JSDoc comment explaining its meaning and use case.

- **Example (for `TurnContextPayload`):**
  ```typescript
  /**
   * @id src/features/game/logic/turn/types.ts#TurnContextPayload
   * @description
   * The AI-agnostic, replayable "what" of a turn. This interface aggregates all
   * game state and user preferences required by AI helpers, ensuring they operate
   * with full historical context without needing to perform I/O or access
   * sensitive data. It embodies the principle of Decoupled Context.
   */
  export interface TurnContextPayload {
    /**
     * The full, immutable game shell from which the current game session was initialized.
     * Provides the AI's core persona, custom instructions, and world definitions.
     */
    shell: Shell;
    /**
     * The current sequential number of the turn being processed (e.g., 1 for the first action).
     * Used for correlating events and for AI's temporal awareness.
     */
    turnNumber: number;
    // ... other fields with their own detailed comments ...
  }
  ```

---

### **6. Canonical Preamble Schema**

To ensure consistency and enable automated auditing, the following fields **MUST** use a value from the enumerated list.

- **`@architectural-role` Values:**
  - `State Management`, `UI Component`, `Business Logic`, `Data Repository`, `Configuration`, `Utility`, `Orchestrator`, `Feature Entry Point`,`Type Definition`
- **`@contract` Assertion Keys & Values:**
  - `purity`: `pure` | `read-only` | `mutates`
  - `state_ownership`: `[<list of state slices>]` | `none`
  - `external_io`: `none` | `firestore` | `https_apis`

---

### **7. Architectural Integrity (Enforcement)**

The logic implemented within a file **MUST** strictly adhere to the API signatures defined in its `@api-declaration` (for source files) and the behavioral rules defined in its `@contract` (for all files).

---

### **PART II: PROCESS-CENTRIC STANDARDS**

_(This section governs the project-wide processes and qualitative rules that ensure a closed, reliable system.)_

### **8. Language & Tooling Standard**

#### **8.1 TypeScript Strictness**

This project operates in **TypeScript's strictest mode.** Non-compliance is a build failure.

- The use of `any` is forbidden.
- The use of non-null assertions (`!`) is forbidden.
- Unsafe `as` type casts are forbidden, except for well-documented type guards which **MUST** be accompanied by a `// TYPE-GUARD-REASON: [Justification]` comment on the preceding line.

#### **8.1.1 The Principle of Explicit Type Imports**

To ensure architectural consistency with the project's strict module settings (`verbatimModuleSyntax`), reliance on "ambient" or "global" type declarations is **forbidden**. All types, including those from testing libraries like Vitest, **MUST** be explicitly imported into the file where they are used.

This practice makes each file a self-contained module whose dependencies are clearly declared, preventing subtle configuration conflicts and improving IDE reliability.

**FORBIDDEN ANTI-PATTERN (Relies on a global `vi` namespace):**

```typescript
// This code is incorrect because it assumes `vi` exists as a global type namespace.
// It will fail in a strict module environment.
let myMock: vi.Mock;
let myMockedHelper: vi.Mocked<Helper>;
```

**CORRECT AND MANDATORY PATTERN (Uses explicit type-only imports):**

```typescript
// This is the only acceptable pattern. It explicitly imports the required types.
import type { Mock, Mocked } from 'vitest';
import type { Helper } from './Helper';

let myMock: Mock;
let myMockedHelper: Mocked<Helper>;
```

#### **8.2 Linter & Formatter Enforcement**

**ESLint and Prettier are the arbiters of style.** All code **MUST** be free of linting errors and formatted according to the project's Prettier configuration before it can be committed. The CI/CD pipeline will reject any code that is not clean.

#### **8.3 Granular State Selection**

Selectors must return primitives or shallow-comparable slices. Selecting entire objects (e.g., useStore(state => state)) is forbidden.

**FORBIDDEN ANTI-PATTERN:**

```typescript
// This will be rejected.
const { title, tags } = useShellStore();
const entireStore = useShellStore();
```

**CORRECT AND MANDATORY PATTERN:**

```typescript
// This is the only acceptable pattern.
const title = useShellStore((state) => state.title);
const tags = useShellStore((state) => state.tags);
```

#### **8.4 Modernity & Due Diligence**

The AI's tendency to suggest outdated patterns must be actively counteracted.

- **Dependency Verification:** New third-party dependencies **MUST** be verified as modern, maintained, and secure.
- **Modern Pattern Preference:** **MUST** prefer modern, idiomatic APIs and patterns (e.g., `async/await`, functional array methods) over legacy approaches.

---

### **9. The Testing Standard: Pragmatic Contract-Driven Testing (P-CDT)**

Covered separately in The Definitive AiAnvil Testing Standard.

---

### **10. Logging Standard**

#### **10.1 The Philosophy of Intentional Logging: Signal, Not Noise**

Logging is an intentional act of creating a permanent record of a significant event. It is not a temporary tool for debugging. The primary goal of our logging standard is to produce a **sparse, high-signal log stream** that is valuable for understanding the application's behavior in production, not a verbose, noisy stream for real-time debugging.

Every log entry must have a clear and justifiable purpose. If a log does not serve to illuminate a critical state transition, a significant event, or an error, it is considered noise and must be removed.

#### **10.2 The Mandate of "Just Enough": What We MUST Log (The Signal)**

To be considered "just enough," logging **MUST** be focused on the following categories of events. These are the architectural moments that have a high signal value.

- **1. Application Lifecycle Events:** Key moments in the application's startup and shutdown sequences.
  - **Example:** `logger.info('Application hydrated and ready.')`

- **2. Significant User-Initiated Actions:** The start of any major, multi-step user workflow.
  - **Example:** `logger.info('New game session started', { shellId })`, `logger.info('User initiated shell publication', { shellId })`

- **3. Key System-Driven Events:** Important background processes or state transitions that are not directly initiated by the user in a single click.
  - **Example:** `logger.info('Cross-device session sync started')`, `logger.warn('AI connection failed over to fallback model')`

- **4. Handled Errors and Unexpected States:** Any `catch` block that handles an error gracefully **MUST** log the error to provide a record of the failure.
  - **Example:** `logger.error('Failed to parse AI response stream', { error, turnNumber })`

#### **10.3 What We MUST NOT Log (The Noise)**

To maintain a high signal-to-noise ratio, logging in the following contexts is **forbidden.** This is a linting error and will fail the CI build.

- **1. High-Frequency Operations:** Logging inside loops (`for`, `while`, `.map`, `.forEach`), frequently called utility functions, or continuous event handlers (`onMouseMove`, `onScroll`) is forbidden.

- **2. Transient or Trivial State:** Do not log component re-renders, the state of UI elements (e.g., a button's hover state), or any other ephemeral, low-impact state change.

- **3. Personally Identifiable Information (PII) or Secrets:** Logging user emails, API keys, or any other sensitive data is forbidden.

- **4. Simple Function Entry/Exit:** So-called "trace" or "printf debugging" logs (e.g., `logger.log('entering processTurn function')`) **MUST** be removed before a commit. Use your interactive debugger for this, not the permanent log.

#### **10.4 The Mandate of Structured Context**

To ensure logs are machine-parsable and maximally useful, every log entry **MUST** consist of two parts: a static, human-readable message and a dynamic, structured context object.

**FORBIDDEN ANTI-PATTERN:**

```typescript
// This will be rejected. It is not structured.
logger.log('Player ID: ' + playerId + ' is taking turn number: ' + turnNumber);
```

**CORRECT AND MANDATORY PATTERN:**

```typescript
// The message is a static string. The dynamic data is in the context object.
logger.info('Player turn initiated', {
  sessionId: 'xyz-123',
  turnNumber: 42,
  playerId: 'abc-789',
});
```

#### **10.5 Logging Levels (Mandatory)**

You **MUST** use the appropriate logging level for the message's intent.

- `logger.log()`: **FORBIDDEN IN COMMITTED CODE.** Use only for temporary, local debugging.
- `logger.info()`: For the significant events defined in Section 10.2.
- `logger.warn()`: For non-critical issues that do not stop an operation but should be noted.
- `logger.error()`: For critical, handled errors.

---

### **11. Security & Data Integrity**

#### **11.1 No Secrets in Source Code**

API keys, passwords, or other secrets **MUST NEVER** be committed to the source repository. All secrets must be managed via environment variables, with a checked-in `.env.example` file to document required variables.

#### **11.2 Input Validation**

All external and user-generated input is **untrusted by default.** It **MUST** be sanitized and validated before being used in the application's business logic.

### **12. Error Handling Strategy**

#### **12.1 Philosophy: Fail Fast for Bugs, Handle Gracefully for Users**

Our error handling strategy is determined by the predictability of the failure. The goal is to make programmer errors loud and unmissable, while shielding the user from expected external failures.

### **13. Naming & Architectural Pattern Standard**

#### **13.1 Philosophy: A Cohesive, Predictable, and Scalable Architecture**

This standard defines the complete set of rules for the physical and logical organization of the codebase. Its purpose is to create a system that is predictable, self-documenting, and easy to navigate for both human and AI developers. It achieves this by enforcing a strict, monorepo-aware, feature-driven architecture combined with a granular, role-based naming convention.

---

### **Part A: Physical Architecture - The "Where"**

_(This part governs the structure of packages, directories, and files.)_

#### **13.2 The Monorepo Package Standard (`packages/*`)**

The `packages/` directory is the highest level of architectural organization. Each package **MUST** have a clearly defined role and strict dependency boundaries.

- `packages/client/`: Contains the entire front-end React application, with its source code residing in `src/`.
- `packages/shared/`: **(The Core Domain & Platform-Agnostic Logic)**
  - **Purpose:** To define the canonical, application-wide **domain models** (`Chip.ts`, `Shell.ts`) and foundational, **platform-Agnostic** utilities that have no knowledge of React, the DOM, or Cloud Functions.
  - **Rule:** Code in this package **MUST NOT** have any dependencies on any other package in the monorepo.
- `packages/functions/`: Contains all server-side logic deployed as Cloud Functions.
  - **Structure:** Source code for this package **MUST** reside in `src/`. The TypeScript compiler will output the final JavaScript to the `lib/` directory, which is the deployment target.
  - **Rule:** This package **MAY** depend on `packages/shared`, but **MUST NOT** depend on `packages/client`.

#### **13.3 The Client `src/` Three-Tier Standard**

The client application's source code (`packages/client/src/`) is organized into a strict three-tiered structure.

- **Tier 1: `src/features/` (The Verticals):** The heart of the application, containing distinct, vertical slices of functionality.
  - **Rule:** A feature **MAY** depend on `src/shared` and `src/lib`, but **MUST NOT** depend on another feature directly.
- **Tier 2: `src/shared/` (The Horizontals - The Client UI Kit):** The single, authoritative location for all reusable code shared across multiple features _within the client_. This includes "dumb" UI components, shared hooks, and client-specific utilities.
  - **Rule:** Code in this directory **MUST NOT** have any knowledge of a specific feature.
- **Tier 3: `src/lib/` (The Foundation):** For foundational, client-specific, non-UI, cross-cutting concerns (e.g., Firebase setup, AI clients).
  - **Rule:** Code in this directory **MUST NOT** depend on `src/features` or `src/shared`.

#### **13.5 File Naming**

File names are determined by the nature of their exports. The "namespace-dot" pattern (e.g., `actions.turn.dispatch.ts`) is forbidden.

#### **13.6 The `index.ts` Rules**

- **The "No Redundant Naming" Rule:** When a file's name would match its parent directory's name, the file **MUST** be named `index.ts(x)`.
  - **Example:** A `Button` component lives at `src/shared/components/Button/index.tsx`.
- **The "Library Entry Point" Exception:** An `index.ts` file at the root of a package's `src` directory (e.g., `packages/shared/src/index.ts`) is **mandatory**. It defines the package's public API by explicitly exporting only the symbols intended for cross-package consumption.

---

(This part governs the naming of logical constructs within files.)\*

#### **13.9 Variable Naming**

- **Local Variables & Properties:** **MUST** use **`camelCase`**.
  - Collections **MUST** be plural nouns (e.g., `const players = ...`).
- **Boolean Flags:** **MUST** be prefixed with `is`, `has`, or `should`.
  - **Examples:** `isGameOver`, `hasNextTurn`, `shouldRender`
- **Module-Level Constants:** Truly universal, hardcoded constants (e.g., max retries, default names) exported from a file **MUST** use **`UPPER_SNAKE_CASE`**.
  - **Example:** `export const DEFAULT_TIMEOUT = 5000;`

---

### **Part C: Deprecation & Refactoring Guidance**

#### **13.10 Deprecated Directories**

The following directories are considered **deprecated**. New code **MUST NOT** be added to them. They are targets for gradual refactoring.

- `packages/client/src/features/common`: Its contents **MUST** be refactored into `packages/client/src/shared/`.
- `packages/client/src/shared/types/`: Its contents **MUST** be co-located with the features or shared components they describe.

#### **13.11 Type Co-location Strategy**

All new types **MUST** be co-located with the code they describe:

1.  **Domain Models:** `packages/shared/src/domain`
2.  **Feature-Specific Types:** Within the feature's directory.
3.  **Shared UI Types:** Within `src/shared/`, next to the component or hook they belong to.

Of course. A summary table is the perfect "cheat sheet" artifact to make the standard easily digestible for the AI. It translates the dense rules into a high-signal, quick-reference format.

Based on the definitive standard we have just created, here is the complete **Project Naming & Architecture Convention Table**.

---

# **AiAnvil Project: Naming & Architecture Convention Table**

This table is the definitive, quick-reference guide to all naming and structural conventions.

### **Part A: Physical Architecture (The "Where")**

| Artifact                            | Standard Convention  | Notes / Examples                                                                                                                                    |
| :---------------------------------- | :------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Monorepo Packages**               | `kebab-case`         | `packages/client`, `packages/functions`, `packages/shared`                                                                                          |
| **Directories**                     | `kebab-case`         | `src/features/shell-editor`, `src/shared/ui-components`                                                                                             |
| **Source Files (Single Export)**    | `PascalCase.ts(x)`   | For files exporting one main class, component, or default function. <br> e.g., `GameStateManager.ts`, `GameScreen.tsx`                              |
| **Source Files (Multiple Exports)** | `camelCase.ts`       | For files exporting a collection of related functions or symbols. <br> e.g., `stringUtils.ts`, `compositionLogic.ts`                                |
| **Test Files**                      | `[filename].spec.ts` | The file being tested, plus the `.spec.ts` suffix. <br> e.g., `stringUtils.spec.ts`                                                                 |
| **Index / Entry Point Files**       | `index.ts(x)`        | **MUST** be used to avoid redundant naming (`Button/index.tsx`) and as the **mandatory** public API for a package (`packages/shared/src/index.ts`). |

### **Part B: Logical Naming (The "What")**

| Artifact                       | Standard Convention           | Notes / Examples                                                                                                             |
| :----------------------------- | :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| **Classes & Abstract Classes** | `PascalCase`                  | Abstract classes **SHOULD** have an `Abstract` prefix. <br> e.g., `PlayerManager`, `AbstractGameEngine`                      |
| **Interfaces & Type Aliases**  | `PascalCase`                  | The `I` prefix for interfaces is **forbidden**. <br> e.g., `interface GameConfig`, `type PlayerId`                           |
| **Enums**                      | `PascalCase` (Singular)       | Enum members **MUST** also use `PascalCase`. <br> e.g., `enum TurnPhase { Processing, Complete }`                            |
| **Functions & Methods**        | `camelCase` (Verb-first)      | Async functions **SHOULD** have an `Async` suffix if not obvious. <br> e.g., `calculateScore()`, `saveStateAsync()`          |
| **Event Handlers**             | `handle<Event>` / `on<Event>` | `handle` for internal logic; `on` for props passed to components. <br> e.g., `handleButtonClick`, `<Button onClick={...} />` |
| **Variables & Properties**     | `camelCase`                   | Collections **MUST** be plural. <br> e.g., `currentPlayer`, `const players = []`                                             |
| **Boolean Flags**              | `is/has/should` prefix        | **MUST** be prefixed to indicate boolean type. <br> e.g., `isGameOver`, `hasNextTurn`, `shouldRender`                        |
| **Module-Level Constants**     | `UPPER_SNAKE_CASE`            | For hardcoded, exported constants. <br> e.g., `export const DEFAULT_TIMEOUT = 5000;`                                         |

### **Part C: Core Architectural Rules**

| Concept                  | Rule / Guideline                                                                                                 |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **Package Dependencies** | `client` -> `shared` & `functions`. <br> `functions` -> `shared`. <br> `shared` -> (nothing).                    |
| **Client Tiers**         | Code flows from **Features** -> **Shared** -> **Lib**. Dependencies **MUST NOT** flow in the opposite direction. |
| **`features/common`**    | **DEPRECATED.** All new shared client code **MUST** go in `src/shared/`.                                         |
| **`shared/types`**       | **LEGACY.** All new types **MUST** be co-located with the code they describe.                                    |
