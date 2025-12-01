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

import * as vscode from 'vscode';
import type { GitAdapter } from './IGitAdapter';

export class RealGitAdapter implements GitAdapter {
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public async exec(
    args: string[],
    options: { cwd: string }
  ): Promise<{ stdout: string; stderr: string }> {
    const commandString = `git ${args.map((a) => `"${a}"`).join(' ')}`;

    const shellExecution = new vscode.ShellExecution(commandString, {
      cwd: options.cwd,
    });

    const taskDefinition: vscode.TaskDefinition = {
      type: 'robosmith-git',
      script: 'git',
    };

    const task = new vscode.Task(
      taskDefinition,
      vscode.TaskScope.Workspace,
      'Git Operation',
      'RoboSmith',
      shellExecution
    );

    // CRITICAL: Force the terminal to open so you see auth prompts
    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      focus: true,
      panel: vscode.TaskPanelKind.Shared,
      showReuseMessage: false,
      clear: true,
    };

    try {
      // 60s timeout to prevent infinite hangs
      const exitCode = await this.runTaskWithTimeout(task, 60000);

      if (exitCode !== 0) {
        throw new Error(
          `Git command failed with exit code ${exitCode}. Check the "RoboSmith" terminal.`
        );
      }

      // Tasks don't return stdout, but success (exitCode 0) is enough for our logic.
      return { stdout: '', stderr: '' };
    } catch (error) {
      vscode.window.showErrorMessage('RoboSmith Git operation failed. Check the Terminal.');
      throw error;
    }
  }

  private runTaskWithTimeout(task: vscode.Task, timeoutMs: number): Promise<number> {
    return new Promise((resolve, reject) => {
      let disposable: vscode.Disposable;
      let timer: NodeJS.Timeout;

      // 1. Setup Timeout
      timer = setTimeout(() => {
        disposable?.dispose();
        reject(new Error(`Git operation timed out. Please check the terminal for authentication prompts.`));
      }, timeoutMs);

      // 2. Setup Listener
      disposable = vscode.tasks.onDidEndTaskProcess((e) => {
        if (
          e.execution.task.definition.type === task.definition.type &&
          e.execution.task.name === task.name &&
          e.execution.task.source === task.source
        ) {
          clearTimeout(timer);
          disposable.dispose();
          resolve(e.exitCode ?? 0);
        }
      });

      // 3. Start Execution
      // Fix: Use .then(null, onRejected) to handle errors on Thenable types without .catch
      vscode.tasks.executeTask(task).then(
        () => {
          // Task execution started (process not finished yet)
        },
        (err: unknown) => {
          clearTimeout(timer);
          disposable.dispose();
          reject(err);
        }
      );
    });
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