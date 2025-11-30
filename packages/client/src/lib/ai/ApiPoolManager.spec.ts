/**
 * @file packages/client/src/lib/ai/ApiPoolManager.spec.ts
 * @stamp 2025-11-30T23:20:00.000Z
 * @test-target packages/client/src/lib/ai/ApiPoolManager.ts
 * @description
 * Verifies the complete functionality of the ApiPoolManager, including singleton
 * mechanics, failover logic, AI Call Logging (Write), and History Retrieval (Read).
 * @criticality CRITICAL
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     purity: pure          # Mocks external I/O (filesystem, secure storage).
 *     external_io: none
 *     state_ownership: none
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { ApiPoolManager, AllApiKeysFailedError, type WorkOrder } from './ApiPoolManager';
import { SecureStorageService } from './SecureStorageService';
import { logger } from '../logging/logger';
import type { ApiKey } from '@shared/domain/api-key';
import * as vscode from 'vscode';

// --- 1. Hoisted Mocks for FS ---
const { mockWriteFile, mockCreateDirectory, mockReadDirectory, mockReadFile } = vi.hoisted(() => ({
  mockWriteFile: vi.fn(),
  mockCreateDirectory: vi.fn(),
  mockReadDirectory: vi.fn(),
  mockReadFile: vi.fn(),
}));

// --- 2. VS Code API Mock ---
vi.mock('vscode', () => ({
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path, path, scheme: 'file', toString: () => path })),
    joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => ({
      fsPath: `${base.fsPath}/${parts.join('/')}`,
      scheme: 'file',
      toString: () => `${base.fsPath}/${parts.join('/')}`
    })),
  },
  workspace: {
    fs: {
      writeFile: mockWriteFile,
      createDirectory: mockCreateDirectory,
      readDirectory: mockReadDirectory,
      readFile: mockReadFile,
    }
  },
  FileType: { File: 1, Directory: 2 },
  SecretStorage: class {},
  default: {},
}));

// --- 3. Dependency Mocks ---
vi.mock('./SecureStorageService');
vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-call-id-1234') }));
vi.mock('../logging/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('ApiPoolManager', () => {
  let mockStorageService: Mocked<SecureStorageService>;
  let manager: ApiPoolManager;

  const mockApiKeys: Record<string, ApiKey> = {
    key1: { id: 'key1-openai', provider: 'openai', secret: 'sk-good' },
    key2: { id: 'key2-bad', provider: 'google', secret: 'gk-fail-server' },
  };

  const sampleWorkOrder: WorkOrder = {
    worker: 'Worker:Test',
    context: [{ id: '1', type: 'text', content: 'hello world', timestamp: '' }],
    worktreePath: '/mock/worktree',
    sessionId: 'session-123',
    stepName: 'Step_Generate',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton
    ApiPoolManager['instance'] = undefined;
    
    mockStorageService = new SecureStorageService({} as vscode.SecretStorage) as Mocked<SecureStorageService>;
    mockStorageService.getAllApiKeys.mockResolvedValue(mockApiKeys);
    
    manager = ApiPoolManager.getInstance(mockStorageService);
  });

  describe('Logging Infrastructure', () => {
    it('should create the log directory during initialization if path provided', async () => {
      await manager.initialize('/path/to/logs');
      expect(mockCreateDirectory).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/path/to/logs' }));
    });

    it('should NOT create log directory if path is missing', async () => {
      await manager.initialize(undefined);
      expect(mockCreateDirectory).not.toHaveBeenCalled();
    });
  });

  describe('Transaction Logging', () => {
    beforeEach(async () => {
      // Ensure logs are enabled for these tests
      await manager.initialize('/path/to/logs');
    });

    it('should write a structured JSON log on successful execution', async () => {
      // Arrange: key1 will succeed
      mockStorageService.getAllApiKeys.mockResolvedValue({ key1: mockApiKeys['key1'] });
      await manager.initialize('/path/to/logs'); // Re-init to pick up keys

      // Act
      await manager.execute(sampleWorkOrder);

      // Assert
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      
      const [uriArg, bufferArg] = mockWriteFile.mock.calls[0];
      const logContent = JSON.parse(new TextDecoder().decode(bufferArg));

      expect(uriArg.fsPath).toMatch(/\/path\/to\/logs\/.*_.*\.json$/);
      expect(logContent).toMatchObject({
        callId: 'mock-call-id-1234',
        sessionId: 'session-123',
        stepName: 'Step_Generate',
        request: {
          provider: 'openai',
          prompt: expect.stringContaining('hello world')
        },
        response: {
          content: expect.stringContaining('SUCCESS')
        }
      });
    });

    it('should write a structured JSON log on failure', async () => {
        // Arrange: key2 fails non-retryably
        mockStorageService.getAllApiKeys.mockResolvedValue({ key2: mockApiKeys['key2'] });
        await manager.initialize('/path/to/logs');
  
        // Act & Assert
        await expect(manager.execute(sampleWorkOrder)).rejects.toThrow();
  
        expect(mockWriteFile).toHaveBeenCalledTimes(1);
        const [_, bufferArg] = mockWriteFile.mock.calls[0];
        const logContent = JSON.parse(new TextDecoder().decode(bufferArg));
        expect(logContent.error).toContain('MOCK ERROR: 500 Internal Server Error');
    });
  });

  describe('History Retrieval (getHistory)', () => {
    it('should return empty array if log path not initialized', async () => {
      await manager.initialize(undefined);
      const history = await manager.getHistory();
      expect(history).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Log storage URI is not set'));
    });

    it('should retrieve, parse, and sort log files', async () => {
      // Arrange
      await manager.initialize('/path/to/logs');

      // Mock Directory Listing
      mockReadDirectory.mockResolvedValue([
        ['old_log.json', vscode.FileType.File],
        ['new_log.json', vscode.FileType.File],
        ['not_a_log.txt', vscode.FileType.File],
        ['subdir', vscode.FileType.Directory],
      ]);

      // Mock File Contents
      const log1 = { callId: '1', timestamp: '2023-01-01T10:00:00Z', request: {} };
      const log2 = { callId: '2', timestamp: '2023-01-02T10:00:00Z', request: {} };

      // We handle the calls based on the uri passed to readFile
      mockReadFile.mockImplementation(async (uri: { fsPath: string }) => {
        if (uri.fsPath.endsWith('old_log.json')) {
          return new TextEncoder().encode(JSON.stringify(log1));
        }
        if (uri.fsPath.endsWith('new_log.json')) {
          return new TextEncoder().encode(JSON.stringify(log2));
        }
        return new Uint8Array();
      });

      // Act
      const history = await manager.getHistory();

      // Assert
      expect(mockReadDirectory).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/path/to/logs' }));
      expect(history).toHaveLength(2);
      // Verify Sorting (Newest first)
      expect(history[0].callId).toBe('2');
      expect(history[1].callId).toBe('1');
    });

    it('should gracefully handle corrupt log files', async () => {
      // Arrange
      await manager.initialize('/path/to/logs');
      mockReadDirectory.mockResolvedValue([['corrupt.json', vscode.FileType.File]]);
      mockReadFile.mockResolvedValue(new TextEncoder().encode('{ invalid json '));

      // Act
      const history = await manager.getHistory();

      // Assert
      expect(history).toEqual([]);
      // FIX: Match both the message string and the context object
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse log file'),
        expect.anything()
      );
    });
  });

  describe('Core Failover Logic (Regression Tests)', () => {
    it('should succeed on the first attempt if valid', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue({ key1: mockApiKeys['key1'] });
      await manager.initialize();
      const result = await manager.execute(sampleWorkOrder);
      expect(result.signal).toBe('SIGNAL:SUCCESS');
    });

    it('should throw AllApiKeysFailedError if no keys configured', async () => {
      mockStorageService.getAllApiKeys.mockResolvedValue({});
      await manager.initialize();
      await expect(manager.execute(sampleWorkOrder)).rejects.toThrow(AllApiKeysFailedError);
    });
  });
});