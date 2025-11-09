/**
 * @file packages/client/src/features/navigator/StatusBarNavigatorService.ts
 * @stamp S-20251107T184500Z-C-TYPE-FIX-APPLIED
 * @architectural-role Feature Entry Point
 * @description
 * Encapsulates all logic for the Status Bar Navigator UI feature. It is responsible for
 * creating the status bar item, handling user clicks, rendering the QuickPick menu,
 * and orchestrating workspace switches. It is designed for complete testability
 * by injecting all external dependencies, including VS Code API abstractions.
 * @core-principles
 * 1. OWNS the complete lifecycle and logic for the Status Bar Navigator feature.
 * 2. DELEGATES all Git operations to the injected GitWorktreeManager.
 * 3. MUST be fully isolated from other features and testable via dependency injection.
 *
 * @api-declaration
 *   - export class StatusBarNavigatorService
 *
 * @contract
 *   assertions:
 *     purity: "mutates"       # Manages its own state (e.g., the statusBarItem).
 *     external_io: "vscode"   # Interacts with the VS Code UI and workspace APIs.
 *     state_ownership: "['statusBarItem']"
 */

import * as vscode from 'vscode';
import type { GitWorktreeManager, WorktreeSession } from '../../lib/git/GitWorktreeManager';
import { logger } from '../../lib/logging/logger';

/**
 * @id packages/client/src/features/navigator/StatusBarNavigatorService.ts#NavigatorItem
 * @description A specialized QuickPickItem that includes a unique `id` for identifying the user's selection.
 */
interface NavigatorItem extends vscode.QuickPickItem {
  id: string; // 'main', 'createNew', or a sessionId
}

/**
 * @id packages/client/src/features/navigator/StatusBarNavigatorService.ts#INavigatorDependencies
 * @description Defines an explicit contract for the VS Code APIs this service depends on.
 * This is the key to making the service highly testable, as a mock implementation
 * of this interface can be injected during tests.
 */
export interface INavigatorDependencies {
  window: {
    createStatusBarItem(alignment?: vscode.StatusBarAlignment, priority?: number): vscode.StatusBarItem;
    showQuickPick<T extends vscode.QuickPickItem>(items: T[] | Thenable<T[]>, options?: vscode.QuickPickOptions): Thenable<T | undefined>;
    showInputBox(options?: vscode.InputBoxOptions): Thenable<string | undefined>;
  };
  workspace: {
    // FIX: Changed the return type from `Thenable<boolean>` to `boolean` to match
    // the actual signature of the `vscode.workspace.updateWorkspaceFolders` API.
    updateWorkspaceFolders(start: number, deleteCount: number | undefined | null, ...workspaceFoldersToAdd: { uri: vscode.Uri; name?: string }[]): boolean;
  };
  commands: {
    registerCommand(command: string, callback: (...args: unknown[]) => unknown): vscode.Disposable;
  };
}

export class StatusBarNavigatorService {
  private statusBarItem!: vscode.StatusBarItem;
  private mainProjectRoot!: vscode.WorkspaceFolder;

  /**
   * Constructs the service with its dependencies.
   * @param gitWorktreeManager The service for managing Git worktrees.
   * @param deps An object providing abstracted VS Code API functions for testability.
   * @param subscriptions A reference to the extension's subscriptions array for disposable management.
   */
  public constructor(
    private readonly gitWorktreeManager: GitWorktreeManager,
    private readonly deps: INavigatorDependencies,
    private readonly subscriptions: vscode.Disposable[]
  ) {}

  /**
   * Initializes the feature: creates the status bar item and registers the command.
   * This is the single entry point called from the extension's `activate` function.
   */
  public initialize(mainProjectRoot: vscode.WorkspaceFolder): void {
    this.mainProjectRoot = mainProjectRoot;

    this.statusBarItem = this.deps.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.command = 'roboSmith.showNavigator';
    this.statusBarItem.text = '🤖 RoboSmith: My Project (main)';
    this.statusBarItem.tooltip = 'Show RoboSmith Navigator';
    this.statusBarItem.show();

    this.subscriptions.push(
      this.statusBarItem,
      this.deps.commands.registerCommand('roboSmith.showNavigator', () => this.showNavigator())
    );
  }

  /**
   * The core command handler. It builds and displays the QuickPick menu, then
   * acts on the user's selection.
   */
  private async showNavigator(): Promise<void> {
    const sessions = this.gitWorktreeManager.getAllSessions();
    const items = this.buildQuickPickItems(sessions);
    const selected = await this.deps.window.showQuickPick<NavigatorItem>(items, {
      placeHolder: 'Switch RoboSmith context or create a new workflow...',
    });

    if (!selected) {
      logger.debug('Navigator QuickPick was cancelled by the user.');
      return;
    }

    switch (selected.id) {
      case 'main':
        await this.switchWorkspace(this.mainProjectRoot.uri, '🤖 RoboSmith: My Project (main)');
        break;
      case 'createNew':
        await this.createNewWorkflow();
        break;
      default: {
        const session = sessions.find(s => s.sessionId === selected.id);
        if (session) {
          await this.switchWorkspace(
            vscode.Uri.file(session.worktreePath),
            `🤖 RoboSmith: ${session.branchName}`
          );
        }
        break;
      }
    }
  }

  /**
   * Orchestrates the creation of a new workflow session.
   */
  private async createNewWorkflow(): Promise<void> {
    const taskName = await this.deps.window.showInputBox({
      prompt: 'Enter a short name for the new workflow',
      validateInput: text => (text.trim().length > 0 ? null : 'Name cannot be empty.'),
    });

    if (!taskName) {
      logger.debug('Create new workflow was cancelled at the input box.');
      return;
    }

    try {
      // For V1, the change plan and base branch are hardcoded, but this is where
      // more complex logic would go in the future.
      const newSession = await this.gitWorktreeManager.createWorktree({
        baseBranch: 'main',
        changePlan: [], // Initially empty for a new task
      });

      await this.switchWorkspace(
        vscode.Uri.file(newSession.worktreePath),
        `🤖 RoboSmith: ${newSession.branchName}`
      );
    } catch (error) {
      logger.error('Failed to create new worktree.', { error });
      // This is where you would show an error message to the user, also through the dependency interface.
      // e.g., this.deps.window.showErrorMessage(...)
    }
  }

  /**
   * Builds the list of items to display in the QuickPick menu.
   * @param sessions The list of currently active worktree sessions.
   * @returns A formatted array of NavigatorItem objects.
   */
  private buildQuickPickItems(sessions: readonly WorktreeSession[]): NavigatorItem[] {
    const mainProjectItem: NavigatorItem = {
      label: 'My Project',
      description: `(${this.mainProjectRoot.name})`,
      id: 'main',
    };

    const workflowItems: NavigatorItem[] = (sessions || []).map(session => {
      let icon = '⏸️'; // Held
      if (session.status === 'Running') icon = '▶️';
      if (session.status === 'Queued') icon = '⏳';

      return {
        label: `(${icon}) ${session.branchName}`,
        description: `ID: ${session.sessionId.slice(0, 8)}`,
        id: session.sessionId,
      };
    });

    const createNewItem: NavigatorItem = { label: '[+] Create New Workflow...', id: 'createNew' };

    return [
      mainProjectItem,
      { label: 'Workflows', kind: vscode.QuickPickItemKind.Separator, id: 'sep1' },
      ...workflowItems,
      { label: '', kind: vscode.QuickPickItemKind.Separator, id: 'sep2' },
      createNewItem,
    ];
  }

  /**
   * Atomically switches the visible workspace folder and updates the status bar text.
   * @param targetUri The URI of the folder to make visible.
   * @param newStatusText The new text to display in the status bar.
   */
  private async switchWorkspace(targetUri: vscode.Uri, newStatusText: string): Promise<void> {
    try {
      const folders = vscode.workspace.workspaceFolders;
      // The await here is not strictly necessary for a boolean return, but it does no harm and keeps the async signature.
      await this.deps.workspace.updateWorkspaceFolders(0, folders ? folders.length : 0, { uri: targetUri });
      this.statusBarItem.text = newStatusText;
      logger.info(`Switched workspace view to: ${targetUri.fsPath}`);
    } catch (error) {
      logger.error('Failed to switch workspace.', { error, targetUri: targetUri.fsPath });
    }
  }
}