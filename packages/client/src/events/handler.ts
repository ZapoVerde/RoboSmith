/**
 * @file packages/client/src/events/handler.ts
 * @stamp S-20251031-T152200Z-C-CREATED
 * @architectural-role Orchestrator
 * @description The central event handler that routes incoming messages from the WebView event bus to the appropriate backend services or state stores. It handles all commands for API key management.
 * @core-principles
 * 1. IS the single entry point for all commands from the UI layer.
 * 2. MUST delegate all business logic to the appropriate service or store.
 * 3. MUST NOT contain any business logic itself.
 *
 * @api-declaration
 *   - export interface EventHandlerContext
 *   - export async function handleEvent(message: Message, context: EventHandlerContext): Promise<void>
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # This function orchestrates state mutations in other modules.
 *     - external_io: "none"     # It delegates all I/O to services provided in its context.
 *     - state_ownership: "none"
 */

import type { Message } from '../shared/types';
import { settingsStore } from '../features/settings/state/SettingsStore';
import type { SecureStorageService } from '../lib/ai/SecureStorageService';

/**
 * A context object containing all necessary dependencies for the event handler.
 * This allows for clean dependency injection and simplifies testing.
 */
export interface EventHandlerContext {
  secureStorageService: SecureStorageService;
  // Other services can be added here as the application grows.
}

/**
 * The main router for all incoming messages from the WebView.
 * @param message The message from the event bus, conforming to the shared Message type.
 * @param context An object containing all necessary service dependencies.
 */
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

    default:
      // It's good practice to handle unknown commands to aid in debugging.
      // We can use a type assertion to help TypeScript identify exhaustive checks.
      const exhaustiveCheck: never = message;
      console.warn(`[EventHandler] Received unhandled command:`, exhaustiveCheck);
      break;
  }
}
