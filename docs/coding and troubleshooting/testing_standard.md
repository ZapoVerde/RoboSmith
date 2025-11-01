

---

### **The Definitive AiAnvil Testing Standard: The Business-Driven Mandate**

#### **Part I: The Philosophy (The "Why")**

This standard is governed by a single, business-driven mandate:

> *"I don't want to spend four hours determining if the button clicks right. But anything that could cost me money I want nailed down."*

This translates into two directives:
1.  **We Protect the Assets:** We write focused, rigorous tests for any code whose failure incurs a significant cost (financial, data integrity, security, or user trust).
2.  **We Eliminate Waste:** We aggressively avoid writing tests that are expensive but provide little confidence.

---

#### **Part II: The Rules of Engagement (The "What to Test")**

This framework is a strict, hierarchical system. Every piece of code falls into one of these three categories.

### **THESE THINGS MUST ALWAYS BE TESTED (Non-Negotiable)**

This category covers the architectural backbone of the application. A file or module **MUST** be tested if it is defined as "Critical."

#### **Defining "Critical": The 6-Point Rubric (Mandatory)**

This rubric is the official, binary filter for this category. A file is defined as "Critical" if it meets **one or more** of these criteria:

1.  **State Store Ownership:** It is a central state store (e.g., a Zustand store) that manages shared application state.
2.  **Core Business Logic Orchestration:** It contains complex, non-obvious, or high-stakes business logic, data transformations, or state transitions (e.g., `GameStateManager`, `TurnProcessor`).
3.  **High Fan-Out (System-Wide Dependency):** It is a utility or service that is imported and used by a large number of unrelated features across the application (e.g., a central `logger`).
4.  **Core Domain Model Definition:** It contains factory functions or logic that create or validate the core data structures of the application (e.g., `createNewShell`, `createNewChip`).
5.  **I/O & Concurrency Management:** It is the primary interface for interacting with an external service, especially a database (e.g., `groupsRepository`). It manages the "plumbing" and concurrency.
6.  **Security & Authentication Context:** It handles anything related to encryption, sanitization, authentication, or secrets management.

**If a file meets any of these criteria, it is considered Critical and a test suite is mandatory.** The suite must follow the "One Test Per Core Capability" principle.

---

### **THESE THINGS SHOULD NEVER BE TESTED (Forbidden)**

This category covers tests that are a proven net negative for the project. Writing these is an anti-pattern.

1.  **Purely Presentational UI Components:**
    - **WHY IT'S FORBIDDEN:** They contain no logic. Their correctness is proven **implicitly** by the integration test of the feature that uses them.
    - **EXAMPLES:** `<InfoTooltip />`, `<Logo />`, or a simple wrapper around a MUI `<Button />`.

2.  **Brittle "Change Detector" Tests:**
    - **WHY IT'S FORBIDDEN:** They verify cosmetic details, not behavior. They break on any minor design change, costing engineering time for zero confidence gain.
    - **EXAMPLES:** `expect(element).toHaveStyle('color: red')`.

---

### **THESE THINGS SHOULD BE TESTED IF... (The Zone of Judgment)**

This category requires professional judgment. Write a test only if the code graduates to a higher level of complexity.

1.  **UI Components:**
    - **TEST IF:** The component stops being "dumb" and starts managing its own **complex internal state and logic.**
    - **TRIGGER:** It uses multiple `useState`/`useEffect` hooks to manage a multi-step flow or performs its own data fetching.
    - **RATIONALE:** It has become a mini-application whose logic can break a user flow.
    - **GUIDANCE:** When a component becomes this complex, apply the **Headless Logic Pattern** described in Part IV.

2.  **Custom Hooks:**
    - **TEST IF:** The hook contains **non-trivial business logic, side effects, or complex data transformations.**
    - **TRIGGER:** It's not just a simple wrapper around `useState`. It manages timers, complex state transitions, or significant memoization.
    - **RATIONALE:** It has become a shared piece of your application's "brains."
    - **EXAMPLE:** `useLongPress.ts`.

---

#### **Part III: The Guiding Principles (The "How")**

To execute this standard effectively, we rely on these core principles:

1.  **The Principle of Implicit Coverage:** A single, high-value integration test for a feature **implicitly verifies** all the simple, non-tested components used within it.
2.  **The Principle of "One Test Per Core Capability":** For the `MUST` test files, the suite is complete when it has one primary test for each of its core public capabilities.
3.  **Contract Fidelity & Naming:** All `@contract` assertions must be proven by a test, and all `it` blocks must follow the `shouldDoX_whenY` convention.

---

#### **Part IV: Architectural Patterns for Testability (The "How-To")**

This section defines canonical architectural patterns that MUST be followed to ensure our code is testable by design.

### **4.1 The Headless Logic Pattern for UI Components**

- **Problem:** Testing UI components directly can be fragile. It makes tests dependent on specific DOM structures and can be complicated by framework-specific compilers and build tool configurations (e.g., Vite, Svelte plugins), leading to brittle tests that are difficult to debug.
- **Architectural Solution:** We do not fight the tooling. We refactor the component to isolate its behavior in a way that is independent of the rendering framework. The logic is separated from the presentation.

- **The Pattern:** A component with non-trivial logic is split into two files:
    1.  **A `.logic.ts` file:** This is a pure TypeScript file that contains **all** of the component's behavior: state management, event handling logic, data transformation, etc. It has zero dependencies on Svelte or any other UI framework.
    2.  **A `.svelte` file:** This file becomes a purely **presentational component**. Its only job is to render the UI and delegate all events to the headless logic file. It contains the absolute minimum amount of code required to function.

- **Testing Mandate:**
    - The `.logic.ts` file, which contains the critical behavior, **MUST** be covered by a comprehensive suite of fast, simple unit tests.
    - The `.svelte` file, now being purely presentational, falls under the **"SHOULD NEVER BE TESTED"** category. Its correctness is implicitly verified by higher-level integration tests of the feature that uses it.

- **Exemplar:** The `SimpleButton` component demonstrates this pattern.

  **1. The Headless Logic (`simpleButton.logic.ts`)**
  ```typescript
  type SayHelloDispatcher = (event: 'sayHello', payload: { message: string }) => void;
  
  export function createClickHandler(dispatch: SayHelloDispatcher) {
    return function handleClick() {
      dispatch('sayHello', { message: 'Hello from SimpleButton!' });
    };
  }
  ```

  **2. The Unit Test for the Logic (`simpleButton.logic.spec.ts`)**
  ```typescript
  import { describe, it, expect, vi } from 'vitest';
  import { createClickHandler } from './simpleButton.logic';

  it('should call the dispatcher with the correct event and payload', () => {
    const mockDispatch = vi.fn();
    const handleClick = createClickHandler(mockDispatch);
    handleClick();
    expect(mockDispatch).toHaveBeenCalledWith('sayHello', {
      message: 'Hello from SimpleButton!',
    });
  });
  ```

  **3. The Simplified View (`SimpleButton.svelte`)**
  ```html
  <script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { createClickHandler } from './simpleButton.logic';

    const dispatch = createEventDispatcher();
    const handleClick = createClickHandler(dispatch);
  </script>

  <button on:click={handleClick}>Click Me</button>
  