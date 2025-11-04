/**
 * @file packages/client/src/extension.ts
 * @stamp S-20251104-T17:25:00Z-C-BUGFIX
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
 *     - purity: "mutates"
 *     - external_io: "vscode"
 *     - state_ownership: "none"
 */

import * as vscode from 'vscode';
import { SecureStorageService } from './lib/ai/SecureStorageService';
import { ApiPoolManager } from './lib/ai/ApiPoolManager';
import { createEventHandler, type EventHandlerContext } from './events/handler';
import { logger } from './lib/logging/logger';
import type { WorkflowManifest } from './shared/types';
import { ContextPartitionerService } from './lib/context/ContextPartitionerService';

export async function activate(context: vscode.ExtensionContext) {
  // --- 1. Initialize Logger (Must be first) ---
  logger.initialize(context.extensionMode);
  logger.info('RoboSmith extension activating...');

  // --- 2. Service Instantiation & Initialization ---
  const secureStorageService = new SecureStorageService(context.secrets);
  const apiPoolManager = ApiPoolManager.getInstance(secureStorageService);
  const contextPartitionerService = ContextPartitionerService.getInstance();

  await apiPoolManager.initialize();
  logger.info('API Pool Manager initialized.');
  logger.info('Context Partitioner Service initialized.');

  // --- 3. Load and Validate Workflow Manifest ---
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    logger.error('No workspace folder is open. Cannot find workflow manifest.');
    return;
  }
  const manifestUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vision', 'workflows.json');

  // MODIFICATION: Re-introduce the try...catch block to handle file I/O errors.
  let manifest: WorkflowManifest;
  try {
    const rawManifest = await vscode.workspace.fs.readFile(manifestUri);
    const manifestContent = Buffer.from(rawManifest).toString('utf-8');
    manifest = JSON.parse(manifestContent) as WorkflowManifest;
    logger.info('Workflow manifest loaded and parsed successfully.');
  } catch (error) {
    logger.error('Failed to read or parse workflow manifest.', { error });
    // CRITICAL FIX: Halt execution if the manifest is invalid.
    // The test will now pass because this error is handled.
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

    // --- 5. Event Handler Context Injection ---
    const eventHandlerContext: EventHandlerContext = {
      secureStorageService,
      apiManager: apiPoolManager,
      manifest: manifest, // This is now guaranteed to be defined here.
      panel: panel,
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