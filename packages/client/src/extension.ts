/**
 * @file packages/client/src/extension.ts
 * @stamp 2025-12-01T11:00:00.000Z
 * @architectural-role Feature Entry Point
 * @description The main activation entry point for the VS Code extension.
 * @core-principles
 * 1. IS the definitive Composition Root for the backend application.
 * 2. OWNS the instantiation and lifecycle of all singleton services.
 * 3. LOGS verbose checkpoints to the Debug Console to diagnose activation stalls.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { RealJsonRpcClient } from './lib/context/RealJsonRpcClient';
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

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // [DEBUG] Checkpoint 0: Entry
  console.log('[RoboSmith] Extension activation started.'); 
  
  logger.initialize(context.extensionMode);
  logger.info('RoboSmith extension activating...');

  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('RoboSmith: Please open a folder/project to start.');
      return; 
    }
    const mainProjectRoot = workspaceFolders[0];

    // --- 1. Service Instantiation ---
    console.log('[RoboSmith] Instantiating services...');
    
    const gitAdapter = new RealGitAdapter(context);
    const processSpawner = new RealProcessSpawner();
    
    const gitWorktreeManager = new GitWorktreeManager(gitAdapter);
    const secureStorageService = new SecureStorageService(context.secrets);
    
    const apiPoolManager = ApiPoolManager.getInstance(secureStorageService);
    const workflowService = WorkflowService.getInstance();
    
    // Resolve Binary Path
    const binaryPath = path.join(
      context.extensionPath,
      'packages',
      'client',
      'bin',
      getBinaryName()
    );

    const rMcpClientFactory = (proc: ManagedProcess): JsonRpcClient => {
      return new RealJsonRpcClient(proc);
    };

    const rMcpServerManager = new R_Mcp_ServerManager(
      processSpawner,
      rMcpClientFactory,
      binaryPath
    );
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
    console.log('[RoboSmith] Initializing GitWorktreeManager...');
    await gitWorktreeManager.initialize();
    
    console.log('[RoboSmith] Initializing ApiPoolManager...');
    const logStoragePath = path.join(mainProjectRoot.uri.fsPath, '.vision', 'logs');
    await apiPoolManager.initialize(logStoragePath);
    
    console.log('[RoboSmith] Initializing Status Bar...');
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

    // --- 5. Command Registration ---
    console.log('[RoboSmith] Registering commands...');

    context.subscriptions.push(
      vscode.commands.registerCommand('roboSmith.openCockpit', () => {
        createOrShowWebview();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('roboSmith.showAiCallInspector', async () => {
        createOrShowWebview();
        
        try {
          const logs = await apiPoolManager.getHistory();
          if (currentPanel) {
            currentPanel.webview.postMessage({
              command: 'showAiCallInspector',
              payload: { logs }
            });
          }
        } catch (error) {
          logger.error('Failed to load AI call history.', { error });
          vscode.window.showErrorMessage('Failed to load AI Call Inspector history.');
        }
      })
    );

    // --- 6. Auto-Ignition Logic ---
    console.log('[RoboSmith] Checking auto-ignition state...');
    const pendingWorkflow = context.globalState.get<PendingWorkflowState>(StatusBarNavigatorService.PENDING_WORKFLOW_KEY);
    
    if (pendingWorkflow) {
        logger.info(`Found pending workflow ignition for session: ${pendingWorkflow.sessionId}`);
        await context.globalState.update(StatusBarNavigatorService.PENDING_WORKFLOW_KEY, undefined);

        const currentRoot = mainProjectRoot.uri.fsPath;
        const activeSession = gitWorktreeManager.getAllSessions().find(s => s.sessionId === pendingWorkflow.sessionId);

        if (activeSession && activeSession.worktreePath === currentRoot) {
            logger.info('Worktree match confirmed. Auto-igniting Orchestrator.');
            createOrShowWebview();

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
        }
    }

    // --- 7. UX: Default Activation ---
    console.log('[RoboSmith] Opening default view...');
    createOrShowWebview();

    logger.info('RoboSmith extension activated successfully.');
    console.log('[RoboSmith] Activation complete.');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[RoboSmith] Activation FAILED:', errorMessage);
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

function getBinaryName(): string {
  const platform = os.platform();
  if (platform === 'linux') {
    return 'roberto-mcp-linux-x64';
  }
  throw new Error(`Unsupported platform: ${platform}`);
}