/**
 * @file packages/client/src/lib/ai/SecureStorageService.spec.ts
 * @stamp S-20251031-T150255Z-V-e4f5g6h7
 * @test-target packages/client/src/lib/ai/SecureStorageService.ts
 * @description Verifies the contract of the SecureStorageService, ensuring it correctly interacts with a mocked VS Code SecretStorage API to store, retrieve, and delete `ApiKey` objects.
 * @criticality The test target is CRITICAL as it handles security-sensitive data.
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Covers all public methods.
 *     - Mocks external dependencies (vscode.SecretStorage).
 *     - Asserts on the serialized JSON output.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SecretStorage } from 'vscode';
import type { Mocked } from 'vitest';
import { SecureStorageService } from './SecureStorageService';
import type { ApiKey } from './types';

describe('SecureStorageService', () => {
  let mockSecretStorage: Mocked<SecretStorage>;
  let service: SecureStorageService;

  beforeEach(() => {
    // Create a fully-typed mock of the SecretStorage interface
    mockSecretStorage = {
      get: vi.fn(),
      store: vi.fn(),
      delete: vi.fn(),
      onDidChange: vi.fn(),
      // FIX: Add the missing 'keys' method to satisfy the interface shape.
      keys: vi.fn(),
    };

    // Instantiate the service with the mock
    service = new SecureStorageService(mockSecretStorage);
  });

  it('should store a new API key when storage is empty', async () => {
    // Arrange
    const newKey: ApiKey = {
      id: 'openai-1',
      secret: 'sk-12345',
      provider: 'openai',
    };
    // Mock the initial read to return nothing.
    mockSecretStorage.get.mockResolvedValue(undefined);

    // Act
    await service.storeApiKey(newKey);

    // Assert
    expect(mockSecretStorage.store).toHaveBeenCalledOnce();
    const [storedKeyName, storedJson] = mockSecretStorage.store.mock.calls[0];
    const storedData = JSON.parse(storedJson);

    expect(storedKeyName).toBe('robo-smith-api-keys');
    expect(storedData).toEqual({
      [newKey.id]: newKey,
    });
  });

  it('should add a new API key to an existing set of keys', async () => {
    // Arrange
    const existingKey: ApiKey = {
      id: 'google-1',
      secret: 'gk-abcde',
      provider: 'google',
    };
    const newKey: ApiKey = {
      id: 'openai-1',
      secret: 'sk-12345',
      provider: 'openai',
    };
    const initialStorage = { [existingKey.id]: existingKey };
    mockSecretStorage.get.mockResolvedValue(JSON.stringify(initialStorage));

    // Act
    await service.storeApiKey(newKey);

    // Assert
    expect(mockSecretStorage.store).toHaveBeenCalledOnce();
    const [, storedJson] = mockSecretStorage.store.mock.calls[0];
    const storedData = JSON.parse(storedJson);

    // Verify the final object contains both the old and new keys.
    expect(storedData).toEqual({
      [existingKey.id]: existingKey,
      [newKey.id]: newKey,
    });
  });

  it('should retrieve and parse all stored API keys', async () => {
    // Arrange
    const key1: ApiKey = { id: 'openai-1', secret: 'sk-123', provider: 'openai' };
    const key2: ApiKey = { id: 'google-1', secret: 'gk-abc', provider: 'google' };
    const storedRecord = { [key1.id]: key1, [key2.id]: key2 };
    mockSecretStorage.get.mockResolvedValue(JSON.stringify(storedRecord));

    // Act
    const result = await service.getAllApiKeys();

    // Assert
    expect(result).toEqual(storedRecord);
  });

  it('should remove an API key from the record', async () => {
    // Arrange
    const key1: ApiKey = { id: 'openai-1', secret: 'sk-123', provider: 'openai' };
    const key2: ApiKey = { id: 'google-1', secret: 'gk-abc', provider: 'google' };
    const initialRecord = { [key1.id]: key1, [key2.id]: key2 };
    mockSecretStorage.get.mockResolvedValue(JSON.stringify(initialRecord));

    // Act
    await service.removeApiKey(key1.id);

    // Assert
    expect(mockSecretStorage.store).toHaveBeenCalledOnce();
    const [, storedJson] = mockSecretStorage.store.mock.calls[0];
    const storedData = JSON.parse(storedJson);

    // Verify the final object only contains the remaining key.
    expect(storedData).toEqual({
      [key2.id]: key2,
    });
  });
});
