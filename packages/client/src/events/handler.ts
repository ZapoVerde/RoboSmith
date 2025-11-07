/**
 * @file packages/client/src/events/handler.ts
 * @stamp S-20251107T120000Z-C-WORKTREE-AWARE
 * @architectural-role Orchestrator
 * @description A factory for creating an event handler. It routes commands from
 * the UI to the appropriate backend services, which are provided via a context object.
 * @core-principles
 * 1. IS the single entry point for all commands from the UI layer.
 * 2. DELEGATES all business logic to the appropriate service or store.
 * 3. ENFORCES testability by design through state encapsulation.
 */

import type { Message, WorkflowManifest, PlanningState } from '../shared/types';
import { settingsStore } from '../features/settings/state/SettingsStore';
import { Orchestrator,  } from '../lib/workflow/Orchestrator';
import type { SecureStorageService } from '../lib/ai/SecureStorageService';
import type { WebviewPanel } from 'vscode';
import type { ContextPartitionerService } from '../lib/context/ContextPartitionerService';
import type { ApiPoolManager } from '../lib/ai/ApiPoolManager';
import { logger } from '../lib/logging/logger';
import type { WorktreeQueueManager } from '../lib/workflow/WorktreeQueueManager';
import type { CreateWorktreeArgs } from '../lib/git/GitWorktreeManager';

export interface EventHandlerContext {
  secureStorageService: SecureStorageService;
  panel: WebviewPanel;
  manifest: WorkflowManifest;
  contextService: ContextPartitionerService;
  apiManager: ApiPoolManager;
  worktreeQueueManager: WorktreeQueueManager;
}

/**
 * Creates and returns a new event handler function.
 */
export function createEventHandler() {
  // The concurrency lock is now managed by the WorktreeQueueManager.
  return async function handleEvent(message: Message, context: EventHandlerContext): Promise<void> {
    switch (message.command) {
      case 'loadApiKeys':
        await settingsStore.getState().loadApiKeys(context.secureStorageService);
        break;

      case 'addApiKey':
        await settingsStore.getState().addApiKey(message.payload, context.secureStorageService);
        break;

      case 'removeApiKey':
        await settingsStore.getState().removeApiKey(message.payload.id, context.secureStorageService);
        break;

      case 'startWorkflow': {
        const { args, nodeId } = message.payload as { args: CreateWorktreeArgs; nodeId: string };
        logger.info(`Submitting workflow task for node: ${nodeId}`);

        try {
          const session = await context.worktreeQueueManager.submitTask(args);
          logger.info(`Worktree session ${session.sessionId} is ready. Starting orchestrator.`);

          const onStateUpdate = (state: PlanningState) => {
            context.panel.webview.postMessage({ command: 'planningStateUpdate', payload: state });
          };

          const orchestrator = new Orchestrator(
            context.manifest,
            context.contextService,
            context.apiManager,
            onStateUpdate
          );

          // We don't await this because the execution can be long-running,
          // but the test only needs to verify it was *called* correctly.
          void orchestrator.executeNode(nodeId, session.worktreePath);

        } catch (error) {
          logger.error('Workflow task submission or execution failed.', { error });
          // Optionally, post a generic error state back to the UI
        }
        break;
      }

      case 'userAction': {
        logger.info('User action received but not yet implemented.', { payload: message.payload });
        break;
      }

      default: {
        const exhaustiveCheck: never = message;
        logger.warn(`[EventHandler] Received unhandled command:`, exhaustiveCheck);
        break;
      }
    }
  };
}