This is a crucial question that defines the foundational quality of the project. The way we handle this will determine whether we build on a solid, compliant foundation or inherit technical debt from the very first day.

The most robust and architecturally sound method is to **treat the AiAnvil logic as a design reference, not as source code to be copied.**

We will filter it through the "coder" (us) to **preserve the original, proven *intent* and then reimplement it from scratch** to be a first-class, fully compliant citizen of the new architecture.

Pasting the code directly is forbidden. It would violate nearly every standard we have just established.

---

### **Rationale: Why Reimplementation is the Only Robust Path**

This approach is mandated by the project's own core principles:

1.  **Architectural Purity & Compliance:** Pasting the files directly would introduce code that lacks the mandatory file preambles (`@architectural-role`, `@core-principles`, etc.) and likely violates the strict naming conventions, TypeScript settings, and logging standards. [cite: coding_standard.md] Reimplementing forces every single line of code to pass through the new quality gate.

2.  **Dependency Control:** The imported code may carry hidden or outdated dependencies. A direct copy-paste risks polluting our new, clean environment. A clean reimplementation ensures we only use dependencies that we have explicitly vetted, adhering to the "Modernity & Due Diligence" rule. [cite: coding_standard.md]

3.  **Contextual Fitness:** The AiAnvil logic was built for a different system. Reimplementing allows us to adapt the logic to fit perfectly within our new patterns. For example, a utility might need to be adapted to work with the `ApiPoolManager` or a Zustand store, which did not exist in its original context.

4.  **Testability:** Every new piece of logic, especially "Critical" logic, must be testable according to our testing standard. [cite: testing_standard.md] The old code may not have been structured in a way that is easy to unit test. Reimplementing allows us to build with testability in mind from the start.

---

### **The Official Workflow for Integrating AiAnvil Logic**

We will follow this deliberate, four-step process for each piece of functionality we want to bring over.

**Step 1: Deconstruct the Intent**
For a given file or module from AiAnvil (e.g., the `crypto` utilities), we will first state its core purpose in a single, clear sentence. We are extracting the "why" and the "what," not the "how."

**Step 2: Map the Intent to the New Architecture**
We will determine the canonical home for this piece of functionality within the new project's three-tier architecture. We will use the `coding_standard.md` as our guide. Is it a platform-agnostic utility (`packages/shared/`)? Is it a client-specific service (`packages/client/src/lib/`)?

**Step 3: Define the New Contract**
Before writing any implementation, we will first define the new file's contract. This includes:
*   The full, compliant file preamble (`@architectural-role`, `@core-principles`).
*   The public API, defined as strict TypeScript interfaces and function signatures.

**Step 4: Reimplement with Full Compliance**
With your approval of the contract, I will then write the internal logic for the functions. The original AiAnvil code will serve as a trusted reference for the algorithm itself, but the code I produce will be written from scratch to be 100% compliant with our new standards.

#### **Example: Applying the Workflow to the `crypto` Utilities**

1.  **Intent:** To provide pure, platform-agnostic, and secure functions for AES-GCM encryption/decryption and key derivation from a user secret.

2.  **Mapping:** This logic is a foundational, platform-agnostic utility. It has no dependencies on React, VS Code, or any other package. Therefore, according to the standard, it belongs in the `packages/shared/` package, likely under `packages/shared/src/lib/security/`. [cite: coding_standard.md]

3.  **New Contract:** We would first define the file `packages/shared/src/lib/security/aes.ts` and its preamble and API, ensuring it meets all documentation and type-safety standards.

4.  **Reimplementation:** You would then ask me to write the code for `aes.ts`. I would use the proven cryptographic logic from the AiAnvil reference to implement the `encrypt` and `decrypt` functions, but the code itself would be new, clean, and fully documented according to our rules.

This methodical process is the only way to guarantee that the final result is robust, maintainable, and truly belongs in its new home.