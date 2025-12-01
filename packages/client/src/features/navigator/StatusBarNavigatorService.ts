/**
 * @file packages/client/src/features/navigator/StatusBarNavigatorService.ts
 * @stamp 2025-12-01T13:17:00.000Z
 * @architectural-role Feature Entry Point
 * @description Manages the Status Bar UI for context switching and new workflow creation. It acts as the primary user entry point for the multi-root workspace system, ensuring safe transitions between the main project and ephemeral worktrees.
 * @core-principles
 * 1. IS the singleton entry point for user navigation commands.
 * 2. OWNS the state of the Status Bar item and the Quick Pick navigation menu.
 * 3. ORCHESTRATES the safe transition between workspace folders, enforcing existence checks before switching.
 * 4. DELEGATES actual worktree creation and queue management to `WorktreeQueueManager`.
 *
 * @api-declaration
 *   - export interface INavigatorDependencies
 *   - export interface PendingWorkflowState
 *   - export class StatusBarNavigatorService
 *     - constructor(...)
 *     - public initialize(mainProjectRoot: vscode.WorkspaceFolder): void
 *
 * @contract
 *   assertions:
 *     purity: mutates          # Mutates VS Code UI (Status Bar) and Workspace State.
 *     external_io: vscode      # Heavily relies on VS Code Window and Workspace APIs.
 *     state_ownership: ['statusBarItem'] # Owns the UI handle for the indicator.
 */


import * as vscode from 'vscode';
import type { GitWorktreeManager, WorktreeSession } from '../../lib/git/GitWorktreeManager';
import type { WorktreeQueueManager } from '../../lib/workflow/WorktreeQueueManager';
import { logger } from '../../lib/logging/logger';

interface NavigatorItem extends vscode.QuickPickItem {
  id: string;
}

export interface INavigatorDependencies {
  window: {
    createStatusBarItem(alignment?: vscode.StatusBarAlignment, priority?: number): vscode.StatusBarItem;
    showQuickPick<T extends vscode.QuickPickItem>(items: T[] | Thenable<T[]>, options?: vscode.QuickPickOptions): Thenable<T | undefined>;
    showInputBox(options?: vscode.InputBoxOptions): Thenable<string | undefined>;
  };
  workspace: {
    updateWorkspaceFolders(start: number, deleteCount: number | undefined | null, ...workspaceFoldersToAdd: { uri: vscode.Uri; name?: string }[]): boolean;
  };
  commands: {
    registerCommand(command: string, callback: (...args: unknown[]) => unknown): vscode.Disposable;
  };
}

export interface PendingWorkflowState {
  sessionId: string;
  nodeId: string;
  isManualApprovalMode: boolean;
}

export class StatusBarNavigatorService {
  private statusBarItem!: vscode.StatusBarItem;
  private mainProjectRoot!: vscode.WorkspaceFolder;
  public static readonly PENDING_WORKFLOW_KEY = 'roboSmith.pendingWorkflow';

  public constructor(
    private readonly gitWorktreeManager: GitWorktreeManager,
    private readonly worktreeQueueManager: WorktreeQueueManager,
    private readonly context: vscode.ExtensionContext,
    private readonly deps: INavigatorDependencies,
    private readonly subscriptions: vscode.Disposable[]
  ) {}

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
    
    this.updateStatusText();
  }

  private async showNavigator(): Promise<void> {
    const sessions = this.gitWorktreeManager.getAllSessions();
    const items = this.buildQuickPickItems(sessions);
    const selected = await this.deps.window.showQuickPick<NavigatorItem>(items, {
      placeHolder: 'Switch RoboSmith context or create a new workflow...',
    });

    if (!selected) return;

    switch (selected.id) {
      case 'main':
        await this.switchWorkspace(this.mainProjectRoot.uri);
        break;
      case 'createNew':
        await this.createNewWorkflow();
        break;
      default: {
        const session = sessions.find(s => s.sessionId === selected.id);
        if (session) {
          await this.switchWorkspace(vscode.Uri.file(session.worktreePath));
        }
        break;
      }
    }
  }

  private async createNewWorkflow(): Promise<void> {
    const taskName = await this.deps.window.showInputBox({
      prompt: 'Enter a name for the new workflow',
      validateInput: text => (text.trim().length > 0 ? null : 'Name cannot be empty.'),
    });
    if (!taskName) return;

    const modes: NavigatorItem[] = [
      { label: 'Autonomous Mode', description: 'Run continuously (Default)', picked: true, id: 'auto' },
      { label: 'Stepper Mode', description: 'Pause for approval before every step', id: 'manual' }
    ];

    const modeSelection = await this.deps.window.showQuickPick(modes, { placeHolder: 'Select execution mode' });
    if (!modeSelection) return;

    const isManualApprovalMode = modeSelection.id === 'manual';

    try {
      const session = await this.worktreeQueueManager.submitTask({
        baseBranch: 'main',
        changePlan: [], 
      });

      const pendingState: PendingWorkflowState = {
        sessionId: session.sessionId,
        nodeId: 'Implement',
        isManualApprovalMode
      };
      await this.context.globalState.update(StatusBarNavigatorService.PENDING_WORKFLOW_KEY, pendingState);

      logger.info(`Workflow queued and ready. Switching to worktree: ${session.sessionId}`);

      await this.switchWorkspace(vscode.Uri.file(session.worktreePath));

    } catch (error) {
      logger.error('Failed to create or queue new workflow.', { error });
      // Clean up pending state if we failed
      await this.context.globalState.update(StatusBarNavigatorService.PENDING_WORKFLOW_KEY, undefined);
    }
  }

  private buildQuickPickItems(sessions: readonly WorktreeSession[]): NavigatorItem[] {
    const mainProjectItem: NavigatorItem = {
      label: 'My Project',
      description: `(${this.mainProjectRoot.name})`,
      id: 'main',
    };

    const workflowItems: NavigatorItem[] = (sessions || []).map(session => {
      let icon = '⏸️';
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

  private async switchWorkspace(targetUri: vscode.Uri): Promise<void> {
    try {
      // 🛡️ SAFETY SHIELD 🛡️
      // Ensure the directory actually exists before switching.
      // This prevents the "blank screen of death" loop.
      try {
        await vscode.workspace.fs.stat(targetUri);
      } catch (e) {
        const msg = `Cannot switch: Directory not found at ${targetUri.fsPath}`;
        logger.error(msg);
        vscode.window.showErrorMessage("Aborting switch: The worktree folder was not created successfully.");
        return; // <--- The most important line. We stop here if the folder is missing.
      }

      const folders = vscode.workspace.workspaceFolders;
      await this.deps.workspace.updateWorkspaceFolders(0, folders ? folders.length : 0, { uri: targetUri });
      this.updateStatusText(); 
    } catch (error) {
      logger.error('Failed to switch workspace.', { error, targetUri: targetUri.fsPath });
    }
  }

  private updateStatusText(): void {
    const currentRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!currentRoot) return;

    if (currentRoot === this.mainProjectRoot.uri.fsPath) {
        this.statusBarItem.text = '🤖 RoboSmith: My Project (main)';
        return;
    }

    const sessions = this.gitWorktreeManager.getAllSessions();
    const activeSession = sessions.find(s => s.worktreePath === currentRoot);
    
    if (activeSession) {
        this.statusBarItem.text = `🤖 RoboSmith: ${activeSession.branchName}`;
    } else {
        this.statusBarItem.text = '🤖 RoboSmith: (Unknown Context)';
    }
  }
}