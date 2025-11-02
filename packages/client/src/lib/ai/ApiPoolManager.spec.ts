/**
 * @file packages/client/src/lib/ai/ApiPoolManager.spec.ts
 * @stamp S-20251101-T145000Z-V-TESTFIX
 * @test-target packages/client/src/lib/ai/ApiPoolManager.ts
 * @description
 * Verifies the complete functionality of the ApiPoolManager, including its singleton
 * pattern, initialization, and the core failover-driven round-robin logic for the
 * `execute` method.
 * @criticality
 * The test target is CRITICAL as it is a core orchestrator and manages I/O and
 * concurrency (Rubric Points #2, #5, and #6).
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Verifies the singleton pattern ensures only one instance is created.
 *     - Verifies that `initialize` correctly loads keys from the mocked storage service.
 *     - Verifies the "happy path" where the first key succeeds.
 *     - Verifies the single and multiple failover paths with retryable errors.
 *     - Verifies that a non-retryable error fails immediately without trying other keys.
 *     - Verifies that an `AllApiKeysFailedError` is thrown when all keys are exhausted.
 *     - Verifies that an error is thrown if no keys are configured.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { ApiPoolManager, AllApiKeysFailedError, type WorkOrder } from './ApiPoolManager';
import { SecureStorageService } from './SecureStorageService';
import { logger } from '../logging/logger';
import type { ApiKey } from '@shared/domain/api-key';
import type * as vscode from 'vscode';

// Mock all external dependencies
vi.mock('./SecureStorageService');
vi.mock('../logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ApiPoolManager', () => {
  let mockStorageService: Mocked<SecureStorageService>;
  let manager: ApiPoolManager;

  const mockApiKeys: Record<string, ApiKey> = {
    key1: { id: 'key1-openai', provider: 'openai', secret: 'sk-good' },
    key2: { id: 'key2-google', provider: 'google', secret: 'gk-fail-rate-limit' },
    key3: { id: 'key3-anthropic', provider: 'anthropic', secret: 'ak-fail-invalid' },
    key4: { id: 'key4-openai', provider: 'openai', secret: 'sk-fail-server' },
  };

  const sampleWorkOrder: WorkOrder = {
    provider: 'openai',
    prompt: 'Tell me a story.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageService = new SecureStorageService({} as vscode.SecretStorage) as Mocked<SecureStorageService>;
    // To test the singleton and initialization, we must reset its private static instance.
    ApiPoolManager['instance'] = undefined;
    manager = ApiPoolManager.getInstance(mockStorageService);
  });

  describe('Initialization and Singleton Pattern', () => {
    it('should always return the same instance', () => {
      const anotherInstance = ApiPoolManager.getInstance(mockStorageService);
      expect(manager).toBe(anotherInstance);
    });

    it('should load and sort keys from storage during initialize', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue(mockApiKeys);
      await manager.initialize();
      // Directly inspect internal state for testing purposes using string-based access.
      const internalKeys = manager['apiKeys'];
      expect(internalKeys.length).toBe(4);
      // Verify they are sorted by ID
      expect(internalKeys[0].id).toBe('key1-openai');
      expect(internalKeys[1].id).toBe('key2-google');
      expect(internalKeys[2].id).toBe('key3-anthropic');
    });
  });

  describe('execute', () => {
    it('should succeed on the first attempt if the first key is valid', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue({ key1: mockApiKeys['key1'] });
      await manager.initialize();

      const result = await manager.execute(sampleWorkOrder);
      expect(result).toContain('Success');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should throw an AllApiKeysFailedError if no keys are initialized', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue({});
      await manager.initialize();

      await expect(manager.execute(sampleWorkOrder)).rejects.toThrow(AllApiKeysFailedError);
    });

    it('should failover to the next key if the first one has a retryable error', async () => {
      // FIX: Use keys with IDs that guarantee the failing key is sorted first.
      const failingKey: ApiKey = { id: 'a-failing-key', provider: 'openai', secret: 'sk-fail-rate-limit' };
      const succeedingKey: ApiKey = { id: 'b-succeeding-key', provider: 'openai', secret: 'sk-good' };

      mockStorageService.getAllApiKeys.mockResolvedValue({
        [succeedingKey.id]: succeedingKey,
        [failingKey.id]: failingKey,
      });
      await manager.initialize();

      const result = await manager.execute(sampleWorkOrder);

      // It should still succeed by using the second key
      expect(result).toContain('Success');
      // A warning should have been logged for the failover
      expect(logger.warn).toHaveBeenCalledOnce();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed with a retryable error'),
        expect.anything()
      );
    });

    it('should fail immediately if a non-retryable error occurs', async () => {
      // Load the key that causes a server error
      mockStorageService.getAllApiKeys.mockResolvedValue({ key4: mockApiKeys['key4'] });
      await manager.initialize();

      await expect(manager.execute(sampleWorkOrder)).rejects.toThrow('MOCK ERROR: 500 Internal Server Error');

      // It should NOT log a warning because it's not a failover scenario
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('non-retryable error'),
        expect.anything()
      );
    });

    it('should throw an AllApiKeysFailedError if all keys fail with retryable errors', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue({
        key2: mockApiKeys['key2'], // Fails
        key3: mockApiKeys['key3'], // Also fails
      });
      await manager.initialize();

      await expect(manager.execute(sampleWorkOrder)).rejects.toThrow(AllApiKeysFailedError);

      // It should have logged a warning for each failed key
      expect(logger.warn).toHaveBeenCalledTimes(2);
      // It should log the final exhaustion error
      expect(logger.error).toHaveBeenCalledWith(
        'All API keys in the pool failed for the current request.'
      );
    });

    it('should correctly rotate through the keys in a round-robin fashion', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue({
        key2: mockApiKeys['key2'], // Fails
        key1: mockApiKeys['key1'], // Succeeds
        key3: mockApiKeys['key3'], // Fails
      });
      await manager.initialize();

      // The internal order is key1, key2, key3
      // First attempt uses key1 (succeeds). nextKeyIndex becomes 1.
      await manager.execute(sampleWorkOrder);
      expect(manager['nextKeyIndex']).toBe(1);

      // Second attempt should start with key2 (fails). It will then try key3 (fails).
      // It will then try key1 again (succeeds). nextKeyIndex becomes 1.
      // We need to re-initialize to reset the key states for this specific test case.
      manager['apiKeys'] = [mockApiKeys.key2, mockApiKeys.key3, mockApiKeys.key1];
      manager['nextKeyIndex'] = 0;

      await manager.execute(sampleWorkOrder);

      // It tried key2 (fail), key3 (fail), and finally key1 (success).
      // After key1 succeeded, the index for the *next* call should be 0 (wrapping around).
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(manager['nextKeyIndex']).toBe(0);
    });
  });
});