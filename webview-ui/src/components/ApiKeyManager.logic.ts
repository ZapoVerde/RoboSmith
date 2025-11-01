/**
 * @file webview-ui/src/components/ApiKeyManager.logic.ts
 * @stamp S-20251101-T041500Z-C-COMPLIANT
 * @architectural-role Business Logic
 * @description Headless logic for the ApiKeyManager component. Isolates event dispatching and form handling from the Svelte UI, making it independently testable and compliant with the project's testing standard.
 * @core-principles
 * 1. IS the single source of truth for the ApiKeyManager's behavior.
 * 2. OWNS the logic for validating form inputs and creating event payloads.
 * 3. MUST be pure TypeScript with no dependencies on Svelte or the DOM.
 *
 * @api-declaration
 *   - TYPES:
 *     - type ApiKeyDispatcher = { (event: 'addApiKey', ...), (event: 'removeApiKey', ...) }
 *   - EXPORTS:
 *     - function handleAddKey(dispatch: ApiKeyDispatcher, newKeyData: {...}): { id, secret, provider }
 *     - function handleDeleteKey(dispatch: ApiKeyDispatcher, keyId: string): void
 *
 * @contract
 *   assertions:
 *     purity: pure          # Functions are deterministic and have no side effects beyond the injected dispatcher.
 *     external_io: none     # This module performs no network or file system I/O.
 *     state_ownership: none # This module is stateless; it operates on inputs and returns new state.
 */

import type { ApiKey } from '@shared/domain/api-key';

// Define the "contract" for the dispatcher this logic needs from its Svelte host.
type ApiKeyDispatcher = {
  (event: 'addApiKey', payload: ApiKey): void;
  (event: 'removeApiKey', payload: { id: string }): void;
};

/**
 * Handles the logic for adding a new API key.
 * @param dispatch The event dispatcher from the Svelte component.
 * @param newKeyData The current state of the form inputs.
 * @returns The new state for the form inputs after a successful operation.
 */
export function handleAddKey(
  dispatch: ApiKeyDispatcher,
  newKeyData: { id: string; secret: string; provider: ApiKey['provider'] }
) {
  // Logic: Validate inputs before dispatching.
  if (newKeyData.id.trim() && newKeyData.secret.trim() && newKeyData.provider) {
    const newApiKey: ApiKey = {
      id: newKeyData.id,
      secret: newKeyData.secret,
      provider: newKeyData.provider,
    };
    dispatch('addApiKey', newApiKey);

    // Logic: Return the reset state for the form.
    return {
      id: '',
      secret: '',
      provider: 'openai' as const,
    };
  }
  // If validation fails, return the original state unchanged.
  return newKeyData;
}

/**
 * Handles the logic for deleting an API key.
 * @param dispatch The event dispatcher from the Svelte component.
 * @param keyId The ID of the key to remove.
 */
export function handleDeleteKey(dispatch: ApiKeyDispatcher, keyId: string) {
  dispatch('removeApiKey', { id: keyId });
}