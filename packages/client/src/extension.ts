/**
 * @file packages/client/src/extension.ts
 * @stamp S-20251101-T132500Z-C-MODIFIED
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
 *     - purity: "mutates"       # This function has side effects, registering commands and initializing services.
 *     - external_io: "vscode"   # Interacts with the VS Code API.
 *     - state_ownership: "none" # It instantiates stateful services but does not own state itself.
 */

import * as vscode from 'vscode';
import { SecureStorageService } from './lib/ai/SecureStorageService';
import { ApiPoolManager } from './lib/ai/ApiPoolManager';
import { handleEvent, type EventHandlerContext } from './events/handler';
import { logger } from './lib/logging/logger';

// This function is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
  // --- 1. Initialize Logger (Must be first) ---
  // The logger is initialized immediately so it can be used by all other services during their startup.
  logger.initialize(context.extensionMode);
  logger.info('RoboSmith extension activating...');

  // --- 2. Service Instantiation & Initialization ---
  const secureStorageService = new SecureStorageService(context.secrets);
  const apiPoolManager = ApiPoolManager.getInstance(secureStorageService);

  // Load stored API keys into memory at startup.
  await apiPoolManager.initialize();
  logger.info('API Pool Manager initialized.');

  // Create the context object that will be injected into the event handler.
  // This contains all necessary dependencies for handling events.
  const eventHandlerContext: EventHandlerContext = {
    secureStorageService,
  };

  // --- 3. Command Registration ---
  // Register a command that will create and show a webview panel.
  const disposable = vscode.commands.registerCommand('roboSmith.showPanel', () => {
    logger.debug('Showing RoboSmith panel.');
    const panel = vscode.window.createWebviewPanel(
      'roboSmithPanel', // Identifies the type of the webview. Used internally.
      'RoboSmith', // Title of the panel displayed to the user.
      vscode.ViewColumn.One, // Editor column to show the new webview panel in.
      {
        // Enable scripts in the webview
        enableScripts: true,
      }
    );

    // --- 4. Event Handler Registration ---
    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        // All incoming messages are routed through our central handler.
        await handleEvent(message, eventHandlerContext);
      },
      undefined,
      context.subscriptions
    );

    // Set the HTML content for the webview.
    // In a real application, this would be loaded from a file.
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