/**
 * @file packages/client/src/lib/context/IProcessSpawner.ts
 * @stamp S-20251105T195212Z-C-ARCH-REFACTOR
 * @architectural-role Type Definition
 * @description Defines the abstract, minimal contract for spawning and managing child
 * processes. It is the architectural boundary that decouples the R_Mcp_ServerManager
 * from the Node.js 'child_process' module.
 * @core-principles
 * 1. IS the single, authoritative contract for process spawning abstractions.
 * 2. ENFORCES the Dependency Inversion Principle for the R_Mcp_ServerManager.
 * 3. MUST define only the minimal set of methods required by consumers.
 *
 * @api-declaration
 *   - export interface ManagedProcess
 *   - export interface ProcessSpawner
 *
 * @contract
 *   assertions:
 *     - purity: "pure"
 *     - external_io: "none"
 *     - state_ownership: "none"
 */

import type { Writable, Readable } from 'stream';

/**
 * @id packages/client/src/lib/context/IProcessSpawner.ts#ManagedProcess
 * @description A minimal, abstract representation of a spawned child process. It
 * exposes only the I/O streams and lifecycle events required by the application,
 * creating a stable and easily mockable dependency.
 */
export interface ManagedProcess {
  /** The standard input stream of the process. */
  readonly stdin: Writable | null;
  /** The standard output stream of the process. */
  readonly stdout: Readable | null;
  /** The standard error stream of the process. */
  readonly stderr: Readable | null;

  /**
   * Registers a listener for the 'error' event, which is critical for
   * handling spawn failures.
   */
  on(event: 'error', listener: (err: Error) => void): this;
  /**
   * Registers a listener for the 'exit' event, used for cleanup.
   */
  on(event: 'exit', listener: (code: number | null) => void): this;

  /**
   * Terminates the process.
   * @param signal The signal to send to the process.
   */
  kill(signal?: NodeJS.Signals | number): boolean;
}

/**
 * @id packages/client/src/lib/context/IProcessSpawner.ts#ProcessSpawner
 * @description Defines the contract for a factory that spawns child processes that
 * conform to the minimal ManagedProcess interface.
 */
export interface ProcessSpawner {
  /**
   * Spawns a new child process.
   * @param binaryPath The absolute path to the executable to run.
   * @param cwd The current working directory for the new process.
   * @returns A ManagedProcess instance representing the running process.
   */
  spawn(binaryPath: string, cwd: string): ManagedProcess;
}