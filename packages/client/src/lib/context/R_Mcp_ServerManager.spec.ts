/**
 * @file packages/client/src/lib/context/R_Mcp_ServerManager.spec.ts
 * @stamp S-20251105T155000Z-C-FINAL-CLEANUP
 * @test-target packages/client/src/lib/context/R_Mcp_ServerManager.ts
 * @description
 * Verifies the contract of the R_Mcp_ServerManager, ensuring it correctly implements the
 * singleton pattern, the stateful lifecycle of R-MCP processes, and the failover
 * logic for process spawning and initial indexing.
 * @criticality
 * CRITICAL (Reason: State Store Ownership, I/O & Concurrency Management).
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     purity: read-only      # The test is read-only.
 *     external_io: none      # All I/O is mocked.
 *     state_ownership: none  # The test does not own application state.
 */

// --- HOISTING-SAFE MOCKS ---

// Mock Logger and OS
vi.mock('../logging/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }));
  vi.mock('os', () => ({
    platform: vi.fn(),
    arch: vi.fn(),
  }));
  
  // Mock child_process and path (spawn logic is custom-mocked per test)
  vi.mock('child_process', () => ({
    spawn: vi.fn(),
  }));
  vi.mock('path', async (importOriginal) => {
    const actual = await importOriginal<typeof import('path')>();
    return {
      ...actual,
      join: vi.fn((...args) => args.join('/')), // Simple string join for predictable paths
    };
  });
  
  // --- Imports ---
  // FIX 1: Add explicit imports for path and ChildProcess
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import type { Mock, Mocked } from 'vitest';
  import { spawn, type ChildProcess } from 'child_process';
  import * as path from 'path';
  import * as os from 'os';
  import {
    R_Mcp_ServerManager,
    MissingBinaryError,
    ProcessStartError,
    type JsonRpcClient,
    type JsonRpcClientFactory,
    type ProcessStreamProvider,
  } from './R_Mcp_ServerManager';
  import { logger } from '../logging/logger';
  import type { Writable, Readable } from 'stream';
  
  // --- Test Helper Types ---
  
  // The concrete mock implementation for the abstract ProcessStreamProvider
  type MockProcess = Mocked<ProcessStreamProvider> & {
      emit: (event: 'error' | 'close', data?: unknown) => void;
  };
  
  // --- Test Mocks ---
  
  // Mock implementation of the abstract factory for use in setup.
  const mockClientFactory: JsonRpcClientFactory = vi.fn((_mockProcess: ProcessStreamProvider) => { // FIX 2: Prefix parameter with '_'
      return {
          sendCall: vi.fn(),
      } as unknown as JsonRpcClient;
  });
  
  // The single, clean process mock template.
  const createMockProcess = (): MockProcess => {
      // 1. Create the base mock object structure, using vi.fn() for controllable methods.
      const mockProcess = {
          stdin: {} as unknown as Writable,
          stdout: {} as unknown as Readable,
          stderr: {} as unknown as Readable,
          on: vi.fn(), // Mocked 'on' to store event handlers
          kill: vi.fn(),
      };
      
      // 2. Define the custom emit helper that calls handlers stored by the 'on' mock.
      const customEmit = (event: string, data?: unknown) => {
          // Find all mock calls to 'on' that match the event name and execute their handler
          mockProcess.on.mock.calls.filter(call => call[0] === event)
              .forEach(call => {
                  const handler = call[1]; // Handler is the second argument to 'on'
                  handler(data);
              });
      };
      
      // 3. Combine the mock process and the custom emit helper.
      const combinedMock = {
          ...mockProcess,
          emit: customEmit,
      };
  
      // 4. CRITICAL FIX: Use 'as unknown as' to safely bypass the complex type incompatibility
      // between vi.fn() and the deeply overloaded ChildProcess['on'] signature.
      return combinedMock as unknown as MockProcess;
  };
  
  describe('R_Mcp_ServerManager', () => {
      let manager: R_Mcp_ServerManager;
      const worktreePath = '/mock/worktree/path';
      const mockBinaryPath = '/mock/bin/roberto-mcp-linux-x64';
  
      beforeEach(() => {
          vi.clearAllMocks();
          R_Mcp_ServerManager['instance'] = undefined;
          manager = R_Mcp_ServerManager.getInstance(mockClientFactory);
  
          // Default OS/Arch for happy path tests
          vi.mocked(os.platform).mockReturnValue('linux');
          vi.mocked(os.arch).mockReturnValue('x64');
  
          // Default path join for predictable binary resolution
          vi.mocked(path.join).mockReturnValue(mockBinaryPath);
  
          // Reset the factory call count
          (mockClientFactory as Mock).mockClear();
      });
  
      it('should always return the same instance (Singleton Pattern)', () => {
          const anotherInstance = R_Mcp_ServerManager.getInstance(mockClientFactory);
          expect(manager).toBe(anotherInstance);
      });
  
      it('should throw MissingBinaryError for an unsupported platform during spinUpServer', async () => {
          vi.mocked(os.platform).mockReturnValue('sunos');
          await expect(manager.spinUpServer(worktreePath)).rejects.toThrow(MissingBinaryError);
          expect(spawn).not.toHaveBeenCalled();
      });
  
      describe('Successful Lifecycle', () => {
          let mockProcess: MockProcess;
          let mockClient: Mocked<JsonRpcClient>;
  
          beforeEach(() => {
              mockProcess = createMockProcess();
              // Mock spawn to return our controlled process
              vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ChildProcess);
  
              // Mock the factory to return a client whose 'index_code' is successful
              mockClient = { sendCall: vi.fn().mockResolvedValue({ status: 'ready' }) } as Mocked<JsonRpcClient>;
              (mockClientFactory as Mock).mockReturnValue(mockClient);
          });
  
          it('should correctly spawn the process and await initial indexing (Happy Path)', async () => {
              await manager.spinUpServer(worktreePath);
  
              expect(spawn).toHaveBeenCalledWith(
                  mockBinaryPath,
                  ['--server'],
                  expect.objectContaining({ cwd: worktreePath })
              );
              expect(mockClientFactory).toHaveBeenCalledOnce();
              expect(mockClient.sendCall).toHaveBeenCalledWith('index_code', { worktreePath });
              expect(manager.getClientFor(worktreePath)).toBe(mockClient);
          });
  
          it('should return immediately if a server for that worktree is already active', async () => {
              await manager.spinUpServer(worktreePath);
              await manager.spinUpServer(worktreePath); // Second call
  
              expect(spawn).toHaveBeenCalledTimes(1);
              expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('already active'));
          });
  
          it('should call SIGTERM and remove the entry on spinDownServer', async () => {
              await manager.spinUpServer(worktreePath);
              expect(manager.getClientFor(worktreePath)).toBeDefined();
  
              await manager.spinDownServer(worktreePath);
  
              expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
              expect(manager.getClientFor(worktreePath)).toBeUndefined();
          });
      });
  
      describe('Failure Handling', () => {
          it('should throw ProcessStartError and remove entry if process fails to spawn', async () => {
              const mockProcess = createMockProcess();
              vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ChildProcess);
  
              const startPromise = manager.spinUpServer(worktreePath);
  
              // Simulate the 'error' event that happens when spawn fails (e.g., EPERM)
              mockProcess.emit('error', new Error('EPERM'));
  
              await expect(startPromise).rejects.toThrow(ProcessStartError);
              expect(manager.getClientFor(worktreePath)).toBeUndefined();
              expect(logger.error).toHaveBeenCalled();
          });
  
          it('should kill the process and throw ProcessStartError if initial indexing fails', async () => {
              const mockProcess = createMockProcess();
              vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ChildProcess);
  
              // Mock the client to reject the first call
              const mockClient = { sendCall: vi.fn().mockRejectedValue(new Error('Indexing failed')) } as Mocked<JsonRpcClient>;
              (mockClientFactory as Mock).mockReturnValue(mockClient);
  
              await expect(manager.spinUpServer(worktreePath)).rejects.toThrow(ProcessStartError);
  
              expect(mockClient.sendCall).toHaveBeenCalled();
              expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
              expect(manager.getClientFor(worktreePath)).toBeUndefined();
              expect(logger.error).toHaveBeenCalled();
          });
      });
  });