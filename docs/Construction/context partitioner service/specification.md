Of course. Here is the detailed design specification for **Task 1.2.1: Implement the `ContextPartitionerService`**, created according to the provided protocol and template.

---

# Specification: Programmable Context Partitioner Service

## 1. High-Level Summary
This specification defines the `ContextPartitionerService`, a critical component that serves as the system's "surgical tool" for context management. Its core purpose is to fulfill the project's primary philosophy of *"No unnecessary context, but all the necessary context."*

The service acts as a simple, stateless façade that wraps a high-performance, pre-compiled binary (`roberto-mcp`). It translates requests from the `Orchestrator` for specific, named "slices" of context into command-line executions. This function is essential for economic viability by minimizing token consumption and for AI effectiveness by keeping prompts highly focused and relevant.

## 2. Core Data Contracts
The service operates on a simple and stable contract, accepting a request for a context slice and returning the resulting text package.

```typescript
/**
 * Defines the arguments required to request a specific context slice.
 */
export interface GetContextArgs {
  /**
   * The absolute path to the source file from which context will be extracted.
   */
  filePath: string;

  /**
   * The named identifier of the context "slice" to generate, which corresponds
   * to a predefined rule within the roberto-mcp binary.
   */
  sliceName: string;
}

/**
 * A type alias for the final, string-based context package returned by the
 * service, ready to be injected into an AI prompt.
 */
export type ContextPackage = string;
```

## 3. Component Specification

### Component: ContextPartitionerService
*   **Architectural Role:** Stateless Façade
*   **Core Responsibilities:**
    *   Translate a context request (`GetContextArgs`) into a command-line execution of the `roberto-mcp` binary.
    *   Determine the correct, platform-specific binary to execute based on the host's operating system and CPU architecture.
    *   Manage the entire lifecycle of the child process, including spawning, capturing `stdout` and `stderr` streams, and handling exit codes.
    *   Encapsulate all details of interacting with the external binary, presenting a clean, promise-based API to the rest of the application.
    *   Provide robust error handling for scenarios where the binary is missing, fails to execute, or returns an error.

*   **Public API (TypeScript Signature):**
    ```typescript
    export class ContextPartitionerService {
      /**
       * Gets the single, shared instance of the ContextPartitionerService.
       */
      public static getInstance(): ContextPartitionerService;

      /**
       * Retrieves a named context slice by executing the roberto-mcp binary.
       * @param args An object containing the filePath and sliceName.
       * @returns A promise that resolves with the context package string.
       * @throws An error if the binary cannot be found, fails to execute,
       *         or returns a non-zero exit code.
       */
      public async getContext(args: GetContextArgs): Promise<ContextPackage>;
    }
    ```

*   **Detailed Behavioral Logic (The Algorithm):**
    1.  The `getContext` method is invoked with `filePath` and `sliceName`.
    2.  **Determine Binary Path:** The service will first determine the absolute path to the correct `roberto-mcp` binary located within the extension's packaged `bin/` directory. It does this by inspecting the host environment (e.g., `process.platform` for `win32`, `darwin`, `linux` and `process.arch` for `x64`, `arm64`). If a compatible binary cannot be found at the expected path, the method must immediately throw a `MissingBinaryError`.
    3.  **Spawn Child Process:** The service will spawn the selected binary as a new child process. The `filePath` and `sliceName` from the arguments will be passed as separate, sanitized command-line arguments to the process.
    4.  **Capture and Buffer Output:** The service will attach listeners to the child process's `stdout` and `stderr` streams. All data chunks from `stdout` will be collected and decoded into a single UTF-8 string. All data from `stderr` will be similarly collected.
    5.  **Await Process Completion:** The service will wait for the child process to exit. This will be wrapped in a `Promise`.
    6.  **Evaluate Outcome:**
        *   If the process exits with a code of `0` and `stderr` is empty, the operation is successful. The promise resolves with the complete, buffered `stdout` string.
        *   If the process exits with a non-zero code, or if any data was written to `stderr`, the operation has failed. The promise must be rejected with a detailed `ProcessExecutionError` that includes the exit code and the full contents of `stderr` to facilitate debugging.
    7.  **Timeout:** The entire operation will be wrapped with a timeout (e.g., 10 seconds). If the child process does not exit within this period, it will be forcefully terminated, and the promise will be rejected with a `ProcessTimeoutError`.

*   **Mandatory Testing Criteria:**
    *   The service must throw a specific error if `getContext` is called and a binary for the current test platform cannot be found.
    *   A test must verify that when `getContext` is invoked, a child process is spawned with the exact, expected command-line arguments (e.g., `['/path/to/file.ts', 'slice-name']`).
    *   A test must successfully resolve with the correct string content by mocking a child process that writes to `stdout` and exits with code `0`.
    *   A test must reject with a comprehensive error message by mocking a child process that writes a specific error message to `stderr` and exits with a non-zero code.
    *   A test must verify that the service's promise is rejected if the mocked child process does not exit within the configured timeout period.