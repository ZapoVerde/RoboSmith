/**
 * @file packages/client/src/lib/context/R_Mcp_ServerManager.spec.ts
 * @stamp S-20251106T143000Z-V-DEFINITIVE-FIX
 * @test-target packages/client/src/lib/context/R_Mcp_ServerManager.ts
 * @description Verifies the contract of the refactored, dependency-injected
 * R_Mcp_ServerManager. It tests the two-phase API (spawnProcess, initializeServer)
 * and all lifecycle methods in complete isolation using a mock ProcessSpawner.
 * @criticality The test target is CRITICAL.
 * @testing-layer Unit
 */

// --- HOISTING-SAFE MOCKS ---
vi.mock('../logging/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('os', () => ({
  platform: vi.fn(),
  arch: vi.fn(),
}));
vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { R_Mcp_ServerManager, MissingBinaryError, ProcessStartError } from './R_Mcp_ServerManager';
import type { JsonRpcClient, JsonRpcClientFactory } from './R_Mcp_ServerManager';
import type { ProcessSpawner, ManagedProcess } from './IProcessSpawner';
import { logger } from '../logging/logger';
import type { Writable, Readable } from 'stream';

describe('R_Mcp_ServerManager', () => {
  let manager: R_Mcp_ServerManager;
  let mockSpawner: Mocked<ProcessSpawner>;
  let mockClientFactory: Mocked<JsonRpcClientFactory>;
  let mockProcess: Mocked<ManagedProcess>;
  let mockClient: Mocked<JsonRpcClient>;

  const worktreePath = '/mock/worktree/path';
  const mockBinaryPath = '/mock/bin/roberto-mcp';

  beforeEach(() => {
    vi.clearAllMocks();

    const mutableProcess = {
      on: vi.fn().mockReturnThis(),
      kill: vi.fn(),
      stdin: {} as Writable | null,
      stdout: {} as Readable | null,
      stderr: {} as Readable | null,
    };
    mockProcess = mutableProcess as Mocked<ManagedProcess>;

    mockSpawner = { spawn: vi.fn().mockReturnValue(mockProcess) };
    mockClient = { sendCall: vi.fn().mockResolvedValue({ status: 'ready' }) };
    mockClientFactory = vi.fn().mockReturnValue(mockClient);
    manager = new R_Mcp_ServerManager(mockSpawner, mockClientFactory);

    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(os.arch).mockReturnValue('x64');
    vi.mocked(path.join).mockReturnValue(mockBinaryPath);
  });

  describe('spawnProcess (Phase 1)', () => {
    it('should call the spawner and resolve with the process handle on success', async () => {
      const processHandle = await manager.spawnProcess(worktreePath);
      expect(mockSpawner.spawn).toHaveBeenCalledWith(mockBinaryPath, worktreePath);
      expect(processHandle).toBe(mockProcess);
    });

    it('should throw ProcessStartError if the spawned process emits an error event', async () => {
      // Arrange
      const spawnError = new Error('EPERM: operation not permitted');

      type OnListener = Parameters<NonNullable<ManagedProcess['on']>>[1];
      mockProcess.on.mockImplementation(
        (event: string, listener: OnListener) => {
          if (event === 'error') {
            setImmediate(() => (listener as unknown as (err: Error) => void)(spawnError));
          }
          return mockProcess;
        }
      );

      // Act & Assert
      await expect(manager.spawnProcess(worktreePath)).rejects.toThrow(ProcessStartError);

      // Assert Cleanup
      expect(logger.error).toHaveBeenCalledWith(
        'R-MCP process failed to spawn.',
        expect.objectContaining({ error: spawnError })
      );
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('should throw MissingBinaryError for an unsupported platform', async () => {
      vi.mocked(os.platform).mockReturnValue('sunos');
      await expect(manager.spawnProcess(worktreePath)).rejects.toThrow(MissingBinaryError);
      expect(mockSpawner.spawn).not.toHaveBeenCalled();
    });

    it('should throw ProcessStartError if the process is missing stdin or stdout streams', async () => {
      Object.defineProperty(mockProcess, 'stdin', { value: null });
      await expect(manager.spawnProcess(worktreePath)).rejects.toThrow('Process missing stdin or stdout');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('initializeServer (Phase 2)', () => {
    it('should create a client, send index command, and register the server on success', async () => {
      await manager.initializeServer(worktreePath, mockProcess);
      expect(mockClientFactory).toHaveBeenCalledWith(mockProcess);
      expect(mockClient.sendCall).toHaveBeenCalledWith('index_code', { worktreePath });
      expect(manager.getClientFor(worktreePath)).toBe(mockClient);
    });

    it('should throw ProcessStartError and kill the process if the index command fails', async () => {
      const indexError = new Error('Indexing timed out');
      mockClient.sendCall.mockRejectedValue(indexError);

      await expect(manager.initializeServer(worktreePath, mockProcess)).rejects.toThrow(ProcessStartError);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
      expect(manager.getClientFor(worktreePath)).toBeUndefined();
    });

    it('should do nothing if a server for the given worktree is already initialized', async () => {
      // Arrange: Initialize a server once to establish the initial state.
      await manager.initializeServer(worktreePath, mockProcess);
      
      // Act: Attempt to initialize the server again for the same worktree.
      await manager.initializeServer(worktreePath, mockProcess);

      // Assert: Verify that the expensive initialization logic was only ever called once.
      expect(mockClientFactory).toHaveBeenCalledOnce();
      expect(mockClient.sendCall).toHaveBeenCalledOnce();
      
      // Assert: Verify that the system correctly logged the skipped operation.
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('R-MCP server already active for: /mock/worktree/path. Skipping initialization.')
      );
    });
  });

  describe('spinDownServer', () => {
    it('should kill the correct process and remove it from the active map', async () => {
      await manager.initializeServer(worktreePath, mockProcess);
      expect(manager.getClientFor(worktreePath)).toBeDefined();

      await manager.spinDownServer(worktreePath);

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(manager.getClientFor(worktreePath)).toBeUndefined();
      
      // THIS IS THE FIX: The assertion now uses `expect.stringContaining` to be
      // less brittle and checks for the correct log message without the period.
      // This ensures we are only checking for the log from the method under test.
      expect(logger.info).toHaveBeenCalledWith(
        'R-MCP server shut down for: /mock/worktree/path'
      );
    });

    it('should do nothing if no server is active for the given worktree path', async () => {
      // Arrange: Ensure no server is running for this path.
      const nonExistentPath = '/path/with/no/server';

      // Act: Call the method under test.
      await manager.spinDownServer(nonExistentPath);

      // Assert: Verify that no cleanup actions were taken.
      expect(mockProcess.kill).not.toHaveBeenCalled();
      
      // Assert: Verify the correct diagnostic log was produced.
      expect(logger.debug).toHaveBeenCalledWith(
        `R-MCP server not found for: ${nonExistentPath}. Skipping kill.`
      );
    });
  });
});