/**
 * @file packages/client/src/lib/git/IGitAdapter.ts
 * @stamp S-20251105T195212Z-C-CORRECTED
 * @architectural-role Type Definition
 * @description Defines the abstract contract for all Git, file system, and state
 * persistence operations. It is the architectural boundary between the
 * GitWorktreeManager's pure orchestration logic and the underlying system I/O.
 * @core-principles
 * 1. IS the single, authoritative contract for Git and file system abstractions.
 * 2. ENFORCES the Dependency Inversion Principle for all consuming services.
 * 3. MUST NOT contain any concrete implementations or executable logic.
 *
 * @api-declaration
 *   - export interface GitAdapter
 *
 * @contract
 *   assertions:
 *     - purity: "pure"
 *     - external_io: "none"
 *     - state_ownership: "none"
 */

import type * as vscode from 'vscode';

/**
 * @id packages/client/src/lib/git/IGitAdapter.ts#GitAdapter
 * @description Defines the complete, abstract contract for all Git, file system,
 * and state persistence operations. It is the boundary between the GitWorktreeManager's
 * pure orchestration logic and the "messy" details of the underlying system.
 */
export interface GitAdapter {
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