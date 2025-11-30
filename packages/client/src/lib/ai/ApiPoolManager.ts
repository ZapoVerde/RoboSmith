/**
 * @file packages/client/src/lib/ai/ApiPoolManager.ts
 * @stamp 2025-11-30T23:00:00.000Z
 * @architectural-role Orchestrator
 * @description Implements the core stateful orchestrator for the AI Service Layer.
 * Manages the pool of `ApiKey`s, executes the "key carousel" logic, handles failover,
 * and performs durable logging and **retrieval** of AI transactions.
 * @core-principles
 * 1. IS the single, stateful entry point for all AI requests from the application.
 * 2. OWNS the key pool, the round-robin state, and the failover logic.
 * 3. LOGS every transaction to disk and PROVIDES history for the Inspector.
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
        this.logStorageUri = undefined;
      }
    }
  }

  /**
   * Retrieves the history of AI calls from the log directory.
   * Reads, parses, and sorts JSON files by timestamp (newest first).
   */
  public async getHistory(): Promise<AiCallLog[]> {
    if (!this.logStorageUri) {
      logger.warn('Cannot retrieve history: Log storage URI is not set.');
      return [];
    }

    try {
      // 1. Read directory
      const entries = await vscode.workspace.fs.readDirectory(this.logStorageUri);
      
      // 2. Filter for .json files
      const fileNames = entries
        .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
        .map(([name]) => name);

      const logs: AiCallLog[] = [];

      // 3. Read and parse each file
      for (const name of fileNames) {
        try {
          const fileUri = vscode.Uri.joinPath(this.logStorageUri, name);
          const content = await vscode.workspace.fs.readFile(fileUri);
          const jsonString = new TextDecoder().decode(content);
          const logEntry = JSON.parse(jsonString) as AiCallLog;
          logs.push(logEntry);
        } catch (error) {
          logger.warn(`Failed to parse log file: ${name}`, { error });
        }
      }

      // 4. Sort by timestamp descending
      return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    } catch (error) {
      logger.error('Failed to read AI call history.', { error });
      return [];
    }
  }

  public async execute(workOrder: WorkOrder): Promise<WorkerResult> {
    if (this.apiKeys.length === 0) {
      throw new AllApiKeysFailedError('Cannot execute request: No API keys have been configured.');
    }

    const callId = uuidv4();
    const startTime = Date.now();
    
    // Safety check for empty context
    const lastSegmentContent = workOrder.context[workOrder.context.length - 1]?.content;
    const promptPreview = typeof lastSegmentContent === 'string' 
        ? lastSegmentContent 
        : '(No context provided)';
        
    const model = 'gpt-4o';

    const totalKeys = this.apiKeys.length;
    let finalError: unknown;

    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const currentKey = this.apiKeys[this.nextKeyIndex];
      this.nextKeyIndex = (this.nextKeyIndex + 1) % totalKeys;

      try {
        logger.debug(`Attempting AI call with key: ${currentKey.id}`);
        const result = await this.makeApiCall(workOrder, currentKey, workOrder.worktreePath);
        
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
          logger.warn(`Key ${currentKey.id} failed with a retryable error. Trying next key.`, {
            error: (error as Error).message,
          });
          continue;
        } else {
          logger.error(`AI call failed with a non-retryable error using key ${currentKey.id}.`, { error });
          break;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    await this.logTransaction({
      callId,
      sessionId: workOrder.sessionId || 'unknown-session',
      stepName: workOrder.stepName,
      request: {
        provider: 'openai',
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

    throw new AllApiKeysFailedError('The request failed with all available API keys.');
  }

  private async logTransaction(logEntry: Omit<AiCallLog, 'timestamp'>): Promise<void> {
    if (!this.logStorageUri) return;

    try {
      const timestamp = new Date().toISOString();
      const fullLog: AiCallLog = { ...logEntry, timestamp };

      const sanitizedTime = timestamp.replace(/[:.]/g, '-');
      const filename = `${sanitizedTime}_${logEntry.callId}.json`;
      const fileUri = vscode.Uri.joinPath(this.logStorageUri, filename);

      const content = new TextEncoder().encode(JSON.stringify(fullLog, null, 2));
      await vscode.workspace.fs.writeFile(fileUri, content);
    } catch (error) {
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