/**
 * @file packages/client/src/lib/ai/ApiPoolManager.spec.ts
 * @stamp S-20251102-T140000Z-V-FINAL-WITH-PREAMBLE
 * @test-target packages/client/src/lib/ai/ApiPoolManager.ts
 * @description
 * Verifies the complete functionality of the ApiPoolManager, including its singleton
 * pattern, initialization, and the core failover-driven round-robin logic for the
 * `execute` method.
 * @criticality
 * The test target is CRITICAL as it is a core orchestrator and manages I/O,
 * concurrency, and security context (Rubric Points #2, #5, #6).
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Verifies the singleton pattern ensures only one instance is created.
 *     - Verifies that `initialize` correctly loads and sorts keys from the mocked storage service.
 *     - Verifies the "happy path" where the first key succeeds.
 *     - Verifies single and multiple failover paths with retryable errors.
 *     - Verifies that a non-retryable error fails immediately without trying other keys.
 *     - Verifies that an `AllApiKeysFailedError` is thrown when all keys are exhausted.
 *     - Verifies that an error is thrown if no keys are configured.
 *     - Verifies correct round-robin key rotation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { ApiPoolManager, AllApiKeysFailedError, type WorkOrder } from './ApiPoolManager';
import { SecureStorageService } from './SecureStorageService';
import { logger } from '../logging/logger';
import type { ApiKey } from '@shared/domain/api-key';
import type * as vscode from 'vscode';

vi.mock('./SecureStorageService');
vi.mock('../logging/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
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
    worker: 'Worker:Test',
    context: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageService = new SecureStorageService({} as vscode.SecretStorage) as Mocked<SecureStorageService>;
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
      const internalKeys = manager['apiKeys'];
      expect(internalKeys.length).toBe(4);
      expect(internalKeys[0].id).toBe('key1-openai');
    });
  });

  describe('execute', () => {
    it('should succeed on the first attempt if the first key is valid', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue({ key1: mockApiKeys['key1'] });
      await manager.initialize();

      const result = await manager.execute(sampleWorkOrder);
      expect(result.signal).toBe('SIGNAL:SUCCESS');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should throw an AllApiKeysFailedError if no keys are initialized', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue({});
      await manager.initialize();
      await expect(manager.execute(sampleWorkOrder)).rejects.toThrow(AllApiKeysFailedError);
    });

    it('should failover to the next key if the first one has a retryable error', async () => {
      const failingKey: ApiKey = { id: 'a-failing', secret: 'fail-rate-limit', provider: 'openai' };
      const succeedingKey: ApiKey = { id: 'b-succeeding', secret: 'good', provider: 'openai' };
      mockStorageService.getAllApiKeys.mockResolvedValue({ [succeedingKey.id]: succeedingKey, [failingKey.id]: failingKey });
      await manager.initialize();

      const result = await manager.execute(sampleWorkOrder);
      expect(result.signal).toBe('SIGNAL:SUCCESS');
      expect(logger.warn).toHaveBeenCalledOnce();
    });

    it('should fail immediately if a non-retryable error occurs', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue({ key4: mockApiKeys['key4'] });
      await manager.initialize();

      await expect(manager.execute(sampleWorkOrder)).rejects.toThrow('MOCK ERROR: 500 Internal Server Error');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should throw an AllApiKeysFailedError if all keys fail with retryable errors', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue({ key2: mockApiKeys['key2'], key3: mockApiKeys['key3'] });
      await manager.initialize();

      await expect(manager.execute(sampleWorkOrder)).rejects.toThrow(AllApiKeysFailedError);
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('should correctly rotate through the keys in a round-robin fashion', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue({ key1: mockApiKeys['key1'], key2: mockApiKeys['key2'] });
      await manager.initialize(); // Order is key1, key2

      // First call uses key1 (succeeds). Index for next call becomes 1.
      await manager.execute(sampleWorkOrder);
      expect(manager['nextKeyIndex']).toBe(1);

      // Second call uses key2 (fails). Wraps around and uses key1 (succeeds). Index for next call becomes 1.
      await manager.execute(sampleWorkOrder);
      expect(logger.warn).toHaveBeenCalledOnce();
      expect(manager['nextKeyIndex']).toBe(1);
    });
  });
});