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

import * as vscode from 'vscode';
import { SecureStorageService } from './lib/ai/SecureStorageService';
import { ApiPoolManager } from './lib/ai/ApiPoolManager';
import { createEventHandler, type EventHandlerContext } from './events/handler';
import { logger } from './lib/logging/logger';
import type { WorkflowManifest } from './shared/types';
import { ContextPartitionerService } from './lib/context/ContextPartitionerService';
// NEW IMPORTS
import { R_Mcp_ServerManager, type JsonRpcClientFactory } from './lib/context/R_Mcp_ServerManager';
import type { ProcessStreamProvider, JsonRpcClient } from './lib/context/R_Mcp_ServerManager';

// TEMPORARY STUB: This must be replaced with the actual RPC library when chosen.
// For now, it satisfies the dependency on JsonRpcClientFactory.
const MockJsonRpcClientFactory: JsonRpcClientFactory = (_processStreams: ProcessStreamProvider) => {
    // In a real implementation, this would establish the JSON-RPC connection.
    // For now, we return a minimal stub of the client interface.
    return {
        sendCall: (method: string, params: unknown) => {
            logger.debug(`[RPC-STUB] Call: ${method}`, { params });
            return Promise.resolve({});
        },
    } as JsonRpcClient;
};


export async function activate(context: vscode.ExtensionContext) {
  // --- 1. Initialize Logger (Must be first) ---
  logger.initialize(context.extensionMode);
  logger.info('RoboSmith extension activating...');

  // --- 2. Service Instantiation & Initialization (UPDATED FOR R-MCP ARCHITECTURE) ---
  const secureStorageService = new SecureStorageService(context.secrets);
  const apiPoolManager = ApiPoolManager.getInstance(secureStorageService);
  
  // New: Instantiate R_Mcp_ServerManager first, injecting the Mock Factory.
  const rMcpServerManager = R_Mcp_ServerManager.getInstance(MockJsonRpcClientFactory);
  
  // New: Instantiate ContextPartitionerService, injecting the Server Manager.
  const contextPartitionerService = ContextPartitionerService.getInstance(rMcpServerManager);

  await apiPoolManager.initialize();
  logger.info('API Pool Manager initialized.');
  logger.info('Context Partitioner Service architecture assembled.');


  // --- 3. Load and Validate Workflow Manifest ---
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    logger.error('No workspace folder is open. Cannot find workflow manifest.');
    return;
  }
  const manifestUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vision', 'workflows.json');

  let manifest: WorkflowManifest;
  try {
    const rawManifest = await vscode.workspace.fs.readFile(manifestUri);
    const manifestContent = Buffer.from(rawManifest).toString('utf-8');
    manifest = JSON.parse(manifestContent) as WorkflowManifest;
    logger.info('Workflow manifest loaded and parsed successfully.');
  } catch (error) {
    logger.error('Failed to read or parse workflow manifest.', { error });
    return;
  }

  // --- 4. Command Registration ---
  const disposable = vscode.commands.registerCommand('roboSmith.showPanel', () => {
    logger.debug('Showing RoboSmith panel.');
    const panel = vscode.window.createWebviewPanel(
      'roboSmithPanel',
      'RoboSmith',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    // --- 5. Event Handler Context Injection (UPDATED) ---
    const eventHandlerContext: EventHandlerContext = {
      secureStorageService,
      apiManager: apiPoolManager,
      manifest: manifest,
      panel: panel,
      // Pass the fully injected Context Partitioner Service
      contextService: contextPartitionerService,
    };

    // --- 6. Event Handler Registration ---
    const handleEvent = createEventHandler();
    panel.webview.onDidReceiveMessage(
      (message) => handleEvent(message, eventHandlerContext),
      undefined,
      context.subscriptions
    );

    panel.webview.html = getWebviewContent();
  });

  context.subscriptions.push(disposable);
  logger.info('RoboSmith extension activated successfully.');
}

// This function is called when your extension is deactivated
export function deactivate() {
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