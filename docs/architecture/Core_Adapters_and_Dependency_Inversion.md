
---

# **Architecture: Core I/O Adapters & Dependency Inversion**

## 1. High-Level Summary & Rationale

This document is the canonical specification for the core I/O adapter interfaces used throughout the RoboSmith project. It formally establishes the architectural boundary between high-level orchestration logic and low-level, platform-specific implementation details.

The purpose of this pattern is to enforce the **Dependency Inversion Principle**. Our high-level services, such as the `GitWorktreeManager` and `R_Mcp_ServerManager`, must not depend on the volatile, concrete details of external I/O (like the Git CLI, the file system, or child processes). Instead, they depend on stable, abstract interfaces.

This architectural choice is non-negotiable and provides three primary benefits:
1.  **Extreme Testability:** It allows all complex orchestration logic to be unit-tested against fast, deterministic, in-memory mocks, increasing test suite speed by orders of magnitude.
2.  **Enhanced Maintainability:** It isolates fragile, platform-specific code into a few, well-defined "Real" adapter implementations. Changes to low-level APIs no longer ripple through the entire application.
3.  **Increased Development Velocity:** It allows for parallel implementation, where the core business logic can be completed and verified before the low-level "plumbing" is written.

## 2. The `IGitAdapter` Specification

This interface is the sole abstraction layer for all interactions related to Git command execution, file system reads, and state persistence. The `GitWorktreeManager` depends exclusively on this contract.

```typescript
import type * as vscode from 'vscode';

/**
 * @id docs/architecture/Core_Adapters_and_Dependency_Inversion.md#IGitAdapter
 * @description Defines the complete, abstract contract for all Git, file system,
 * and state persistence operations. It is the boundary between the GitWorktreeManager's
 * pure orchestration logic and the "messy" details of the underlying system.
 */
export interface IGitAdapter {
  /**
   * Executes a raw command-line process, intended for Git commands.
   * @param args An array of string arguments for the command (e.g., ['worktree', 'add', ...]).
   * @param options The execution options, including the current working directory.
   * @returns A promise that resolves with the captured stdout and stderr.
   */
  exec(args: string[], options: { cwd: string }): Promise<{ stdout: string; stderr: string }>;

  /**
   * Reads the contents of a directory from the file system.
   * Used by the reconciliation loop to get the ground truth of what worktrees exist.
   * @param uri The URI of the directory to read.
   * @returns A promise that resolves with an array of [name, fileType] tuples.
   */
  readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]>;

  /**
   * Retrieves a value from the extension's persistent global state.
   * @param key The key of the value to retrieve.
   * @returns The stored value, or undefined if not found.
   */
  getGlobalState<T>(key: string): T | undefined;

  /**
   * Stores or updates a value in the extension's persistent global state.
   * @param key The key to store the value under.
   * @param value The value to be stored.
   */
  updateGlobalState(key: string, value: unknown): Promise<void>;
}
```

## 3. The Process Spawning Adapter Specifications

This set of interfaces abstracts away the complexity of managing `child_process` instances, providing a clean, testable boundary for the `R_Mcp_ServerManager`.

### 3.1. `IManagedProcess`

This interface represents a running child process, exposing only the streams and controls necessary for communication and lifecycle management.

```typescript
import type { Readable, Writable } from 'stream';
import type { ChildProcess } from 'child_process';

/**
 * @id docs/architecture/Core_Adapters_and_Dependency_Inversion.md#IManagedProcess
 * @description An abstract representation of a spawned child process. It exposes the
 * I/O streams required for IPC communication and the core lifecycle methods,
 * without exposing the entire, complex ChildProcess object.
 */
export interface IManagedProcess {
  /** The standard input stream of the process, used for sending data. */
  readonly stdin: Writable | null;
  /** The standard output stream of the process, used for receiving data. */
  readonly stdout: Readable | null;
  /** The standard error stream, for capturing logs and errors. */
  readonly stderr: Readable | null;
  /** The method for registering event listeners (e.g., 'error', 'close'). */
  on: ChildProcess['on'];
  /** The method for terminating the process. */
  kill: ChildProcess['kill'];
}```

### 3.2. `IProcessSpawner`

This is the factory interface responsible for creating `IManagedProcess` instances. It is the only component in the system that is allowed to know about the `child_process` module.

```typescript
/**
 * @id docs/architecture/Core_Adapters_and_Dependency_Inversion.md#IProcessSpawner
 * @description Defines the contract for a factory that spawns child processes.
 * The R_Mcp_ServerManager depends on this interface to create new r-mcp
 * server instances in a testable way.
 */
export interface IProcessSpawner {
  /**
   * Spawns a new child process.
   * @param binaryPath The absolute path to the executable to run.
   * @param cwd The current working directory for the new process.
   * @returns An IManagedProcess instance representing the running process.
   */
  spawn(binaryPath: string, cwd: string): IManagedProcess;
}
```

## 4. The `IJsonRpcClient` Specification

This interface defines the contract for a JSON-RPC client that operates over the streams of an `IManagedProcess`.

```typescript
/**
 * @id docs/architecture/Core_Adapters_and_Dependency_Inversion.md#IJsonRpcClient
 * @description Defines the contract for sending and receiving JSON-RPC messages
 * over a given transport, such as the stdio streams of a child process.
 */
export interface IJsonRpcClient {
  /**
   * Sends a JSON-RPC method call to the server.
   * @param method The name of the RPC method to call (e.g., 'index_code').
   * @param params The parameters for the method call.
   * @returns A promise that resolves with the result from the server.
   */
  sendCall(method: string, params: unknown): Promise<unknown>;
}

/**
 * @id docs/architecture/Core_Adapters_and_Dependency_Inversion.md#JsonRpcClientFactory
 * @description Defines a factory function that creates an IJsonRpcClient from a process.
 */
export type JsonRpcClientFactory = (process: IManagedProcess) => IJsonRpcClient;
```

## 5. Implementation & Dependency Injection Strategy

These interfaces define the abstract boundaries. The concrete, "real" implementations will live in separate files (e.g., `RealGitAdapter.ts`, `RealProcessSpawner.ts`).

All high-level services (`GitWorktreeManager`, `R_Mcp_ServerManager`, etc.) **MUST** receive their adapter dependencies via their constructor. The responsibility for creating the "Real" adapters and injecting them into the services belongs exclusively to the **composition root** of the application, located in the main `extension.ts` file's `activate` function.