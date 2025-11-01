---

# **The AiAnvil Project: The Constructionist Troubleshooting Protocol**

**Document-Type:** Engineering Process Standard

### **1. Authority & Philosophy**

This document codifies the **prime directive for debugging complex problems**. It replaces abstract hypothesis testing with a practical, construction-based approach.

The core philosophy is the **Principle of the Known-Good Baseline.** We do not hunt for a single flaw in a complex system. Instead, we **build the simplest possible version of what we want to achieve**. This working baseline becomes our "ground truth," an irrefutable example of code that *can* work. The bug is then revealed in the delta between the complex reality and the simple, working baseline. We will not attempt to debug configuration, environment, or secondary features until the Golden Path works in isolation.

We are not detectives trying to prove a theory; we are engineers building a known-good foundation to guide us. As the project's AI Partner, you **SHALL** invoke this protocol when we are stuck.

### **2. The Trigger: When to Invoke This Protocol**

This protocol **MUST** be initiated when:

*   We are unable to solve a problem after a few initial attempts.
*   The system's behavior seems contradictory or illogical.
*   The complexity of the situation makes it difficult to isolate variables.

### **3. The Six-Step Protocol**

#### **Step 1: Define the "Golden Path"**

We will start by defining the absolute simplest, most fundamental piece of functionality we are trying to achieve. This is our goal, stated positively.

> **Example:** "The Golden Path is this: A test file must be able to use the `vi` object as both a runtime value (`vi.fn()`) and as a type namespace (`let myMock: vi.Mock`)."

#### **Step 2: Construct the Baseline Exemplar**

We will immediately create a new, temporary, and maximally simple file or project. This is our "clean room" where we will build our working example. It **MUST NOT** have any dependencies on other project code.

> **Example:** "We will create a new, standalone `temp-test-project` directory completely outside the monorepo workspace to serve as our baseline exemplar."

#### **Step 3: Achieve the Golden Path in the Baseline**

Inside the baseline exemplar, we will write the bare minimum code required to implement the Golden Path. We will add one line at a time, fixing any errors that appear, until the Golden Path is achieved and the file is 100% error-free.

> **Example:** "In `temp-test-project`, we will create a local `vitest.config.ts` and `vitest.setup.ts`. We find that mocking the entire external Firebase SDK in the setup file allows a simple component test to pass without connection errors. The Golden Path is now achieved in the baseline."

#### **Step 4: Compare and Identify the Delta**

Now that we have a working baseline, we will compare it to the original, complex project that has the bug. The root cause of the bug **must** lie in the difference—the "delta"—between the two.

> **Example:** "We compare our working baseline to the main project. The delta is clear: the main project's test environment was being polluted by the monorepo's root `vitest.config.ts`, which prevented the package-level `vitest.setup.ts` from correctly intercepting the Firebase initialization."

#### **Step 5: Port the Working Solution**

Using the knowledge from the delta, we will transfer the working pattern from the baseline to the original file. This is no longer a guess; it is a direct port of a proven solution.

> **Example:** "We will now refactor the main project's `vitest.setup.ts` to use the same 'mock the entire external SDK' pattern that was proven successful in the baseline."

#### **Step 6 (Optional): Promote the Baseline to a Permanent Exemplar**

If the Golden Path and its solution represent a foundational pattern for the project, we will promote the baseline exemplar into a permanent "Published Architectural Exemplar" so the knowledge is never lost.

*   **Action:** Move and rename the file/project to a permanent location (e.g., `/exemplars/`).
*   **Documentation:** Update its `README.md` to explain its purpose as a canonical reference.
*   **Action:** Update the **Appendix of this document** to include a reference to the new exemplar.

---

### **Appendix: Known Issues & Published Architectural Exemplars**

This appendix contains a list of previously solved, complex issues. The referenced "Exemplar" files are the canonical, working solutions and should be the first point of reference when encountering similar problems.

#### **A.1 Vitest Type Resolution Errors**

- **Symptoms:** TypeScript errors like `Cannot find namespace 'vi'` appear in `.spec.ts` files, even when `vi` is correctly imported. Using `vi` as a value (`vi.fn()`) works, but using it as a type (`let x: vi.Mock`) fails.
- **Root Cause:** A conflict between the strict module setting (`verbatimModuleSyntax: true`) in `tsconfig.json` and the reliance on implicit, global types from Vitest.
- **Solution:** Do not rely on globals. All types required for testing **must** be explicitly imported from the `vitest` module using a type-only import.
- **Exemplar:**
  - `packages/client/src/shared/exemplars/vitest-explicit-type-imports.spec.ts`

#### **A.2 Complex Drag-and-Drop (DnD) State Management**

- **Symptoms:** Difficulty managing state, event propagation, and component re-rendering in UIs with complex, nested, or multi-list drag-and-drop interactions.
- **Root Cause:** The inherent complexity of managing DnD state declaratively in React. Issues often involve incorrect event handling, state updates that cause performance bottlenecks, or improper use of the underlying DnD library's context and sensors.
- **Solution:** A well-structured approach using a centralized state manager (like Zustand), combined with stable IDs and memoized components, is required. The `zubox` component serves as a robust, production-grade implementation of these principles for a complex case.
- **Exemplar:**
  - `packages/client/src/shared/exemplars/zubox/`

---

#### A.3 Linter False Positive on Function-Typed `let` Variables in Tests

- **Symptoms:** When declaring a function-typed variable using `let` at the top level of a `describe` block (e.g., `let myFunc: (arg: string) => void;`), ESLint incorrectly reports a `no-unused-vars` error for the parameter (`arg`). This error persists even if the parameter is correctly prefixed with an underscore (`_arg`) or if the type is extracted into a `type` alias or `interface`. Attempts to use `eslint-disable-next-line` may result in a contradictory "unused directive" error.
- **Root Cause:** This is a known tooling bug. It is triggered by a specific combination of patterns: 1) a top-level `let` variable, 2) whose type is a function signature, and 3) which is assigned its value in a `beforeEach` block. This combination confuses the ESLint parser, causing it to misinterpret the parameter within the _type definition_ as an unused variable in the _implementation scope_.
- **Solution:** Do not fight the linter. The entire pattern of using shared `let` variables with `beforeEach` is fragile and should be avoided. The correct and robust solution is to refactor the test to use a **`setup` helper function**. This pattern encapsulates all test setup and returns the necessary mocks and the function-under-test, completely eliminating the top-level `let` variables that trigger the bug and ensuring perfect test isolation.
- **Exemplar:**

  **Forbidden Pattern (Fragile and Exposes Linter Bug):**

  ```typescript
  // In a *.spec.ts file
  describe('My Fragile Test', () => {
    // This top-level `let` declaration is the source of the problem.
    let myActionHandler: (action: string) => Promise<void>; // <-- Linter fails here
    let mockDependency: Mock;

    beforeEach(() => {
      // Assigning within beforeEach is part of the trigger condition.
      mockDependency = vi.fn();
      myActionHandler = createMyActionHandler(mockDependency);
    });

    it('should do something', () => {
      // This test relies on shared state from the beforeEach block.
      myActionHandler('test');
      expect(mockDependency).toHaveBeenCalled();
    });
  });
  ```

  **Correct Pattern (Robust `setup` Helper):**

  ```typescript
  // In a *.spec.ts file

  // 1. Create a dedicated setup function that prepares the test environment.
  function setupTest() {
    const mockDependency = vi.fn();
    const { myActionHandler } = createMyActionHandler(mockDependency);

    // 2. Return everything needed for the test.
    return {
      myActionHandler,
      mockDependency,
    };
  }

  describe('My Robust Test', () => {
    it('should do something', () => {
      // 3. Call setup() to get a fresh, isolated environment for this specific test.
      const { myActionHandler, mockDependency } = setupTest();

      // 4. Act and Assert.
      myActionHandler('test');
      expect(mockDependency).toHaveBeenCalled();
    });
  });
  ```

#### A.4 TypeScript Error TS2349 on CommonJS Module Imports

- **Symptoms:** When importing a package that uses CommonJS (like `ignore` or `adm-zip`), TypeScript throws error `TS2349: This expression is not callable. Type 'typeof import(...)' has no call signatures`, even when the import statement appears correct.
- **Root Cause:** This is a tooling and type definition conflict, not a logic error. It is caused by an incompatibility between the project's modern module resolution strategy (`"moduleResolution": "NodeNext"` in `tsconfig.json`) and the type declarations of some older CommonJS packages. TypeScript correctly imports the module's overall type shape but fails to understand that the default export itself is a function or a class constructor that can be called.
- **Solution:** The established architectural pattern for this project is to use a pragmatic **type cast to `any`** as an escape hatch _at the point of instantiation or invocation_. This action bypasses the faulty type check for that single line and **MUST** be accompanied by a detailed comment explaining the reason. This prevents the "escape hatch" from being mistaken for a bug and being "fixed" in the future.

- **Exemplar:**

  **Forbidden Pattern (Triggers TS2349 Error):**

  ```typescript
  import ignore from 'ignore';

  // This line will fail with "This expression is not callable."
  const ig = ignore();
  ```

  **Correct Pattern (Applies the Type Cast Escape Hatch):**

  ```typescript
  import ignore from 'ignore';

  // This is a documented exception following the project's established pattern
  // for handling CJS/ESM interop issues under the 'NodeNext' module resolution
  // strategy (see AdmZip usage in `file-utils.ts`). The 'ignore' package's
  // type definitions cause a false positive error, so we cast to 'any' as a
  // pragmatic escape hatch.
  const ig = (ignore as any)();
  ```

#### **A.5 Type Safety Errors When Mocking Zustand Stores**

- **Symptoms:** When mocking a Zustand store in a test file (e.g., using `vi.mocked`), TypeScript throws error `TS2345: Argument of type '...' is not assignable to parameter of type '...'`. The error message details that your mock object is "missing the following properties from type" and lists a number of state properties or actions. This can happen iteratively, where fixing one missing property reveals another.
- **Root Cause:** This is a type safety error, not a logic or configuration bug. It is caused by providing an **incomplete mock object** that does not fully satisfy the store's comprehensive TypeScript type. Zustand stores combine state (e.g., `isOpen`, `chips`) and actions (e.g., `saveChip`, `startNewChip`) into a single, unified state object. The test mock **MUST** replicate this entire shape to be considered a valid substitute by the TypeScript compiler.
- **Solution:** The correct and robust architectural pattern is the **"Complete Mock."** Instead of creating partial mocks for different parts of the store, create a single, comprehensive object in your test setup that includes _every_ property—both state and actions—defined in the store's type. Use this single object to mock both the hook's implementation (for component consumption) and its static `getState` method (for direct action calls). This ensures the mock is fully type-compliant and accurately reflects the store's unified nature.

- **Exemplar:**

  **Forbidden Pattern (Incomplete and Inconsistent Mocks):**

  ```typescript
  // In a *.spec.tsx file

  // Anti-pattern: Mocking only actions for getState()
  // TS ERROR: This object is missing all state properties like `isOpen`, `chipDraft`, etc.
  vi.mocked(useChipEditorStore.getState).mockReturnValue({ saveChip: vi.fn() });

  // Anti-pattern: Mocking only a slice of state for the hook implementation
  // TS ERROR: This object is missing all actions and other state properties.
  mockUseChipEditorStore.mockImplementation((selector) => selector({ isOpen: true }));
  ```

  **Correct Pattern (The "Complete Mock"):**

  ```typescript
  // In a *.spec.tsx file

  // 1. In your `beforeEach` or `setup()` function, define a SINGLE, COMPLETE
  //    object that includes ALL state properties and ALL action properties.
  const mockChipEditorStoreState = {
    // State properties
    isOpen: true,
    isDirty: false,
    chipDraft: mockChipDraft, // (from test setup)
    editingChipId: 'draft-1',
    activeId: null,
    // ... all other state properties with sensible defaults

    // Action properties (as mock functions)
    saveChip: vi.fn(),
    closeDialog: vi.fn(),
    startNewChip: vi.fn(),
    // ... all other actions defined in the store
  };

  // 2. Apply this single, complete mock object consistently to BOTH mock points.

  // For the hook implementation (used by the React component)
  mockUseChipEditorStore.mockImplementation((selector) => selector(mockChipEditorStoreState));

  // For the static getState method (used for direct action calls)
  vi.mocked(useChipEditorStore.getState).mockReturnValue(mockChipEditorStoreState);
  ```

  ***

#### **A.6 Vitest Environment Initialization Failures with Firebase**

- **Symptoms:** When running Vitest, you encounter errors that indicate a real Firebase connection is being attempted, even though mocks seem to be in place. These errors include:
  - `FirebaseError: 7 PERMISSION_DENIED: Missing or insufficient permissions.`
  - `TypeError: Cannot read properties of undefined (reading 'getProvider')`
  - `Error: [vitest] No "getAuth" export is defined on the "firebase/auth" mock.`
- **Root Cause:** This is a **module loading race condition**, often made worse by monorepo configurations. The test runner is importing and executing your application's real Firebase initialization code (e.g., from `src/lib/firebase.ts`) _before_ the `vi.mock()` calls in your setup file have been applied. This causes the real Firebase SDK to be called, which fails in a test environment without valid credentials. Attempting to mock your internal `lib/firebase.ts` is often ineffective and part of a failed strategy.
- **Solution:** The canonical pattern is to **forcefully mock the entire external SDK at the earliest possible moment**. This is achieved with a dedicated `vitest.setup.ts` file that mocks `firebase/app`, `firebase/auth`, and `firebase/firestore`. This setup file MUST be loaded by your `vitest.config.ts`.
  1.  **Isolate First:** If the issue persists, the first step is to follow the Constructionist Protocol by creating a temporary, standalone project outside your monorepo to establish a "known-good baseline" free from configuration conflicts.
  2.  **Mock the External Boundary:** In your `vitest.setup.ts`, mock the entire external libraries. This is the only reliable way to prevent the real SDK from initializing.
  3.  **Correct Test Syntax:** In your `.spec.ts` files, do not use local mocks for Firebase. Instead, get type-safe references to the globally mocked functions using `vi.mocked()` (e.g., `const mockGetDoc = vi.mocked(getDoc);`).
  4.  **Mock Asynchronously:** Mocks for async Firebase functions must return a `Promise` (e.g., `mockGetDoc.mockResolvedValue(...)`) to prevent tests from timing out.
- **Exemplar:**
  - The `temp-test-project` that was created and preserved serves as the **Published Architectural Exemplar** for this entire pattern. Its `README.md` file contains the full explanation of the solution.

#### **A.7 Zustand Store Tests Fail with "Cannot find package 'react'"**

- **Symptoms:** When running a Vitest suite for a Zustand store, the test runner fails immediately with a module resolution error: `Error: Cannot find package 'react' imported from .../zustand/esm/react.mjs`. This occurs even if your store's logic does not seem to use React.
- **Root Cause:** This is an **environmental mismatch**, not a logic error. It is caused by using Zustand's default, React-aware entry point within a test environment that is pure Node.js and does not have `react` as a dependency.
  1.  The standard `import { create } from 'zustand'` import resolves to Zustand's React-specific module.
  2.  This module has a hard dependency on the `react` package.
  3.  In a headless backend environment (like a VS Code extension or a server), `react` is not an installed dependency, so the test runner's module loader fails.
- **Solution:** The canonical architectural pattern is to **force the use of Zustand's vanilla, framework-agnostic core**. This is achieved by changing the import in the store's source file to use the `'zustand/vanilla'` entry point. This severs the dependency on React and makes the store compatible with any JavaScript environment.

- **Exemplar:**

  **Forbidden Pattern (For non-React Environments):**

  ```typescript
  // In MyStore.ts
  import { create } from 'zustand'; // <-- This import causes the error in Node.js tests.

  // This creates a React hook, which is incorrect for a backend store.
  export const useMyStore = create<MyStore>((set) => ({
    // ... store logic
  }));
  ```

  **Correct Pattern (Robust and Environment-Agnostic):**

  ```typescript
  // In MyStore.ts

  // 1. Import 'createStore' directly from the 'vanilla' entry point.
  import { createStore } from 'zustand/vanilla';

  // ... (define your store's state and actions interfaces)

  // 2. Use 'createStore' to create a plain store object, not a hook.
  export const myStore = createStore<MyStore>((set) => ({
    // ... store logic
  }));

  // 3. In your test file, you can now import 'myStore' directly and use
  //    myStore.getState() and myStore.setState() without any React dependencies.
  ```
