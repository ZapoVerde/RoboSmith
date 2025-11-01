/**
 * @file packages/client/src/lib/ai/ApiPoolManager.spec.ts
 * @stamp S-20251101-T134500Z-V-TYPED
 * @test-target packages/client/src/lib/ai/ApiPoolManager.ts
 * @description Verifies the ApiPoolManager's orchestration logic, including the key carousel (round-robin) and failover mechanisms, using a mocked aiClient.
 * @criticality The test target is CRITICAL as it orchestrates core business logic and manages state.
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Mocks all external dependencies (SecureStorageService, aiClient).
 *     - Verifies correct key rotation (round-robin).
 *     - Verifies failover logic on API call failure.
 *     - Verifies cooldown mechanism prevents retrying failed keys.
 *     - Verifies correct behavior when all keys fail.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as vscode from 'vscode';
import { ApiPoolManager } from './ApiPoolManager';
import { SecureStorageService } from './SecureStorageService';
import { aiClient } from './aiClient';
import type { ApiKey, WorkOrder } from './types';

// Mock the dependencies at the module level
vi.mock('./SecureStorageService');
vi.mock('./aiClient');

describe('ApiPoolManager', () => {
  let manager: ApiPoolManager;
  let mockSecureStorage: SecureStorageService;
  let mockWorkOrder: WorkOrder;

  const mockKey1: ApiKey = { id: 'key-01', provider: 'openai', secret: 'sk-1' };
  const mockKey2: ApiKey = { id: 'key-02', provider: 'openai', secret: 'sk-2' };

  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-expect-error - Intentionally accessing private static property to reset singleton for test isolation.
    ApiPoolManager.instance = undefined;

    // Provide a type-correct mock for the vscode.SecretStorage dependency.
    const mockSecretStorage = {} as vscode.SecretStorage;
    mockSecureStorage = new SecureStorageService(mockSecretStorage);
    manager = ApiPoolManager.getInstance(mockSecureStorage);

    mockWorkOrder = {
      model: 'gpt-4o',
      prompt: 'Test prompt',
    };
  });

  afterEach(() => {
    // @ts-expect-error - Intentionally accessing private static property to clean up singleton post-test.
    ApiPoolManager.instance = undefined;
  });

  it('should initialize by loading API keys from secure storage', async () => {
    // Arrange
    const mockKeysRecord = { [mockKey1.id]: mockKey1, [mockKey2.id]: mockKey2 };
    vi.mocked(mockSecureStorage.getAllApiKeys).mockResolvedValue(mockKeysRecord);

    // Act
    await manager.initialize();

    // Assert
    expect(mockSecureStorage.getAllApiKeys).toHaveBeenCalledOnce();
    // @ts-expect-error - Accessing private property 'apiKeyPool' for test verification.
    expect(manager.apiKeyPool).toEqual([mockKey1, mockKey2]);
  });

  it('should rotate through available keys on successive successful calls', async () => {
    // Arrange
    const mockKeysRecord = { [mockKey1.id]: mockKey1, [mockKey2.id]: mockKey2 };
    vi.mocked(mockSecureStorage.getAllApiKeys).mockResolvedValue(mockKeysRecord);
    await manager.initialize();

    vi.mocked(aiClient.generateCompletion).mockResolvedValue({
      success: true,
      content: 'Success!',
    });

    // Act
    await manager.execute(mockWorkOrder);
    await manager.execute(mockWorkOrder);

    // Assert
    const calls = vi.mocked(aiClient.generateCompletion).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe(mockKey1);
    expect(calls[1][0]).toBe(mockKey2);
  });

  it('should failover to the next key when the first one fails', async () => {
    // Arrange
    const mockKeysRecord = { [mockKey1.id]: mockKey1, [mockKey2.id]: mockKey2 };
    vi.mocked(mockSecureStorage.getAllApiKeys).mockResolvedValue(mockKeysRecord);
    await manager.initialize();

    vi.mocked(aiClient.generateCompletion)
      .mockResolvedValueOnce({ success: false, error: 'Rate limit exceeded' })
      .mockResolvedValueOnce({ success: true, content: 'Success from key 2' });

    // Act
    const result = await manager.execute(mockWorkOrder);

    // Assert
    const calls = vi.mocked(aiClient.generateCompletion).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe(mockKey1); // Verify it tried key 1 first
    expect(calls[1][0]).toBe(mockKey2); // Verify it tried key 2 second

    expect(result.success).toBe(true);
    expect(result.content).toBe('Success from key 2');
  });

  it('should return a failure result when all keys in the pool fail', async () => {
    // Arrange
    const mockKeysRecord = { [mockKey1.id]: mockKey1, [mockKey2.id]: mockKey2 };
    vi.mocked(mockSecureStorage.getAllApiKeys).mockResolvedValue(mockKeysRecord);
    await manager.initialize();

    vi.mocked(aiClient.generateCompletion).mockResolvedValue({
      success: false,
      error: 'API Error',
    });

    // Act
    const result = await manager.execute(mockWorkOrder);

    // Assert
    expect(aiClient.generateCompletion).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(false);
    expect(result.error).toBe('All available API keys failed to process the request.');
  });

  it('should place failed keys on cooldown and not retry them immediately', async () => {
    // Arrange
    vi.useFakeTimers(); // Enable fake timers to control cooldown period
    const mockKeysRecord = { [mockKey1.id]: mockKey1, [mockKey2.id]: mockKey2 };
    vi.mocked(mockSecureStorage.getAllApiKeys).mockResolvedValue(mockKeysRecord);
    await manager.initialize();

    vi.mocked(aiClient.generateCompletion).mockResolvedValue({
      success: false,
      error: 'API Error',
    });

    // Act 1: All keys fail and go on cooldown
    await manager.execute(mockWorkOrder);
    expect(aiClient.generateCompletion).toHaveBeenCalledTimes(2);
    vi.mocked(aiClient.generateCompletion).mockClear();

    // Act 2: Execute again immediately
    const secondResult = await manager.execute(mockWorkOrder);

    // Assert 2: No calls made, as keys are on cooldown
    expect(aiClient.generateCompletion).not.toHaveBeenCalled();
    expect(secondResult.success).toBe(false);
    expect(secondResult.error).toContain('No available API keys');

    vi.useRealTimers(); // Restore real timers
  });
});