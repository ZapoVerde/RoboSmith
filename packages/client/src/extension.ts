/**
 * @file packages/client/src/extension.ts
 * @stamp S-20251107T184000Z-C-REFACTOR-COMPOSITION-ROOT
 * @architectural-role Feature Entry Point
 * @description
 * The main activation entry point for the VS Code extension. It serves as the
 * **Composition Root** for the application. Its sole responsibility is to instantiate
 * core services and features, inject their dependencies, and trigger their
 * initialization routines.
 * @core-principles
 * 1. IS the definitive Composition Root for the backend application.
 * 2. OWNS the instantiation and lifecycle of all singleton services.
 * 3. DELEGATES all feature-specific logic to dedicated service classes.
 *
 * @api-declaration
 *   - export async function activate(context: vscode.ExtensionContext): Promise<void>
 *   - export function deactivate(): void
 *
 * @contract
 *   assertions:
 *     purity: "mutates"       # This file mutates global state by instantiating singletons.
 *     external_io: "vscode"   # Interacts with VS Code APIs at the top level.
 *     state_ownership: "none" # Does not own application state; it creates the owners.
 */

import * as vscode from 'vscode';
import { logger } from './lib/logging/logger';
import { RealGitAdapter } from './lib/git/RealGitAdapter';
import { GitWorktreeManager } from './lib/git/GitWorktreeManager';
import {
  StatusBarNavigatorService,
  type INavigatorDependencies,
} from './features/navigator/StatusBarNavigatorService';

/**
 * The main entry point for the extension, called by VS Code on activation.
 * @param context The extension context provided by VS Code.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.initialize(context.extensionMode);
  logger.info('RoboSmith extension activating...');

  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    // FIX: Correctly check for an undefined value OR an empty array.
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open. RoboSmith requires a project to be open.');
    }
    const mainProjectRoot = workspaceFolders[0];

    // --- 1. Composition Root: Instantiate all services and dependencies ---
    const realGitAdapter = new RealGitAdapter(context);
    const gitWorktreeManager = new GitWorktreeManager(realGitAdapter);
    
    const navigatorDependencies: INavigatorDependencies = {
      window: vscode.window,
      workspace: vscode.workspace,
      commands: vscode.commands,
    };
    
    const statusBarNavigator = new StatusBarNavigatorService(
      gitWorktreeManager,
      navigatorDependencies,
      context.subscriptions
    );

    // --- 2. Initialization: Trigger the startup logic for each service ---
    await gitWorktreeManager.initialize();
    statusBarNavigator.initialize(mainProjectRoot);

    logger.info('RoboSmith extension activated successfully.');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to activate RoboSmith extension: ${errorMessage}`);
    vscode.window.showErrorMessage(`RoboSmith failed to start: ${errorMessage}`);
  }
}

/**
 * Called by VS Code when the extension is deactivated.
 */
export function deactivate(): void {
  logger.info('RoboSmith extension deactivated.');
}