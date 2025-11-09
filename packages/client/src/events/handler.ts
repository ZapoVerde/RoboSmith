/**
 * @file packages/client/src/events/handler.ts
 * @stamp S-20251107T160000Z-C-INTEGRATION-PANEL-HANDLERS
 * @architectural-role Orchestrator
 * @description A factory for creating an event handler. It routes commands from
 * the UI to the appropriate backend services, including new commands for UI
 * orchestration and final workflow disposition.
 * @core-principles
 * 1. IS the single entry point for all commands from the UI layer.
 * 2. DELEGATES all business logic to the appropriate service or store.
 * 3. ENFORCES testability by design through state encapsulation.
 *
 * @api-declaration
 *   - export interface EventHandlerContext
 *   - export function createEventHandler()
 */

import * as vscode from 'vscode';
import type { Message, WorkflowManifest, WorkflowViewState } from '../shared/types';
import { settingsStore } from '../features/settings/state/SettingsStore';
import { Orchestrator } from '../lib/workflow/Orchestrator';
import type { SecureStorageService } from '../lib/ai/SecureStorageService';
import type { WebviewPanel } from 'vscode';
import type { ContextPartitionerService } from '../lib/context/ContextPartitionerService';
import type { ApiPoolManager } from '../lib/ai/ApiPoolManager';
import { logger } from '../lib/logging/logger';
import type { WorktreeQueueManager } from '../lib/workflow/WorktreeQueueManager';
import type { CreateWorktreeArgs, GitWorktreeManager } from '../lib/git/GitWorktreeManager';

export interface EventHandlerContext {
  secureStorageService: SecureStorageService;
  panel: WebviewPanel;
  manifest: WorkflowManifest;
  contextService: ContextPartitionerService;
  apiManager: ApiPoolManager;
  worktreeQueueManager: WorktreeQueueManager;
  gitWorktreeManager: GitWorktreeManager; // New dependency for disposition logic
}

/**
 * Switches the VS Code workspace to show only the main project root folder.
 */
function switchToLobbyView(): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    // Assuming the first folder is the main project root.
    const mainProjectRootUri = workspaceFolders[0].uri;
    vscode.workspace.updateWorkspaceFolders(0, workspaceFolders.length, { uri: mainProjectRootUri });
    logger.info('Switched workspace view back to the main project (Lobby).');
  } else {
    logger.warn('Could not switch to Lobby view: No workspace folders found.');
  }
}

/**
 * Creates and returns a new event handler function.
 */
export function createEventHandler() {
  return async function handleEvent(message: Message, context: EventHandlerContext): Promise<void> {
    const { command, payload } = message;

    switch (command) {
      case 'loadApiKeys':
        await settingsStore.getState().loadApiKeys(context.secureStorageService);
        break;

      case 'addApiKey':
        await settingsStore.getState().addApiKey(payload, context.secureStorageService);
        break;

      case 'removeApiKey':
        await settingsStore.getState().removeApiKey(payload.id, context.secureStorageService);
        break;

      case 'startWorkflow': {
        const { args, nodeId } = payload as { args: CreateWorktreeArgs; nodeId: string };
        logger.info(`Submitting workflow task for node: ${nodeId}`);

        try {
          const session = await context.worktreeQueueManager.submitTask(args);
          logger.info(`Worktree session ${session.sessionId} is ready. Starting orchestrator.`);

          const onStateUpdate = (state: WorkflowViewState) => {
            context.panel.webview.postMessage({ command: 'workflowStateUpdate', payload: state });
          };
          const onCompletion = () => {
            // This is where the logic to show the integration panel will go.
            logger.info(`Workflow for session ${session.sessionId} has completed.`);
          };

          const orchestrator = new Orchestrator(
            context.manifest,
            context.contextService,
            context.apiManager,
            onStateUpdate,
            onCompletion
          );

          void orchestrator.executeNode(nodeId, session.worktreePath);
        } catch (error) {
          logger.error('Workflow task submission or execution failed.', { error });
        }
        break;
      }

      case 'blockSelected':
        logger.info(`Block selected: ${payload.blockId}. Inspector panel updates not yet implemented.`);
        break;

      case 'openTerminalInWorktree': {
        const { sessionId } = payload;
        const session = context.gitWorktreeManager.getAllSessions().find(s => s.sessionId === sessionId);
        if (session) {
          vscode.window.createTerminal({
            name: `RoboSmith: ${session.branchName}`,
            cwd: session.worktreePath,
          });
          logger.info(`Opened terminal in worktree: ${session.worktreePath}`);
        } else {
          logger.error(`Could not open terminal: Session ${sessionId} not found.`);
        }
        break;
      }
      
      case 'acceptAndMerge':
      case 'rejectAndDiscard': {
        const { sessionId } = payload;
        logger.info(`Processing '${command}' for session ${sessionId}.`);
        await context.gitWorktreeManager.removeWorktree(sessionId);
        context.worktreeQueueManager.markTaskComplete(sessionId);
        switchToLobbyView();
        break;
      }
      
      case 'finishAndHold': {
        const { sessionId } = payload;
        logger.info(`Processing 'finishAndHold' for session ${sessionId}.`);
        // TODO: Implement `updateSessionStatus` on GitWorktreeManager.
        // This method needs to find the session, update its status to 'Held',
        // and then persist the entire session map back to global state.
        // await context.gitWorktreeManager.updateSessionStatus(sessionId, 'Held');
        logger.warn('Session status update to "Held" is not yet implemented in GitWorktreeManager.');
        
        // Even without the status update, we switch the user back to the lobby.
        switchToLobbyView();
        break;
      }

      case 'userAction': {
        // This case is added back to satisfy the exhaustiveness check.
        logger.info('User action received but not yet implemented.', { payload });
        break;
      }

      default: {
        // This ensures the switch is exhaustive
        const exhaustiveCheck: never = command;
        logger.warn(`[EventHandler] Received unhandled command:`, exhaustiveCheck);
        break;
      }
    }
  };
}