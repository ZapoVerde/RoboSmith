/**
 * @file packages/client/src/extension.ts
 * @stamp S-20251105T164000Z-C-INJECTION-FIX
 * @architectural-role Feature Entry Point
 * @description The main activation entry point for the VS Code extension. It is responsible for initializing all singleton services and setting up the application's composition root.
 * @core-principles
 * 1. IS the composition root for the entire backend application.
 * 2. OWNS the initialization and lifecycle of all singleton services.
 * 3. DELEGATES all ongoing work to other services after initialization.
 *
 * @api-declaration
 *   - export function activate(context: vscode.ExtensionContext): void
 *   - export function deactivate(): void
 *
 * @contract
 *   assertions:
 *     purity: "mutates"
 *     external_io: "vscode"
 *     state_ownership: "none"
 */
/**
 * @file packages/client/src/extension.ts
 * @stamp S-20251106T150000Z-C-COMPOSITION-ROOT-FIX
 * @architectural-role Feature Entry Point
 * @description The main activation entry point for the VS Code extension. It is responsible for initializing all singleton services and setting up the application's composition root.
 * @core-principles
 * 1. IS the composition root for the entire backend application.
 * 2. OWNS the initialization and lifecycle of all singleton services.
 * 3. DELEGATES all ongoing work to other services after initialization.
 */

import * as vscode from 'vscode';
import { SecureStorageService } from './lib/ai/SecureStorageService';
import { ApiPoolManager } from './lib/ai/ApiPoolManager';
import { createEventHandler, type EventHandlerContext } from './events/handler';
import { logger } from './lib/logging/logger';
import type { WorkflowManifest } from './shared/types';
import { ContextPartitionerService } from './lib/context/ContextPartitionerService';
// --- REFACTOR-RELATED IMPORT CHANGES ---
import { R_Mcp_ServerManager, type JsonRpcClientFactory, type JsonRpcClient } from './lib/context/R_Mcp_ServerManager';
import { RealProcessSpawner } from './lib/context/RealProcessSpawner';
import type { ManagedProcess } from './lib/context/IProcessSpawner';

// TEMPORARY STUB: This must be replaced with the actual RPC library when chosen.
const MockJsonRpcClientFactory: JsonRpcClientFactory = (_process: ManagedProcess): JsonRpcClient => {
    return {
        sendCall: (method: string, params: unknown) => {
            logger.debug(`[RPC-STUB] Call: ${method}`, { params });
            // In a real scenario, you'd handle responses, e.g., for 'index_code'.
            return Promise.resolve({ status: 'ok' });
        },
    };
};

export async function activate(context: vscode.ExtensionContext) {
  // --- 1. Initialize Logger (Must be first) ---
  logger.initialize(context.extensionMode);
  logger.info('RoboSmith extension activating...');

  // --- 2. Composition Root: Service Instantiation & Dependency Injection ---
  logger.info('Instantiating services...');
  
  // Low-level, concrete adapters are created first.
  const realProcessSpawner = new RealProcessSpawner();

  // High-level services are now instantiated by injecting their dependencies.
  // This is the single source of truth for service instances.
  const secureStorageService = new SecureStorageService(context.secrets);
  const apiPoolManager = ApiPoolManager.getInstance(secureStorageService); // This one retains its singleton for now.
  const rMcpServerManager = new R_Mcp_ServerManager(realProcessSpawner, MockJsonRpcClientFactory);
  const contextPartitionerService = new ContextPartitionerService(rMcpServerManager);

  // --- 3. Service Initialization ---
  await apiPoolManager.initialize();
  logger.info('All services instantiated. API Pool Manager initialized.');

  // --- 4. Load and Validate Workflow Manifest ---
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    logger.error('No workspace folder is open. Cannot find workflow manifest.');
    vscode.window.showErrorMessage('RoboSmith: No workspace folder open.');
    return;
  }
  const manifestUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vision', 'workflows.json');

  let manifest: WorkflowManifest;
  try {
    const rawManifest = await vscode.workspace.fs.readFile(manifestUri);
    manifest = JSON.parse(Buffer.from(rawManifest).toString('utf-8')) as WorkflowManifest;
    logger.info('Workflow manifest loaded and parsed successfully.');
  } catch (error) {
    logger.error('Failed to read or parse workflow manifest.', { error });
    vscode.window.showErrorMessage('RoboSmith: Failed to load .vision/workflows.json.');
    return;
  }

  // --- 5. Command Registration ---
  const disposable = vscode.commands.registerCommand('roboSmith.showPanel', () => {
    const panel = vscode.window.createWebviewPanel(
      'roboSmithPanel', 'RoboSmith', vscode.ViewColumn.One, { enableScripts: true }
    );

    const eventHandlerContext: EventHandlerContext = {
      secureStorageService,
      apiManager: apiPoolManager,
      manifest: manifest,
      panel: panel,
      contextService: contextPartitionerService, // Pass the fully constructed service instance.
    };

    const handleEvent = createEventHandler();
    panel.webview.onDidReceiveMessage(
      (message) => { void handleEvent(message, eventHandlerContext); },
      undefined,
      context.subscriptions
    );

    panel.webview.html = getWebviewContent();
  });

  context.subscriptions.push(disposable);
  logger.info('RoboSmith extension activated successfully.');
}

export function deactivate(): void {
  logger.info('RoboSmith extension deactivated.');
}

/**
 * A placeholder for the webview's HTML content.
 */
function getWebviewContent() {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>RoboSmith</title>
  </head>
  <body>
      <h1>RoboSmith Panel</h1>
      <p>UI will be rendered here.</p>
  </body>
  </html>`;
}