
# **Specification: The Context Partitioner Service**

## 1. High-Level Summary

This specification defines the `ContextPartitionerService`, a critical component that acts as the sole integration point for the `roberto-mcp` code analysis engine. Its core purpose is to serve as a **"Query Orchestrator" and Concurrency Manager**, translating requests from the workflow engine into executed `roberto-mcp` commands and returning the results.

This service is the direct implementation of the architecture laid out in **`docs/architecture/r-mcp_Integration_and_Strategy.md`**. This specification focuses exclusively on the service's internal contract, responsibilities, and the precise algorithm for its concurrency-limited queue.

## 2. Core Data Contracts

The service operates on a set of strongly-typed contracts for each `roberto-mcp` tool.

```typescript
// --- Internal Queuing Contract ---
interface QueuedRequest {
  tool: string;
  params: Record<string, any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

// --- Public API Contracts ---
export interface GetFileOutlineArgs {
  worktreePath: string;
  filePath: string;
}

export interface FileOutline {
  functions: Array<{ name: string; signature: string; line: number }>;
  classes: Array<{ name: string; line: number }>;
  // ... other symbol types
}

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

## 3. Component Specification

### Component: ContextPartitionerService
*   **Architectural Role:** `Orchestrator` (for external processes)
*   **Core Responsibilities:**
    *   To act as the exclusive, system-wide client for the `roberto-mcp` binary's one-shot mode.
    *   To manage a **concurrency-limited request queue** to prevent system thrashing from excessive CPU-intensive processes.
    *   To translate its public method calls into the correct command-line arguments for `roberto-mcp`.
    *   To handle the entire lifecycle of the child process, including capturing `stdout`, parsing JSON, and managing all error conditions.

*   **Public API (TypeScript Signature):**
    ```typescript
    export class ContextPartitionerService {
      public static getInstance(maxConcurrentProcesses?: number): ContextPartitionerService;

      public async getFileOutline(args: GetFileOutlineArgs): Promise<FileOutline>;
      public async getSymbolReferences(args: GetSymbolReferencesArgs): Promise<SymbolReference[]>;
      public async getSymbol(args: /* ... */): Promise</* ... */>;
      public async codeSearch(args: /* ... */): Promise</* ... */>;
      // ... other methods corresponding to all required r-mcp tools
    }
    ```

*   **Detailed Behavioral Logic (The Algorithm):**
    The service is a stateful singleton that manages a queue to control execution flow.

    1.  **Internal State:**
        *   `private readonly maxConcurrentProcesses: number;` (e.g., `2`)
        *   `private activeProcessCount: number = 0;`
        *   `private requestQueue: QueuedRequest[] = [];`

    2.  **The Public Method Workflow (e.g., `getFileOutline`):**
        a. When a public method is called, it does **not** execute immediately.
        b. It returns a `new Promise((resolve, reject) => { ... })`.
        c. Inside the promise, it creates a `QueuedRequest` object containing the tool name (`'get_file_outline'`), the `args`, and the `resolve` and `reject` functions.
        d. It pushes this object onto the `this.requestQueue`.
        e. It calls a private `_processQueue()` method to attempt execution.

    3.  **The Core Processing Loop (`_processQueue` private method):**
        a. **Guard Clause 1:** If `this.activeProcessCount >= this.maxConcurrentProcesses`, the method returns immediately. The queue will be processed later.
        b. **Guard Clause 2:** If `this.requestQueue` is empty, the method returns immediately.
        c. **Dequeue and Increment:** If the guards pass, the method dequeues the next `QueuedRequest` from the front of the array and immediately increments `this.activeProcessCount`.
        d. **Execute the One-Shot Command:** The service spawns the `roberto-mcp` process within a `try...finally` block to guarantee state consistency.

            ```typescript
            try {
              // 1. Construct CLI args from the request object.
              const args = [
                '--oneshot',
                '--tool', request.tool,
                '--params', JSON.stringify(request.params)
              ];
              // 2. Spawn the child process.
              const child = spawn(binaryPath, args);
              // 3. Capture stdout/stderr, wait for 'close' event.
              // 4. Wrap this logic in a Promise.race with a timeout.
              
              // 5. On SUCCESS (exit code 0):
              //    - Parse the stdout JSON.
              //    - Call request.resolve(parsedJson).
              // 6. On FAILURE (non-zero code, stderr, or JSON parse error):
              //    - Create a specific error (ProcessExecutionError, JsonParseError).
              //    - Call request.reject(error).
            } catch (error) {
              request.reject(error);
            } finally {
              // CRITICAL: This block ensures the queue always advances.
              this.activeProcessCount--;
              this._processQueue(); // Attempt to process the next item.
            }
            ```

*   **Mandatory Testing Criteria:**
    *   A test must verify that if 3 requests are submitted with a concurrency limit of 2, the third request's `spawn` call is **not** made until one of the first two has completed.
    *   A test must verify that requests are processed in strict First-In-First-Out (FIFO) order.
    *   A test must verify that `_processQueue` is called in the `finally` block even if the process execution fails, ensuring the queue does not get stuck.
    *   A test must verify that a malformed JSON string from the binary's `stdout` results in a rejected promise with a specific `JsonParseError`.
    *   A test must verify that a non-zero exit code rejects the promise with a `ProcessExecutionError` that includes the `stderr` content.
    *   A test must verify that the timeout mechanism correctly rejects the promise if the process takes too long.