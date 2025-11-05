
---

# **Specification: The Context Partitioning System**

## 1. High-Level Summary

This specification defines the complete Context Partitioning System, a critical component that serves as the integration point for the `roberto-mcp` code analysis engine. The architecture is a two-part system designed to provide maximum performance with optimal resource usage, in line with the **"On-Demand Server-per-Worktree"** model.

*   The **`R_Mcp_ServerManager`** is a stateful, singleton orchestrator responsible for managing the lifecycle of dedicated `roberto-mcp` server processes. It spins up a server only when a workflow becomes active and spins it down when the workflow is paused or complete, leveraging `r-mcp`'s native on-disk caching for near-instant "warm starts".
*   The **`ContextPartitionerService`** is a simple, stateless façade that acts as a query router. It translates requests from the main `Orchestrator` into JSON-RPC messages and sends them to the correct, running server instance via the `R_Mcp_ServerManager`.

This design makes the complex process of cache management and server lifecycles completely invisible to the end-user and the workflow manifest, fulfilling the project's "Principle of Apparent Simplicity."

## 2. Core Data Contracts

The system uses JSON-RPC to communicate with the `roberto-mcp` binary. These TypeScript interfaces define the contracts for the most critical tools.

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
    *   To handle the spawning of new server processes and the sending of the initial `index_code` command.
    *   To handle the graceful termination of server processes to free system resources.
    *   To provide other services with access to the JSON-RPC clients for running server instances.
*   **Public API (TypeScript Signature):**
    ```typescript
    export class R_Mcp_ServerManager {
      public static getInstance(): R_Mcp_ServerManager;

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
    1.  **Internal State:** The service maintains a private `Map<string, ManagedProcess>`, where the key is the `worktreePath` and `ManagedProcess` is an object containing the `child_process` instance and its associated JSON-RPC client.
    2.  **`spinUpServer(worktreePath)`:**
        a. Checks if a server is already running for the given `worktreePath`. If so, it logs a warning and returns.
        b. Spawns the `roberto-mcp` binary as a child process, setting the `ROBERTO_MAX_MEMORY_MB` environment variable to a reasonable limit (e.g., 256MB).
        c. Establishes a JSON-RPC client that communicates over the process's `stdio` streams.
        d. Stores the process and client in its internal map.
        e. Sends the `tools/call` message for `index_code` with the `worktreePath`. This is an async operation. The method's promise resolves only after `r-mcp` confirms the initial indexing (or fast warm-start validation) is complete.
    3.  **`spinDownServer(worktreePath)`:**
        a. Looks up the `ManagedProcess` for the given `worktreePath`.
        b. If found, it sends a graceful shutdown signal to the process and removes it from the map.
    4.  **`getClientFor(worktreePath)`:**
        a. A synchronous method that performs a simple lookup in the map and returns the stored `JsonRpcClient` or `undefined`.

*   **Mandatory Testing Criteria:**
    *   A test must verify that `spinUpServer` correctly spawns a child process and sends the `index_code` message via a mocked RPC client.
    *   A test must verify that `spinDownServer` terminates the correct mocked child process.
    *   A test must verify that `getClientFor` returns the correct client for a running process and `undefined` for an unknown or stopped one.
    *   A test must verify that attempting to spin up an already-running server does not create a second process.

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
      public static getInstance(): ContextPartitionerService;

      public async getFileOutline(args: GetFileOutlineArgs): Promise<FileOutline>;
      public async getSymbolReferences(args: GetSymbolReferencesArgs): Promise<SymbolReference[]>;
      // ... other methods corresponding to all required r-mcp tools
    }
    ```

*   **Detailed Behavioral Logic (The Algorithm):**
    The service is a stateless singleton that acts as a simple pass-through router.

    1.  When a public method like `getFileOutline(args)` is called, it immediately performs the following steps:
        a. **Get Client:** It calls `R_Mcp_ServerManager.getInstance().getClientFor(args.worktreePath)`.
        b. **Guard Clause:** If the returned client is `undefined`, it immediately rejects the promise with a specific, informative error (e.g., `McpServerError: No active analysis server for this worktree.`).
        c. **Format Request:** It constructs the JSON-RPC message payload for the `get_file_outline` tool, using the `filePath` from its `args`.
        d. **Send Request:** It uses the client to send the request to the appropriate `r-mcp` server process.
        e. **Return Response:** It awaits the JSON-RPC response, parses the content, and resolves its promise with the final `FileOutline` object.

*   **Mandatory Testing Criteria:**
    *   A test must verify that the service correctly calls `R_Mcp_ServerManager.getClientFor` with the `worktreePath` from the arguments.
    *   A test must verify that the service throws an error if the server manager returns `undefined`.
    *   A test must verify that the service sends a correctly formatted JSON-RPC message to the mocked client (e.g., correct tool name and arguments).
    *   A test must verify that the service correctly parses and returns the content from a successful mocked RPC response.