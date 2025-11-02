/**
 * @file packages/client/src/lib/ai/ApiPoolManager.ts
 * @stamp S-20251101-T144500Z-C-TYPEFIX
 * @architectural-role Orchestrator
 * @description
 * A singleton service that manages a pool of API keys. It is responsible for
 * orchestrating outgoing AI API calls using a resilient, failover-driven
 * round-robin strategy. It abstracts API key failures and rate limits from
 * the rest of the application, automatically retrying requests with the next
 * available key.
 * @core-principles
 * 1. IS the single source of truth for managing and dispatching API keys.
 * 2. OWNS the stateful round-robin and failover logic for all AI requests.
 * 3. MUST abstract key-specific API failures (e.g., rate limits, invalid keys) from its consumers.
 * 4. DELEGATES all secure key persistence to the injected SecureStorageService.
 *
 * @api-declaration
 *   - export class ApiPoolManager
 *   -   public static getInstance(secureStorageService: SecureStorageService): ApiPoolManager
 *   -   public async initialize(): Promise<void>
 *   -   public async execute(workOrder: WorkOrder): Promise<string>
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # This service manages its own internal state (the key list and index).
 *     - external_io: "https_apis" # This service is the primary gateway for making external AI API calls.
 *     - state_ownership: "['apiKeys', 'nextKeyIndex']" # Owns the pool of keys and the pointer for the round-robin.
 */

import type { ApiKey } from '@shared/domain/api-key';
import { SecureStorageService } from './SecureStorageService';
import { logger } from '../logging/logger';

// --- Type Definitions for Work Orders and Errors ---

/** A generic representation of a task to be performed by an AI provider. */
export interface WorkOrder {
  provider: ApiKey['provider'];
  prompt: string;
  // Other parameters like 'model', 'temperature' can be added here.
}

/** Custom error thrown when all keys in the pool have been tried and failed. */
export class AllApiKeysFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AllApiKeysFailedError';
  }
}

// --- Singleton ApiPoolManager Class ---

export class ApiPoolManager {
  // CORRECTED: The type now correctly reflects that the instance can be undefined.
  private static instance: ApiPoolManager | undefined;
  private secureStorageService: SecureStorageService;
  private apiKeys: ApiKey[] = [];
  private nextKeyIndex = 0;

  /** The constructor is private to enforce the singleton pattern. */
  private constructor(secureStorageService: SecureStorageService) {
    this.secureStorageService = secureStorageService;
  }

  /**
   * Gets the single, shared instance of the ApiPoolManager.
   * @param secureStorageService The service for handling secure key storage.
   * @returns The singleton instance of the ApiPoolManager.
   */
  public static getInstance(secureStorageService: SecureStorageService): ApiPoolManager {
    if (!ApiPoolManager.instance) {
      ApiPoolManager.instance = new ApiPoolManager(secureStorageService);
    }
    return ApiPoolManager.instance;
  }

  /**
   * Initializes the manager by loading all available API keys from secure storage.
   * This is part of the existing functionality and is preserved.
   */
  public async initialize(): Promise<void> {
    const keysRecord = await this.secureStorageService.getAllApiKeys();
    // Ensure keys are always in a consistent order for predictable round-robin.
    this.apiKeys = Object.values(keysRecord).sort((a, b) => a.id.localeCompare(b.id));
    this.nextKeyIndex = 0;
    logger.info(`ApiPoolManager initialized with ${this.apiKeys.length} keys.`);
  }

  /**
   * Executes a work order using the pool of API keys with a failover-driven
   * round-robin strategy. It will try each key in sequence until one succeeds
   * or until all have failed with a retryable error.
   * @param workOrder The request to be sent to the AI provider.
   * @returns A promise that resolves with the AI's response string.
   * @throws {AllApiKeysFailedError} If all keys in the pool fail.
   * @throws {Error} If a non-retryable error occurs (e.g., a server error).
   */
  public async execute(workOrder: WorkOrder): Promise<string> {
    if (this.apiKeys.length === 0) {
      logger.error('API execution failed: No API keys are available in the pool.');
      throw new AllApiKeysFailedError('Cannot execute request: No API keys have been configured.');
    }

    const totalKeys = this.apiKeys.length;
    // We will attempt a request with each key at most once.
    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const currentKey = this.apiKeys[this.nextKeyIndex];

      // Advance the index for the *next* operation immediately. This ensures
      // rotation happens whether the current attempt succeeds or fails.
      this.nextKeyIndex = (this.nextKeyIndex + 1) % totalKeys;

      try {
        logger.debug(`Attempting AI call with key: ${currentKey.id}`);
        // In a real implementation, this would call the actual AI service.
        const result = await this.makeApiCall(workOrder, currentKey);
        logger.info(`AI call successful with key: ${currentKey.id}`);
        // On success, we return the result immediately.
        return result;
      } catch (error) {
        if (this.isRetryableError(error)) {
          logger.warn(`Key ${currentKey.id} failed with a retryable error. Trying next key.`, {
            error: (error as Error).message,
          });
          // The loop will now continue to the next key.
          continue;
        } else {
          // If the error is not retryable (e.g., bad request, server error),
          // we should fail fast and not attempt other keys.
          logger.error(`AI call failed with a non-retryable error using key ${currentKey.id}.`, {
            error,
          });
          throw error;
        }
      }
    }

    // If the loop completes, it means every key was tried and failed.
    logger.error('All API keys in the pool failed for the current request.');
    throw new AllApiKeysFailedError(
      'The request failed with all available API keys. Check logs for details.'
    );
  }

  /**
   * A helper to determine if an error from an API call is one that
   * justifies retrying with a different key.
   * @param error The error object from a failed API call.
   * @returns `true` if the error is related to the key, `false` otherwise.
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // In a real application, you would check for specific status codes (e.g., 401, 403, 429).
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('insufficient quota') ||
        message.includes('invalid api key')
      );
    }
    return false;
  }

  /**
   * A mock function to simulate making a real API call.
   * This would be replaced with actual fetch/axios calls to AI providers.
   */
  private async makeApiCall(workOrder: WorkOrder, key: ApiKey): Promise<string> {
    // --- SIMULATION LOGIC ---
    // This allows us to test the failover logic.
    if (key.secret.includes('fail-rate-limit')) {
      throw new Error('MOCK ERROR: Rate limit exceeded');
    }
    if (key.secret.includes('fail-invalid')) {
      throw new Error('MOCK ERROR: Invalid API Key');
    }
    if (key.secret.includes('fail-server')) {
      throw new Error('MOCK ERROR: 500 Internal Server Error');
    }
    // --- END SIMULATION ---

    // Successful response
    return `Success from ${workOrder.provider} with prompt: "${workOrder.prompt}"`;
  }
}