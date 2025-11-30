/**
 * @file packages/client/src/events/handler.ts
 * @stamp 2025-11-30T22:40:00.000Z
 * @architectural-role Orchestrator
 * @description A factory for creating an event handler. It routes commands from
 * the UI to the appropriate backend services, including new commands for UI
 * orchestration and final workflow disposition.
 * @core-principles
 * 1. IS the single entry point for all commands from the UI layer.
 * 2. DELEGATES all business logic to the appropriate service or store.
 * 3. ENFORCES testability by design through state encapsulation.
 */

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
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

      case 'rerunCall': {
        const { modifiedRequest } = payload;
        const startTime = Date.now();
        
        try {
            // Reconstruct a WorkOrder from the flat request for the ApiPoolManager
            const workOrder = {
                worker: 'Inspector:ReRun',
                worktreePath: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                context: [{
                    id: uuidv4(),
                    type: 'USER_PROMPT',
                    content: modifiedRequest.prompt,
                    timestamp: new Date().toISOString()
                }],
                sessionId: 'inspector-adhoc',
                stepName: 'Inspector Re-run'
            };

            const result = await context.apiManager.execute(workOrder);
            
            // In a real implementation, we would extract the specific AI text.
            // For V1, we assume the last segment of the returned payload is the response.
            const responseContent = result.newPayload[result.newPayload.length - 1]?.content || '(No content)';

            context.panel.webview.postMessage({
                command: 'rerunComplete',
                payload: {
                    content: responseContent,
                    durationMs: Date.now() - startTime
                }
            });

        } catch (error) {
            context.panel.webview.postMessage({
                command: 'rerunComplete',
                payload: {
                    content: '',
                    durationMs: Date.now() - startTime,
                    error: error instanceof Error ? error.message : String(error)
                }
            });
        }
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
        logger.warn(`[EventHandler] Received unhandled command`, { command: command as unknown as string });
        break;
      }
    }
  };
}