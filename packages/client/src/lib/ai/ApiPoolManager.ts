/**
 * @file packages/client/src/lib/ai/ApiPoolManager.ts
 * @stamp S-20251101-T135000Z-C-FIXED
 * @architectural-role Orchestrator
 * @description Implements the core stateful orchestrator for the AI Service Layer. It manages the pool of `ApiKey`s, executes the "key carousel" logic, and handles failover.
 * @core-principles
 * 1. IS the single, stateful entry point for all AI requests from the application.
 * 2. OWNS the key pool, the round-robin state, and the failover logic.
 * 3. DELEGATES all actual network I/O to the stateless `aiClient` façade.
 *
 * @api-declaration
 *   - export class ApiPoolManager
 *     - public static getInstance(secureStorage: SecureStorageService): ApiPoolManager
 *     - public async initialize(): Promise<void>
 *     - public async execute(workOrder: WorkOrder): Promise<ApiResult>
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"
 *     - external_io: 'SecureStorageService'
 *     - state_ownership: "['apiKeyPool', 'lastUsedKeyIndex', 'cooldowns']"
 */

import { SecureStorageService } from './SecureStorageService';
import { aiClient } from './aiClient';
import type { ApiKey, ApiResult, WorkOrder } from './types';

export class ApiPoolManager {
  private static instance: ApiPoolManager | null = null;

  private readonly secureStorage: SecureStorageService;
  private apiKeyPool: ApiKey[] = [];
  private lastUsedKeyIndex = -1;
  private cooldowns = new Map<string, number>(); // Maps key.id to cooldown expiry timestamp
  private readonly COOLDOWN_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor(secureStorage: SecureStorageService) {
    this.secureStorage = secureStorage;
  }

  public static getInstance(secureStorage: SecureStorageService): ApiPoolManager {
    if (!ApiPoolManager.instance) {
      ApiPoolManager.instance = new ApiPoolManager(secureStorage);
    }
    return ApiPoolManager.instance;
  }

  public async initialize(): Promise<void> {
    const keysRecord = await this.secureStorage.getAllApiKeys();
    this.apiKeyPool = Object.values(keysRecord);
  }

  public async execute(workOrder: WorkOrder): Promise<ApiResult> {
    const now = Date.now();

    // This logic is refactored to be fully type-safe without non-null assertions.
    const availableKeys = this.apiKeyPool.filter((key) => {
      const cooldownExpiry = this.cooldowns.get(key.id);
      // A key is available if it's not on cooldown (expiry is undefined),
      // or if it is on cooldown, but the cooldown has expired.
      return cooldownExpiry === undefined || now > cooldownExpiry;
    });

    if (availableKeys.length === 0) {
      return {
        success: false,
        error: 'No available API keys. All keys may be on cooldown or none are configured.',
      };
    }

    // This loop attempts each available key once, in a round-robin fashion.
    for (let i = 0; i < availableKeys.length; i++) {
      const keyIndexInAvailable = (this.lastUsedKeyIndex + 1 + i) % availableKeys.length;
      const apiKey = availableKeys[keyIndexInAvailable];
      let result: ApiResult;

      try {
        result = await aiClient.generateCompletion(apiKey, workOrder);
      } catch (error) {
        console.error(`Unexpected error for key ${apiKey.id}:`, error);
        result = { success: false, error: 'Caught unexpected exception.' };
      }

      if (result.success) {
        // Find the index in the *original* pool to maintain state correctly
        this.lastUsedKeyIndex = this.apiKeyPool.findIndex((poolKey) => poolKey.id === apiKey.id);
        return result;
      } else {
        // If the API call failed, put the key on cooldown.
        this.cooldowns.set(apiKey.id, now + this.COOLDOWN_DURATION);
      }
    }

    return {
      success: false,
      error: 'All available API keys failed to process the request.',
    };
  }
}