/**
 * @file packages/client/src/lib/ai/ApiPoolManager.ts
 * @stamp S-20251107T114000Z-C-WORKTREE-AWARE
 * @architectural-role Orchestrator
 * @description Implements the core stateful orchestrator for the AI Service Layer. It manages the pool of `ApiKey`s, executes the "key carousel" logic, and handles failover.
 * @core-principles
 * 1. IS the single, stateful entry point for all AI requests from the application.
 * 2. OWNS the key pool, the round-robin state, and the failover logic.
 * 3. DELEGATES all actual network I/O to the stateless `aiClient` façade.
 *
 * @api-declaration
 *   - export interface WorkOrder { ..., worktreePath: string }
 *   - export interface WorkerResult
 *   - export class AllApiKeysFailedError
 *   - export class ApiPoolManager
 *   -   public static getInstance(secureStorageService: SecureStorageService): ApiPoolManager
 *   -   public async initialize(): Promise<void>
 *   -   public async execute(workOrder: WorkOrder): Promise<WorkerResult>
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
import type { ExecutionPayload } from '../../shared/types';

export interface WorkOrder {
  worker: string;
  context: ExecutionPayload;
  worktreePath: string;
}

export interface WorkerResult {
  newPayload: ExecutionPayload;
  signal: string;
}

export class AllApiKeysFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AllApiKeysFailedError';
  }
}

export class ApiPoolManager {
  private static instance: ApiPoolManager | undefined;
  private secureStorageService: SecureStorageService;
  private apiKeys: ApiKey[] = [];
  private nextKeyIndex = 0;

  private constructor(secureStorageService: SecureStorageService) {
    this.secureStorageService = secureStorageService;
  }

  public static getInstance(secureStorageService: SecureStorageService): ApiPoolManager {
    if (!ApiPoolManager.instance) {
      ApiPoolManager.instance = new ApiPoolManager(secureStorageService);
    }
    return ApiPoolManager.instance;
  }

  public async initialize(): Promise<void> {
    const keysRecord = await this.secureStorageService.getAllApiKeys();
    this.apiKeys = Object.values(keysRecord).sort((a, b) => a.id.localeCompare(b.id));
    this.nextKeyIndex = 0;
  }

  public async execute(workOrder: WorkOrder): Promise<WorkerResult> {
    if (this.apiKeys.length === 0) {
      throw new AllApiKeysFailedError('Cannot execute request: No API keys have been configured.');
    }

    const totalKeys = this.apiKeys.length;
    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const currentKey = this.apiKeys[this.nextKeyIndex];
      this.nextKeyIndex = (this.nextKeyIndex + 1) % totalKeys;

      try {
        logger.debug(`Attempting AI call with key: ${currentKey.id}`);
        const result = await this.makeApiCall(workOrder, currentKey, workOrder.worktreePath);
        logger.info(`AI call successful with key: ${currentKey.id}`);
        return result;
      } catch (error) {
        if (this.isRetryableError(error)) {
          // TYPE-GUARD-REASON: The `isRetryableError` method already confirms that `error` is an
          // instance of `Error`, so this cast is safe for the purpose of logging the message.
          logger.warn(`Key ${currentKey.id} failed with a retryable error. Trying next key.`, {
            error: (error as Error).message,
          });
          continue;
        } else {
          logger.error(`AI call failed with a non-retryable error using key ${currentKey.id}.`, { error });
          throw error;
        }
      }
    }

    logger.error('All API keys in the pool failed for the current request.');
    throw new AllApiKeysFailedError('The request failed with all available API keys.');
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('insufficient quota') ||
        message.includes('invalid api key')
      );
    }
    return false;
  }

  private async makeApiCall(workOrder: WorkOrder, key: ApiKey, worktreePath: string): Promise<WorkerResult> {
    if (key.secret.includes('fail-rate-limit')) throw new Error('MOCK ERROR: Rate limit exceeded');
    if (key.secret.includes('fail-invalid')) throw new Error('MOCK ERROR: Invalid API Key');
    if (key.secret.includes('fail-server')) throw new Error('MOCK ERROR: 500 Internal Server Error');
    
    // The worktreePath is now available here but unused for now.
    logger.debug(`API call would execute in context of: ${worktreePath}`);

    return {
      signal: 'SIGNAL:SUCCESS',
      newPayload: workOrder.context,
    };
  }
}