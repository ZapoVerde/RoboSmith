/**
 * @file packages/client/src/events/handler.ts
 * @stamp 2025-11-30T15:40:00.000Z
 * @architectural-role Orchestrator
 * @description A factory for creating an event handler. Routes commands from
 * the UI to backend services and manages the Registry of active Orchestrators.
 * @core-principles
 * 1. IS the single entry point for all commands from the UI layer.
 * 2. OWNS the registry of active Orchestrator instances (Session -> Instance).
 * 3. DELEGATES business logic to services/orchestrators.
 *
 * @api-declaration
 *   - export function createEventHandler()
 *
 * @contract
 *   assertions:
 *     purity: mutates
 *     external_io: vscode
 *     state_ownership: ['orchestratorRegistry']
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
  gitWorktreeManager: GitWorktreeManager;
}

function switchToLobbyView(): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const mainProjectRootUri = workspaceFolders[0].uri;
    vscode.workspace.updateWorkspaceFolders(0, workspaceFolders.length, { uri: mainProjectRootUri });
    logger.info('Switched workspace view back to the main project (Lobby).');
  }
}

export function createEventHandler() {
  // THE REGISTRY: Tracks active orchestrator instances by sessionId
  const orchestrators = new Map<string, Orchestrator>();

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
        const { args, nodeId, isManualApprovalMode } = payload as { 
            args: CreateWorktreeArgs; 
            nodeId: string;
            isManualApprovalMode?: boolean;
        };
        
        logger.info(`Submitting workflow task for node: ${nodeId} (Stepper: ${!!isManualApprovalMode})`);

        try {
          const session = await context.worktreeQueueManager.submitTask(args);
          logger.info(`Worktree session ${session.sessionId} is ready. Starting orchestrator.`);

          const onStateUpdate = (state: WorkflowViewState) => {
            context.panel.webview.postMessage({ command: 'workflowStateUpdate', payload: state });
          };

          const onCompletion = () => {
            logger.info(`Workflow for session ${session.sessionId} has completed.`);
            orchestrators.delete(session.sessionId); // Cleanup registry
            
            context.panel.webview.postMessage({
                command: 'taskReadyForIntegration',
                payload: {
                    sessionId: session.sessionId,
                    branchName: session.branchName,
                    commitMessage: 'Automated changes completed.',
                    changedFiles: session.changePlan
                }
            });
          };

          const orchestrator = new Orchestrator(
            context.manifest,
            context.contextService,
            context.apiManager,
            onStateUpdate,
            onCompletion,
            isManualApprovalMode ?? false
          );

          // REGISTER THE INSTANCE
          orchestrators.set(session.sessionId, orchestrator);

          // Start execution (fire and forget from handler perspective)
          void orchestrator.executeNode(nodeId, session.worktreePath);

        } catch (error) {
          logger.error('Workflow task submission or execution failed.', { error });
        }
        break;
      }

      case 'resumeWorkflow': {
        const { sessionId, augmentedPrompt } = payload;
        const orchestrator = orchestrators.get(sessionId);
        
        if (orchestrator) {
            logger.info(`Resuming workflow for session ${sessionId}`);
            await orchestrator.resumeManually(augmentedPrompt);
        } else {
            logger.error(`Cannot resume: No active orchestrator found for session ${sessionId}`);
        }
        break;
      }

      case 'retryBlock': {
        const { sessionId, augmentedPrompt } = payload;
        const orchestrator = orchestrators.get(sessionId);
        
        if (orchestrator) {
            logger.info(`Retrying block for session ${sessionId}`);
            await orchestrator.retryBlock(augmentedPrompt);
        } else {
            logger.error(`Cannot retry: No active orchestrator found for session ${sessionId}`);
        }
        break;
      }

      case 'openTerminalInWorktree': {
        const { sessionId } = payload;
        const session = context.gitWorktreeManager.getAllSessions().find(s => s.sessionId === sessionId);
        if (session) {
          vscode.window.createTerminal({
            name: `RoboSmith: ${session.branchName}`,
            cwd: session.worktreePath,
          });
        }
        break;
      }
      
      case 'acceptAndMerge':
      case 'rejectAndDiscard': {
        const { sessionId } = payload;
        await context.gitWorktreeManager.removeWorktree(sessionId);
        context.worktreeQueueManager.markTaskComplete(sessionId);
        orchestrators.delete(sessionId);
        switchToLobbyView();
        break;
      }
      
      case 'finishAndHold': {
        const { sessionId } = payload;
        orchestrators.delete(sessionId);
        switchToLobbyView();
        break;
      }

      case 'userAction': {
        logger.info('User action received but not yet implemented.', { payload });
        break;
      }

      case 'blockSelected': {
        break;
      }

      default: {
        // FIX: Pass the command as a structured context object, not a raw string.
        logger.warn(`[EventHandler] Received unhandled command`, { command: command as unknown as string });
        break;
      }
    }
  };
}