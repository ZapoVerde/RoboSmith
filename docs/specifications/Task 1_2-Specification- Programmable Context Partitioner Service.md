
---

# **Specification: The Context Partitioning System**

## 1. High-Level Summary

This specification defines the complete Context Partitioning System, the integration point for the `roberto-mcp` code analysis engine. The architecture is a multi-part system designed for maximum performance, resource efficiency, and **testability**, in line with the **"On-Demand Server-per-Worktree"** model and the project's core principle of Dependency Inversion.

*   The **`R_Mcp_ServerManager`** is a stateful, singleton orchestrator responsible for managing the lifecycle of dedicated `roberto-mcp` server processes. It achieves this by delegating all direct process creation and I/O to a dedicated **`IProcessSpawner` adapter**. This decouples the complex orchestration logic from the fragile, platform-specific details of process management.
*   The **`ContextPartitionerService`** remains a simple, stateless façade that acts as a query router. It translates requests from the main `Orchestrator` into JSON-RPC messages and sends them to the correct, running server instance via the `R_Mcp_ServerManager`.

This design makes the complex process of cache management and server lifecycles completely invisible to the end-user while making the core logic fast, reliable, and trivial to test.

## 2. Core Data Contracts

The system uses JSON-RPC to communicate with the `roberto-mcp` binary. These TypeScript interfaces define the contracts for the most critical tools and are unaffected by the adapter pattern.

```typescript
// For the 'get_file_outline' tool
export interface GetFileOutlineArgs {
  worktreePath: string;
  filePath: string;
}
export interface FileOutline {
  functions: Array<{ name: string; signature: string; line: number }>;
  classes: Array<{ name: string; line: number }>;
  // ... other symbol types
}

// For the 'get_symbol_references' tool
export interface GetSymbolReferencesArgs {
  worktreePath: string;
  symbolName: string;
}
export interface SymbolReference {
  filePath: string;
  line: number;
  // ... other reference details
}
```

## 3. Component Specifications

### Component 1: R_Mcp_ServerManager
*   **Architectural Role:** `Process Orchestrator`
*   **Core Responsibilities:**
    *   To be the single, authoritative service for managing the lifecycle of all `roberto-mcp` server processes.
    *   To maintain an in-memory map of active server instances, with a strict one-to-one relationship between a running server and an *active* Git worktree.
    *   **DELEGATES** the spawning and termination of server processes to the injected `IProcessSpawner` adapter.
    *   **ORCHESTRATES** the initial `index_code` command via the created process's JSON-RPC client.
    *   Provides other services with access to the JSON-RPC clients for running server instances.
*   **Public API (TypeScript Signature):**
    ```typescript
    import type { IProcessSpawner } from '../architecture/Core_Adapters_and_Dependency_Inversion.md';

    export class R_Mcp_ServerManager {
      /**
       * The manager's constructor uses Dependency Injection to receive its I/O adapter.
       */
      constructor(processSpawner: IProcessSpawner);
      
      public static getInstance(processSpawner: IProcessSpawner): R_Mcp_ServerManager;

      /**
       * Spawns an r-mcp server for a given worktree. This is a "warm-start-aware"
       * operation that leverages r-mcp's on-disk cache.
       */
      public async spinUpServer(worktreePath: string): Promise<void>;

      /**
       * Terminates the r-mcp server process for a given worktree.
       */
      public async spinDownServer(worktreePath: string): Promise<void>;

      /**
       * Retrieves the active JSON-RPC client for a given worktree.
       */
      public getClientFor(worktreePath: string): JsonRpcClient | undefined;
    }
    ```
*   **Detailed Behavioral Logic (The Algorithm):**
    1.  **Internal State:** The service maintains a private `Map<string, ManagedProcess>`, where the key is the `worktreePath` and `ManagedProcess` is an object containing the `IManagedProcess` instance and its associated JSON-RPC client.
    2.  **`spinUpServer(worktreePath)`:**
        a. Checks if a server is already running for the given `worktreePath`. If so, it logs a warning and returns.
        b. Calls `this.processSpawner.spawn(binaryPath, worktreePath)` to get an `IManagedProcess` instance.
        c. Establishes a JSON-RPC client that communicates over the streams provided by the `IManagedProcess` object.
        d. Stores the process and client in its internal map.
        e. Sends the `tools/call` message for `index_code` with the `worktreePath` using the newly created client. The method's promise resolves only after this initial indexing is complete.
    3.  **`spinDownServer(worktreePath)`:**
        a. Looks up the `ManagedProcess` for the given `worktreePath`.
        b. If found, it calls `managedProcess.process.kill()` and removes the entry from the map.
    4.  **`getClientFor(worktreePath)`:**
        a. A synchronous method that performs a simple lookup in the map and returns the stored `JsonRpcClient` or `undefined`.

*   **Mandatory Testing Criteria:**
    *   A test must verify that `spinUpServer` correctly calls the `spawn` method on a **mocked `IProcessSpawner`** with the correct binary path and working directory.
    *   A test must verify that `spinDownServer` calls the `kill` method on the **mocked `IManagedProcess`** instance that was returned by the spawner.
    *   A test must verify that after `spinUpServer` succeeds, `getClientFor` returns the correct, newly created client.
    *   A test must verify that attempting to spin up an already-running server does not call the spawner a second time.
    *   A test must verify that if the `spawn` method on the mocked adapter throws an error, the `spinUpServer` promise is rejected.

---

### Component 2: ContextPartitionerService
*   **Architectural Role:** `Stateless Façade`
*   **Core Responsibilities:**
    *   To act as the exclusive, system-wide client for querying an active `roberto-mcp` server.
    *   To be completely stateless and delegate all process management concerns to the `R_Mcp_ServerManager`.
    *   To translate its public method calls into the correct JSON-RPC `tools/call` message format.
    *   To provide clear error handling if a query is made for a worktree that does not have an active server.

*   **Public API (TypeScript Signature):**
    ```typescript
    export class ContextPartitionerService {
      /**
       * The service's constructor uses Dependency Injection to receive the manager.
       */
      constructor(serverManager: R_Mcp_ServerManager);

      public static getInstance(serverManager: R_Mcp_ServerManager): ContextPartitionerService;

      public async getFileOutline(args: GetFileOutlineArgs): Promise<FileOutline>;
      public async getSymbolReferences(args: GetSymbolReferencesArgs): Promise<SymbolReference[]>;
      // ... other methods corresponding to all required r-mcp tools
    }
    ```

*   **Detailed Behavioral Logic (The Algorithm):**
    The service's logic is unchanged. It remains a stateless pass-through router.

    1.  When a public method like `getFileOutline(args)` is called, it immediately performs the following steps:
        a. **Get Client:** It calls `this.serverManager.getClientFor(args.worktreePath)`.
        b. **Guard Clause:** If the returned client is `undefined`, it immediately rejects the promise with a specific, informative error (e.g., `McpServerError: No active analysis server for this worktree.`).
        c. **Format Request:** It constructs the JSON-RPC message payload for the `get_file_outline` tool, using the `filePath` from its `args`.
        d. **Send Request:** It uses the client to send the request to the appropriate `r-mcp` server process.
        e. **Return Response:** It awaits the JSON-RPC response, parses the content, and resolves its promise with the final `FileOutline` object.

*   **Mandatory Testing Criteria:**
    *   A test must verify that the service correctly calls `R_Mcp_ServerManager.getClientFor` with the `worktreePath` from the arguments.
    *   A test must verify that the service throws an error if the server manager returns `undefined`.
    *   A test must verify that the service sends a correctly formatted JSON-RPC message to the mocked client (e.g., correct tool name and arguments).
    *   A test must verify that the service correctly parses and returns the content from a successful mocked RPC response.