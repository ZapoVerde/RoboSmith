/**
 * @file packages/client/src/extension.ts
 * @stamp 2025-11-30T19:00:00.000Z
 * @architectural-role Feature Entry Point
 * @description
 * The main activation entry point for the VS Code extension. It serves as the
 * **Composition Root** for the application. Its sole responsibility is to instantiate
 * core services, manage the WebView lifecycle, and wire together the Event Bus.
 * @core-principles
 * 1. IS the definitive Composition Root for the backend application.
 * 2. OWNS the instantiation and lifecycle of all singleton services and the Webview.
 * 3. DELEGATES all feature-specific logic to dedicated service classes.
 *
 * @api-declaration
 *   - export async function activate(context: vscode.ExtensionContext): Promise<void>
 *   - export function deactivate(): void
 *
 * @contract
 *   assertions:
 *     purity: mutates       # Mutates global state (VS Code UI, Singletons).
 *     external_io: vscode   # Interacts with VS Code APIs at the top level.
 *     state_ownership: none # Does not own application state; creates the owners.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from './lib/logging/logger';
import { RealGitAdapter } from './lib/git/RealGitAdapter';
import { GitWorktreeManager } from './lib/git/GitWorktreeManager';
import {
  StatusBarNavigatorService,
  type INavigatorDependencies,
  type PendingWorkflowState
} from './features/navigator/StatusBarNavigatorService';
import { createEventHandler, type EventHandlerContext } from './events/handler';
import { WorkflowService } from './lib/workflow/WorkflowService';
import { SecureStorageService } from './lib/ai/SecureStorageService';
import { ApiPoolManager } from './lib/ai/ApiPoolManager';
import { R_Mcp_ServerManager, type JsonRpcClient } from './lib/context/R_Mcp_ServerManager';
import { ContextPartitionerService } from './lib/context/ContextPartitionerService';
import { RealProcessSpawner } from './lib/context/RealProcessSpawner';
import type { ManagedProcess } from './lib/context/IProcessSpawner';
import { WorktreeQueueManager } from './lib/workflow/WorktreeQueueManager';
import { Orchestrator } from './lib/workflow/Orchestrator';
import type { WorkflowViewState } from './shared/types';

// --- Webview Configuration ---
const VIEW_TYPE = 'roboSmith.mainView';
const WEBVIEW_TITLE = 'RoboSmith Cockpit';

/**
 * The main entry point for the extension, called by VS Code on activation.
 * @param context The extension context provided by VS Code.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.initialize(context.extensionMode);
  logger.info('RoboSmith extension activating...');

  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open. RoboSmith requires a project to be open.');
    }
    const mainProjectRoot = workspaceFolders[0];

    // --- 1. Service Instantiation (Dependency Injection) ---
    
    const gitAdapter = new RealGitAdapter(context);
    const processSpawner = new RealProcessSpawner();
    
    const gitWorktreeManager = new GitWorktreeManager(gitAdapter);
    const secureStorageService = new SecureStorageService(context.secrets);
    
    const apiPoolManager = ApiPoolManager.getInstance(secureStorageService);
    const workflowService = WorkflowService.getInstance();
    
    // Placeholder R-MCP Factory
    const rMcpClientFactory = (_proc: ManagedProcess): JsonRpcClient => ({
        sendCall: async (_method: string, _params: unknown) => Promise.resolve({}) 
    });
    
    const rMcpServerManager = new R_Mcp_ServerManager(processSpawner, rMcpClientFactory);
    const contextPartitioner = ContextPartitionerService.getInstance(rMcpServerManager);

    const worktreeQueueManager = new WorktreeQueueManager(gitWorktreeManager);

    const navigatorDependencies: INavigatorDependencies = {
      window: vscode.window,
      workspace: vscode.workspace,
      commands: vscode.commands,
    };

    const statusBarNavigator = new StatusBarNavigatorService(
      gitWorktreeManager,
      worktreeQueueManager,
      context,
      navigatorDependencies,
      context.subscriptions
    );

    // --- 2. Initialization ---
    await gitWorktreeManager.initialize();
    
    // Initialize API Manager with the log path for the AI Inspector
    const logStoragePath = path.join(mainProjectRoot.uri.fsPath, '.vision', 'logs');
    await apiPoolManager.initialize(logStoragePath);
    
    statusBarNavigator.initialize(mainProjectRoot);

    // --- 3. Webview Management ---
    let currentPanel: vscode.WebviewPanel | undefined = undefined;

    const createOrShowWebview = () => {
      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Two);
        return;
      }

      currentPanel = vscode.window.createWebviewPanel(
        VIEW_TYPE,
        WEBVIEW_TITLE,
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview-ui')),
          ],
          retainContextWhenHidden: true,
        }
      );

      currentPanel.webview.html = getWebviewContent(currentPanel.webview, context.extensionPath);

      // --- 4. Event Bus Wiring ---
      const handleEvent = createEventHandler();

      currentPanel.webview.onDidReceiveMessage(
        async (message) => {
          if (!currentPanel) return;

          const handlerContext: EventHandlerContext = {
            secureStorageService,
            panel: currentPanel,
            manifest: await workflowService.loadWorkflow(mainProjectRoot.uri.fsPath).catch(() => ({})),
            contextService: contextPartitioner,
            apiManager: apiPoolManager,
            worktreeQueueManager,
            gitWorktreeManager,
          };

          await handleEvent(message, handlerContext);
        },
        undefined,
        context.subscriptions
      );

      currentPanel.onDidDispose(
        () => { currentPanel = undefined; },
        null,
        context.subscriptions
      );
    };

    context.subscriptions.push(
      vscode.commands.registerCommand('roboSmith.openCockpit', () => {
        createOrShowWebview();
      })
    );

    // --- 5. Auto-Ignition Logic (The "Reload Gap" Fix) ---
    // Check if we have a pending workflow start from before a window reload.
    const pendingWorkflow = context.globalState.get<PendingWorkflowState>(StatusBarNavigatorService.PENDING_WORKFLOW_KEY);
    
    if (pendingWorkflow) {
        logger.info(`Found pending workflow ignition for session: ${pendingWorkflow.sessionId}`);
        
        // Clear the flag immediately so we don't loop if it crashes
        await context.globalState.update(StatusBarNavigatorService.PENDING_WORKFLOW_KEY, undefined);

        // Verify we are actually in the correct worktree
        const currentRoot = mainProjectRoot.uri.fsPath;
        const activeSession = gitWorktreeManager.getAllSessions().find(s => s.sessionId === pendingWorkflow.sessionId);

        if (activeSession && activeSession.worktreePath === currentRoot) {
            logger.info('Worktree match confirmed. Auto-igniting Orchestrator.');
            createOrShowWebview(); // Open the UI

            // Start the engine!
            const manifest = await workflowService.loadWorkflow(mainProjectRoot.uri.fsPath).catch(() => ({}));
            
            if (currentPanel) {
                const onStateUpdate = (state: WorkflowViewState) => {
                    currentPanel?.webview.postMessage({ command: 'workflowStateUpdate', payload: state });
                };
                const onCompletion = () => {
                    logger.info(`Workflow ${pendingWorkflow.sessionId} completed.`);
                    currentPanel?.webview.postMessage({
                        command: 'taskReadyForIntegration',
                        payload: {
                            sessionId: pendingWorkflow.sessionId,
                            branchName: activeSession.branchName,
                            commitMessage: 'Auto-generated changes',
                            changedFiles: activeSession.changePlan
                        }
                    });
                };

                const orchestrator = new Orchestrator(
                    manifest,
                    contextPartitioner,
                    apiPoolManager,
                    onStateUpdate,
                    onCompletion,
                    pendingWorkflow.isManualApprovalMode
                );
                
                void orchestrator.executeNode(pendingWorkflow.nodeId, activeSession.worktreePath);
            }
        } else {
            logger.warn('Pending workflow found, but current workspace does not match session path. Ignition aborted.');
        }
    }

    // Standard session detection (open UI if in a session, but don't auto-run unless pending)
    const activeSessions = gitWorktreeManager.getAllSessions();
    const currentRoot = mainProjectRoot.uri.fsPath;
    const isRoboSession = activeSessions.some(s => s.worktreePath === currentRoot);

    if (isRoboSession && !pendingWorkflow) {
        logger.info('Active RoboSmith session detected. Opening Cockpit.');
        createOrShowWebview();
    }

    logger.info('RoboSmith extension activated successfully.');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to activate RoboSmith extension: ${errorMessage}`);
    vscode.window.showErrorMessage(`RoboSmith failed to start: ${errorMessage}`);
  }
}

export function deactivate(): void {
  logger.info('RoboSmith extension deactivated.');
}

function getWebviewContent(webview: vscode.Webview, extensionPath: string): string {
  const scriptPathOnDisk = vscode.Uri.file(
    path.join(extensionPath, 'out', 'webview-ui', 'assets', 'index.js')
  );
  const stylePathOnDisk = vscode.Uri.file(
    path.join(extensionPath, 'out', 'webview-ui', 'assets', 'index.css')
  );

  const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
  const styleUri = webview.asWebviewUri(stylePathOnDisk);
  const nonce = getNonce();

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>${WEBVIEW_TITLE}</title>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
  </html>`;
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}