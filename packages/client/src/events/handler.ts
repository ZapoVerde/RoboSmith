/**
 * @file packages/client/src/events/handler.ts
 * @stamp S-20251106T154021Z-C-COMPLIANT-FIX
 * @architectural-role Orchestrator
 * @description A factory for creating an event handler. It routes commands from
 * the UI to the appropriate backend services, which are provided via a context object.
 * @core-principles
 * 1. IS the single entry point for all commands from the UI layer.
 * 2. DELEGATES all business logic to the appropriate service or store.
 * 3. ENFORCES testability by design through state encapsulation.
 *
 * @api-declaration
 *   - export interface EventHandlerContext
 *   - export function createEventHandler(): (message: Message, context: EventHandlerContext) => Promise<void>
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # The returned handler function orchestrates state mutations and I/O.
 *     - external_io: "vscode"   # Posts messages back to the VS Code WebView.
 *     - state_ownership: "none" # The factory itself is stateless; the returned handler encapsulates its own state.
 */

import type { Message, PlanningState, WorkflowManifest } from '../shared/types';
import { settingsStore } from '../features/settings/state/SettingsStore';
import { Orchestrator, WorkflowHaltedError } from '../lib/workflow/Orchestrator.transitions';
import type { SecureStorageService } from '../lib/ai/SecureStorageService';
import type { WebviewPanel } from 'vscode';
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

/**
 * Creates and returns a new event handler function. Each handler has its own
 * private, encapsulated state for the concurrency lock.
 */
export function createEventHandler() {
  let isWorkflowRunning = false;

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
          if (error instanceof WorkflowHaltedError) {
            // Orchestrator is responsible for its own final state update.
          } else {
            const errorState: PlanningState = {
              currentNodeId: message.payload.nodeId,
              currentBlockId: '',
              executionPayload: [],
              isHalted: true,
              errorMessage: error instanceof Error ? error.message : 'An unknown error occurred.',
            };
            context.panel.webview.postMessage({ command: 'planningStateUpdate', payload: errorState });
          }
        } finally {
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
  };
}