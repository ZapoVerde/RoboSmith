/**
 * @file packages/client/src/events/handler.ts
 * @stamp S-20251101-T223000Z-C-CONCURRENCY-FIX
 * @architectural-role Orchestrator
 * @description
 * The central event handler that routes incoming messages from the WebView event
 * bus to the appropriate backend services or state stores. It handles all commands
 * for API key management and is now the primary entry point for initiating and
 * supervising workflows via the Orchestrator.
 * @core-principles
 * 1. IS the single entry point for all commands from the UI layer.
 * 2. MUST delegate all business logic to the appropriate service or store.
 * 3. OWNS the responsibility of instantiating the Orchestrator for a new workflow.
 * 4. MUST provide a feedback mechanism for the Orchestrator to report state back to the UI.
 *
 * @api-declaration
 *   - export interface EventHandlerContext
 *   - export async function handleEvent(message: Message, context: EventHandlerContext): Promise<void>
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # This function orchestrates state mutations and I/O in other modules.
 *     - external_io: "vscode"   # Posts messages back to the VS Code WebView.
 *     - state_ownership: "none" # It is a stateless router.
 */

import type { Message, PlanningState } from '../shared/types';
import { settingsStore } from '../features/settings/state/SettingsStore';
import { Orchestrator, WorkflowHaltedError } from '../lib/workflow/Orchestrator';
import type { SecureStorageService } from '../lib/ai/SecureStorageService';
import type { WebviewPanel } from 'vscode';
import type { WorkflowManifest } from '../lib/workflow/WorkflowService';
import type { ContextPartitionerService } from '../lib/context/ContextPartitionerService';
import type { ApiPoolManager } from '../lib/ai/ApiPoolManager';
import { logger } from '../lib/logging/logger';

export interface EventHandlerContext {
  secureStorageService: SecureStorageService;
  panel: WebviewPanel;
  manifest: WorkflowManifest;
  contextService: ContextPartitionerService;
  apiManager: ApiPoolManager;
}

let isWorkflowRunning = false;

export async function handleEvent(message: Message, context: EventHandlerContext): Promise<void> {
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
      // CORRECTED: This is now an atomic lock. The flag is set synchronously
      // before any async operation, preventing race conditions.
      if (isWorkflowRunning) {
        logger.warn('A workflow is already in progress. Ignoring new request.');
        return;
      }
      isWorkflowRunning = true;

      try {
        logger.info(`Starting workflow for node: ${message.payload.nodeId}`);

        const onStateUpdate = (state: PlanningState) => {
          context.panel.webview.postMessage({ command: 'planningStateUpdate', payload: state });
        };

        const orchestrator = new Orchestrator(
          context.manifest,
          context.contextService,
          context.apiManager,
          onStateUpdate
        );

        await orchestrator.executeNode(message.payload.nodeId);
        logger.info(`Workflow for node: ${message.payload.nodeId} completed successfully.`);

      } catch (error) {
        logger.error('Workflow execution failed.', { error });
        // Handle graceful halts vs. unexpected crashes
        if (error instanceof WorkflowHaltedError) {
          // The Orchestrator is now responsible for sending its own final "halted" state update.
          // This block ensures we log it but don't send a confusing duplicate message.
        } else {
          // For a truly unexpected error, send a generic error state to the UI.
          const errorState: PlanningState = {
            nodeId: message.payload.nodeId,
            currentStepIndex: 0, // Or the last known step
            steps: [],
            lastOutput: null,
            isHalted: true,
            errorMessage: error instanceof Error ? error.message : 'An unknown error occurred.',
          };
          context.panel.webview.postMessage({ command: 'planningStateUpdate', payload: errorState });
        }
      } finally {
        // Release the lock once execution is complete or has failed.
        isWorkflowRunning = false;
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
}