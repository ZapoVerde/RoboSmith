/**
 * @file packages/client/src/shared/types.ts
 * @stamp S-20251101-T120500Z-C-REFACTORED
 * @architectural-role Type Definition
 * @description Defines the shared message interface for the asynchronous event bus, ensuring type safety between the WebView (frontend) and the Extension Host (backend).
 * @core-principles
 * 1. IS the single source of truth for the client's event bus message contract.
 * 2. MUST contain only pure TypeScript type/interface definitions.
 * 3. DELEGATES the definition of core domain models like `ApiKey` to the `@shared` package.
 *
 * @api-declaration
 *   - export type Message
 *
 * @contract
 *   assertions:
 *     purity: pure          # This file contains only type definitions and no executable logic.
 *     external_io: none     # This file does not perform any I/O.
 *     state_ownership: none # This file does not own or manage any state.
 */

import type { ApiKey } from '@shared/domain/api-key';

// --- Event Bus Message Contract ---

type CommandPayloadMap = {
  addApiKey: ApiKey;
  removeApiKey: { id: string };
  loadApiKeys: undefined;
  // ... other commands can be added here
};

/**
 * @id packages/client/src/shared/types.ts#Message
 * @description The discriminated union type for all messages passed over the
 * WebView-Extension event bus.
 */
export type Message = {
  [K in keyof CommandPayloadMap]: {
    command: K;
    payload: CommandPayloadMap[K];
  };
}[keyof CommandPayloadMap];