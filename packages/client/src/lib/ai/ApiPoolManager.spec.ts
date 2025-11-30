/**
 * @file packages/client/src/lib/ai/ApiPoolManager.spec.ts
 * @stamp 2025-11-30T18:35:00.000Z
 * @test-target packages/client/src/lib/ai/ApiPoolManager.ts
 * @description
 * Verifies the complete functionality of the ApiPoolManager, including singleton
 * mechanics, failover logic, and the new **AI Call Logging** feature.
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
import type { ApiKey } from '@shared/domain/api-key';
import * as vscode from 'vscode';

// --- 1. Hoisted Mocks ---

// FIX: Mock 'uuid' to prevent "Cannot read properties of undefined (reading 'v1')" error
// caused by Vitest/CJS interop issues with the uuid library.
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-call-id-1234'),
}));

const { mockWriteFile, mockCreateDirectory } = vi.hoisted(() => ({
  mockWriteFile: vi.fn(),
  mockCreateDirectory: vi.fn(),
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
    }
  },
  SecretStorage: class {},
  default: {},
}));

// --- 3. Dependency Mocks ---
vi.mock('./SecureStorageService');
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
      
      // Decode the buffer passed to writeFile
      const [uriArg, bufferArg] = mockWriteFile.mock.calls[0];
      const logContent = JSON.parse(new TextDecoder().decode(bufferArg));

      // Verify File Path Construction
      expect(uriArg.fsPath).toMatch(/\/path\/to\/logs\/.*_.*\.json$/);

      // Verify Log Content
      expect(logContent).toMatchObject({
        callId: 'mock-call-id-1234', // Verified against our mock
        sessionId: 'session-123',
        stepName: 'Step_Generate',
        request: {
          provider: 'openai',
          model: 'gpt-4o',
          prompt: expect.stringContaining('hello world')
        },
        response: {
          content: expect.stringContaining('SUCCESS')
        }
      });
      expect(logContent.timestamp).toBeDefined();
      expect(logContent.error).toBeUndefined();
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
  
        expect(logContent).toMatchObject({
          callId: 'mock-call-id-1234',
          sessionId: 'session-123',
          error: 'MOCK ERROR: 500 Internal Server Error'
        });
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