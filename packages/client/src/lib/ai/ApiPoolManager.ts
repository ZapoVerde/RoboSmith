/**
 * @file packages/client/src/lib/ai/ApiPoolManager.ts
 * @stamp 2025-11-30T18:05:00.000Z
 * @architectural-role Orchestrator
 * @description Implements the core stateful orchestrator for the AI Service Layer.
 * Manages the pool of `ApiKey`s, executes the "key carousel" logic, handles failover,
 * and performs durable logging of all AI transactions for the Inspector.
 * @core-principles
 * 1. IS the single, stateful entry point for all AI requests from the application.
 * 2. OWNS the key pool, the round-robin state, and the failover logic.
 * 3. LOGS every transaction to disk for the AI Call Inspector.
 *
 * @api-declaration
 *   - export interface WorkOrder
 *   - export interface WorkerResult
 *   - export class AllApiKeysFailedError
 *   - export class ApiPoolManager
 *
 * @contract
 *   assertions:
 *     purity: mutates
 *     external_io: https_apis_and_filesystem
 *     state_ownership: ['apiKeys', 'nextKeyIndex', 'logStorageUri']
 */

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import type { ApiKey } from '@shared/domain/api-key';
import { SecureStorageService } from './SecureStorageService';
import { logger } from '../logging/logger';
import type { ExecutionPayload, AiCallLog } from '../../shared/types';

export interface WorkOrder {
  worker: string;
  context: ExecutionPayload;
  worktreePath: string;
  // Context for logging
  sessionId?: string;
  stepName?: string;
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
  private logStorageUri: vscode.Uri | undefined;

  private constructor(secureStorageService: SecureStorageService) {
    this.secureStorageService = secureStorageService;
  }

  public static getInstance(secureStorageService: SecureStorageService): ApiPoolManager {
    if (!ApiPoolManager.instance) {
      ApiPoolManager.instance = new ApiPoolManager(secureStorageService);
    }
    return ApiPoolManager.instance;
  }

  /**
   * Initializes the manager and sets the log storage path.
   * @param logStoragePath Absolute path to the .vision/logs directory.
   */
  public async initialize(logStoragePath?: string): Promise<void> {
    const keysRecord = await this.secureStorageService.getAllApiKeys();
    this.apiKeys = Object.values(keysRecord).sort((a, b) => a.id.localeCompare(b.id));
    this.nextKeyIndex = 0;

    if (logStoragePath) {
      this.logStorageUri = vscode.Uri.file(logStoragePath);
      try {
        // Ensure the log directory exists
        await vscode.workspace.fs.createDirectory(this.logStorageUri);
      } catch (error) {
        logger.error('Failed to create AI log directory', { path: logStoragePath, error });
        // We do not throw here; logging failure should not prevent extension startup.
        this.logStorageUri = undefined;
      }
    }
  }

  public async execute(workOrder: WorkOrder): Promise<WorkerResult> {
    if (this.apiKeys.length === 0) {
      throw new AllApiKeysFailedError('Cannot execute request: No API keys have been configured.');
    }

    // Prepare log metadata
    const callId = uuidv4();
    const startTime = Date.now();
    // For V1 logging, we grab a preview of the context. In a real impl, we'd log the full assembled prompt.
    const promptPreview = JSON.stringify(workOrder.context.slice(-1)[0]?.content || '(No context)');
    const model = 'gpt-4o'; // Default for V1

    const totalKeys = this.apiKeys.length;
    let finalError: unknown;

    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const currentKey = this.apiKeys[this.nextKeyIndex];
      this.nextKeyIndex = (this.nextKeyIndex + 1) % totalKeys;

      try {
        logger.debug(`Attempting AI call with key: ${currentKey.id}`);
        const result = await this.makeApiCall(workOrder, currentKey, workOrder.worktreePath);
        
        // Log Success
        const durationMs = Date.now() - startTime;
        await this.logTransaction({
          callId,
          sessionId: workOrder.sessionId || 'unknown-session',
          stepName: workOrder.stepName,
          request: {
            provider: currentKey.provider,
            model,
            prompt: promptPreview,
          },
          response: {
            // In V1 mock, we don't have the raw AI text here, just the payload.
            content: 'SUCCESS (Content merged into payload)', 
            durationMs,
            tokensUsed: { total: 0 },
          },
        });

        logger.info(`AI call successful with key: ${currentKey.id}`);
        return result;

      } catch (error) {
        finalError = error;
        if (this.isRetryableError(error)) {
          // TYPE-GUARD-REASON: Verified instanceof Error in isRetryableError
          logger.warn(`Key ${currentKey.id} failed with a retryable error. Trying next key.`, {
            error: (error as Error).message,
          });
          continue;
        } else {
          logger.error(`AI call failed with a non-retryable error using key ${currentKey.id}.`, { error });
          break; // Don't retry fatal errors
        }
      }
    }

    // Log Final Failure
    const durationMs = Date.now() - startTime;
    await this.logTransaction({
      callId,
      sessionId: workOrder.sessionId || 'unknown-session',
      stepName: workOrder.stepName,
      request: {
        provider: 'openai', // Default fallback
        model,
        prompt: promptPreview,
      },
      response: {
        content: '',
        durationMs,
        tokensUsed: {},
      },
      error: finalError instanceof Error ? finalError.message : String(finalError),
    });

    logger.error('All API keys in the pool failed for the current request.');
    throw new AllApiKeysFailedError('The request failed with all available API keys.');
  }

  private async logTransaction(logEntry: Omit<AiCallLog, 'timestamp'>): Promise<void> {
    if (!this.logStorageUri) return;

    try {
      const timestamp = new Date().toISOString();
      const fullLog: AiCallLog = { ...logEntry, timestamp };

      // Filename: ISO timestamp (sanitized) + callId
      const sanitizedTime = timestamp.replace(/[:.]/g, '-');
      const filename = `${sanitizedTime}_${logEntry.callId}.json`;
      const fileUri = vscode.Uri.joinPath(this.logStorageUri, filename);

      const content = new TextEncoder().encode(JSON.stringify(fullLog, null, 2));
      await vscode.workspace.fs.writeFile(fileUri, content);
    } catch (error) {
      // Logging failure should not crash the app, but we log the error.
      logger.error('Failed to write AI call log.', { error });
    }
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
    // V1 Implementation Note: This is currently a mock simulation.
    // In V2, this will delegate to `aiClient.generateCompletion`.
    
    if (key.secret.includes('fail-rate-limit')) throw new Error('MOCK ERROR: Rate limit exceeded');
    if (key.secret.includes('fail-invalid')) throw new Error('MOCK ERROR: Invalid API Key');
    if (key.secret.includes('fail-server')) throw new Error('MOCK ERROR: 500 Internal Server Error');
    
    logger.debug(`API call would execute in context of: ${worktreePath}`);

    return {
      signal: 'SIGNAL:SUCCESS',
      newPayload: workOrder.context,
    };
  }
}