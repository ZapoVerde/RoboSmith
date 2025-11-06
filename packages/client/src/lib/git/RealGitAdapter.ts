/**
 * @file packages/client/src/lib/git/RealGitAdapter.ts
 * @stamp S-20251105T195212Z-C-COMPILE-FIX
 * @architectural-role Utility
 * @description Provides the concrete, "real" implementation of the GitAdapter
 * interface. This class encapsulates all direct interactions with the Git CLI,
 * the vscode.workspace.fs API, and vscode.ExtensionContext for state persistence.
 * @core-principles
 * 1. MUST strictly implement the GitAdapter interface.
 * 2. IS the single, authoritative implementation for real Git and FS operations.
 * 3. OWNS all logic for executing external commands and interacting with VS Code APIs.
 *
 * @api-declaration
 *   - export class RealGitAdapter implements GitAdapter
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"
 *     - external_io: "vscode_and_filesystem"
 *     - state_ownership: "none"
 */

import { execa } from 'execa';
// Linter fix: Changed from 'import type' to a standard import to make the
// vscode object available as a value at runtime.
import * as vscode from 'vscode';
import type { GitAdapter } from './IGitAdapter';

export class RealGitAdapter implements GitAdapter {
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public async exec(
    args: string[],
    options: { cwd: string }
  ): Promise<{ stdout: string; stderr: string }> {
    const result = await execa('git', args, options);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  public async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    return vscode.workspace.fs.readDirectory(uri);
  }

  public getGlobalState<T>(key: string): T | undefined {
    return this.context.globalState.get<T>(key);
  }

  public async updateGlobalState(key: string, value: unknown): Promise<void> {
    await this.context.globalState.update(key, value);
  }
}