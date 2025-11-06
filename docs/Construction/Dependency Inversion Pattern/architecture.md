# **Architectural Report**

### **1. High-Level Goal & Rationale**
*   The primary objective is to refactor the core service layer by introducing a formal dependency inversion pattern. This change will decouple high-level orchestration logic from volatile, low-level I/O operations (Git, file system, child processes) to dramatically improve testability, robustness, and development velocity.

### **1.1 Detailed Description**
*   This refactoring introduces a layer of abstraction between the application's core services and the underlying system APIs. Two new primary interfaces, or adapters, will be created: an `IGitAdapter` and an `IProcessSpawner`. The `IGitAdapter` will encapsulate all Git command-line executions and file system interactions, breaking the tight coupling between the `GitWorktreeManager` and the `vscode` file system API. Similarly, the `IProcessSpawner` will abstract away the direct use of `child_process.spawn`, isolating this fragile operation from the `R_Mcp_ServerManager`. High-level services will now be programmed against these stable interfaces, and concrete "real" implementations of these adapters will be injected at runtime, making the core logic pure and easy to test with fast, in-memory simulations.

### **2. Core Principles & Constraints**
*   **Governing Principles (From Project Docs):**
    *   **Robustness:** The system must be resilient to failures in external I/O operations. This refactor enhances robustness by isolating failure points.
    *   **Separation of Concerns:** High-level business logic must be cleanly separated from low-level implementation details.
    *   **Testability by Design:** The system must be architected in a way that allows for fast, deterministic, and isolated unit testing of core business logic.
*   **Blueprint-Specific Principles:**
    *   High-level services (`GitWorktreeManager`, `R_Mcp_ServerManager`) **MUST NOT** perform any direct I/O operations (e.g., calling `execa`, `vscode.workspace.fs`, or `child_process.spawn`).
    *   All external I/O operations **MUST** be routed through a dedicated, abstract adapter interface (`IGitAdapter`, `IProcessSpawner`).
    *   Service dependencies (the adapters) **MUST** be provided to the services via their constructors, enforcing the Dependency Injection pattern.
    *   The application's main entry point **MUST** act as the "composition root," responsible for instantiating all concrete "real" adapters and injecting them into the services.

### **3. Architectural Flows**
*   **User Flow:**
    *   The user flow is entirely unaffected by this change. This is a purely internal architectural refactoring. The user will continue to interact with the system—creating workflows, supervising execution, and integrating results—in exactly the same way. The end-to-end behavior of the application from the user's perspective will not change.
*   **Data Flow:**
    1.  The `GitWorktreeManager` is instructed to initialize its state.
    2.  Instead of calling the `vscode` API directly, it invokes the `readDirectory` method on its injected `IGitAdapter` instance.
    3.  During normal application runtime, this instance is the `RealGitAdapter`. The `RealGitAdapter` receives the call and executes the actual `vscode.workspace.fs.readDirectory` command, interacting with the file system.
    4.  The `RealGitAdapter` returns the raw file data up the chain to the `GitWorktreeManager`.
    5.  During testing, the instance is a `MockGitAdapter`. The `MockGitAdapter` receives the same call but immediately returns a hardcoded, in-memory array of file data, completely bypassing the file system and providing a fast, deterministic result.
*   **Logic Flow:**
    1.  The extension's `activate` function is triggered on startup. This function now acts as the composition root.
    2.  It first instantiates the concrete, low-level adapters (e.g., `new RealGitAdapter(...)`, `new RealProcessSpawner(...)`). These are the only parts of the application aware of the "real" I/O APIs.
    3.  It then instantiates the high-level services, injecting the concrete adapters into their constructors (e.g., `new GitWorktreeManager(realGitAdapter)`).
    4.  When a service method is called (e.g., `gitWorktreeManager.createWorktree(...)`), its internal logic does not know whether the injected adapter is real or a mock.
    5.  The service's logic simply calls the abstract methods defined on the interface (e.g., `this.adapter.exec(...)`), fulfilling the Dependency Inversion principle. The control of *how* the I/O is performed has been inverted from the high-level module to the injected dependency.

### **4. Overall Acceptance Criteria**
*   New, formal TypeScript interfaces for `IGitAdapter` and `IProcessSpawner` must be created and fully defined in the project's architecture documentation.
*   The `GitWorktreeManager` and `R_Mcp_ServerManager` services must be fully refactored to remove all direct I/O calls, depending exclusively on the new adapter interfaces provided via their constructors.
*   Concrete `RealGitAdapter` and `RealProcessSpawner` classes must be implemented, correctly encapsulating all the original low-level I/O logic.
*   The extension's main `activate` function must be refactored into a composition root that correctly instantiates and injects all service dependencies.
*   Unit test suites for the `GitWorktreeManager` and `R_Mcp_ServerManager` must be rewritten to use mock adapters and must execute significantly faster and more reliably than the previous versions.
*   The end-to-end functionality of the application must be verified to be identical to the pre-refactor behavior, ensuring no regressions were introduced.