/**
 * @file packages/client/src/features/settings/state/SettingsStore.spec.ts
 * @stamp S-20251031-T152000Z-V-FINALIZED
 * @test-target packages/client/src/features/settings/state/SettingsStore.ts
 * @description Verifies the state transitions and actions of the vanilla `settingsStore` in complete isolation. This suite ensures that all actions correctly mutate the store's state and delegate persistence calls as expected.
 * @criticality The test target is CRITICAL as it is a central state store (Reason: State Store Ownership).
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Covers all public actions of the store.
 *     - Mocks the `SecureStorageService` external dependency.
 *     - Resets the store's state before each test to ensure isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
// Import the vanilla store instance directly
import { settingsStore } from './SettingsStore';
import { SecureStorageService } from '../../../lib/ai/SecureStorageService';
import type { ApiKey } from '@shared/domain/api-key';
import type * as vscode from 'vscode';

vi.mock('../../../lib/ai/SecureStorageService');

describe('settingsStore', () => {
  let mockStorageService: Mocked<SecureStorageService>;
  const initialState = settingsStore.getState();

  beforeEach(() => {
    // Even though SecureStorageService is mocked, TypeScript still checks the 
    // constructor's signature. We provide a type-correct mock object to
    // satisfy the compiler and the linter rule against using `any`.
    mockStorageService = new SecureStorageService({} as vscode.SecretStorage) as Mocked<SecureStorageService>;
    // Reset the store to its initial state before each test
    settingsStore.setState(initialState, true);
    vi.clearAllMocks();
  });

  it('should load API keys from storage and update the state', async () => {
    const mockApiKey: ApiKey = { id: 'key-1', provider: 'openai', secret: 'sk-1' };
    const mockApiKeysRecord = { [mockApiKey.id]: mockApiKey };
    mockStorageService.getAllApiKeys.mockResolvedValue(mockApiKeysRecord);

    await settingsStore.getState().loadApiKeys(mockStorageService);

    expect(mockStorageService.getAllApiKeys).toHaveBeenCalledOnce();
    expect(settingsStore.getState().aiConnections).toEqual(Object.values(mockApiKeysRecord));
  });

  it('should persist a new API key and add it to the state', async () => {
    const newApiKey: ApiKey = { id: 'key-2', provider: 'google', secret: 'gk-2' };
    await settingsStore.getState().addApiKey(newApiKey, mockStorageService);

    expect(mockStorageService.storeApiKey).toHaveBeenCalledWith(newApiKey);
    expect(settingsStore.getState().aiConnections).toContainEqual(newApiKey);
  });

  it('should persist a deletion and remove the API key from the state', async () => {
    const keyToRemove: ApiKey = { id: 'key-3', provider: 'openai', secret: 'sk-3' };
    settingsStore.setState({ aiConnections: [keyToRemove] });

    await settingsStore.getState().removeApiKey(keyToRemove.id, mockStorageService);

    expect(mockStorageService.removeApiKey).toHaveBeenCalledWith(keyToRemove.id);
    expect(settingsStore.getState().aiConnections).toEqual([]);
  });
});