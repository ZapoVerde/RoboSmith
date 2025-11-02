/**
 * @file packages/client/src/lib/context/ContextPartitionerService.spec.ts
 * @stamp S-20251101T162500Z-V-COMPLIANT
 * @test-target packages/client/src/lib/context/ContextPartitionerService.ts
 * @description
 * Verifies the contract of the ContextPartitionerService. It ensures the service
 * correctly selects the platform-specific binary, spawns a child process with the
 * correct arguments, and properly handles success, error, and timeout scenarios.
 * @criticality
 * The test target is CRITICAL as it is a high fan-out dependency, essential for
 * the Orchestrator to function and a primary mechanism for economic viability
 * (Rubric Points #3).
 * @testing-layer Unit 
 *
 * @contract
 *   assertions:
 *     - Mocks all external dependencies (child_process, os, path, logger).
 *     - Verifies correct binary path resolution for different OS/architecture combinations.
 *     - Verifies that a missing binary for an unsupported platform throws an error.
 *     - Verifies successful execution by capturing stdout.
 *     - Verifies failure handling for non-zero exit codes and stderr output.
 *     - Verifies timeout handling using fake timers.
 */

// CORRECTED: Explicitly import the 'Mock' type from Vitest as per the coding standard.
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { spawn } from 'child_process';
import * as os from 'os';
import { ContextPartitionerService, type GetContextArgs } from './ContextPartitionerService';

// --- Mock External Dependencies ---

// We need a way to control the mock child process from within our tests.
let mockChildProcess: {
  stdout: { on: Mock };
  stderr: { on: Mock };
  on: Mock;
};

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockChildProcess),
}));

vi.mock('os', () => ({
  platform: vi.fn(),
  arch: vi.fn(),
}));

vi.mock('../logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ContextPartitionerService', () => {
  let service: ContextPartitionerService;
  const sampleArgs: GetContextArgs = {
    filePath: '/path/to/file.ts',
    sliceName: 'test-slice',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton instance for test isolation
    ContextPartitionerService['instance'] = undefined;
    service = ContextPartitionerService.getInstance();

    // Setup the default mock child process for each test
    // CORRECTED: Use the imported 'Mock' type instead of the 'vi' namespace.
    mockChildProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
    };
  });

  afterEach(() => {
    // Ensure we don't leave fake timers running
    vi.useRealTimers();
  });

  describe('getBinaryPath', () => {
    it('should return the correct path for macOS ARM64', () => {
      vi.mocked(os.platform).mockReturnValue('darwin');
      vi.mocked(os.arch).mockReturnValue('arm64');
      const path = service['getBinaryPath']();
      expect(path).toContain('roberto-mcp-macos-arm64');
    });

    it('should return the correct path for Linux x64', () => {
      vi.mocked(os.platform).mockReturnValue('linux');
      vi.mocked(os.arch).mockReturnValue('x64');
      const path = service['getBinaryPath']();
      expect(path).toContain('roberto-mcp-linux-x64');
    });

    it('should return the correct path for Windows x64', () => {
      vi.mocked(os.platform).mockReturnValue('win32');
      vi.mocked(os.arch).mockReturnValue('x64');
      const path = service['getBinaryPath']();
      expect(path).toContain('roberto-mcp-windows-x64.exe');
    });

    it('should throw a MissingBinaryError for an unsupported platform', () => {
      vi.mocked(os.platform).mockReturnValue('sunos'); // An unsupported OS
      expect(() => service['getBinaryPath']()).toThrow('Unsupported platform: sunos');
    });
  });

  describe('getContext', () => {
    it('should spawn the binary with the correct arguments and resolve with stdout', async () => {
      // Arrange: Simulate a successful process
      // CORRECTED: Add explicit types for the event and callback parameters.
      mockChildProcess.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          // Simulate writing to stdout first
          const stdoutCallback = mockChildProcess.stdout.on.mock.calls[0][1];
          stdoutCallback('{"context": "success"}');
          // Then simulate a clean exit
          callback(0);
        }
      });
      vi.mocked(os.platform).mockReturnValue('linux');
      vi.mocked(os.arch).mockReturnValue('x64');

      // Act
      const result = await service.getContext(sampleArgs);

      // Assert
      expect(spawn).toHaveBeenCalledWith(
        expect.stringContaining('roberto-mcp-linux-x64'),
        ['/path/to/file.ts', 'test-slice']
      );
      expect(result).toBe('{"context": "success"}');
    });

    it('should reject with a ProcessExecutionError on a non-zero exit code', async () => {
      // Arrange: Simulate a failing process
      mockChildProcess.on.mockImplementation((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          const stderrCallback = mockChildProcess.stderr.on.mock.calls[0][1];
          stderrCallback('File not found');
          callback(1); // Non-zero exit code
        }
      });
      vi.mocked(os.platform).mockReturnValue('linux');
      vi.mocked(os.arch).mockReturnValue('x64');

      // Act & Assert
      await expect(service.getContext(sampleArgs)).rejects.toMatchObject({
        name: 'ProcessExecutionError',
        message: 'roberto-mcp failed with exit code 1.',
        exitCode: 1,
        stderr: 'File not found',
      });
    });

    it('should reject with a ProcessTimeoutError if the process takes too long', async () => {
      // Arrange: Use fake timers and never call the 'close' callback
      vi.useFakeTimers();
      vi.mocked(os.platform).mockReturnValue('linux');
      vi.mocked(os.arch).mockReturnValue('x64');

      const promise = service.getContext(sampleArgs);

      // Act: Advance time past the timeout threshold
      vi.advanceTimersByTime(11000); // Default timeout is 10s

      // Assert
      await expect(promise).rejects.toThrow('Context partitioner timed out after 10000ms.');
    });



    it('should reject if the spawn function itself emits an error', async () => {
      // Arrange: Simulate a failure to even start the process
      mockChildProcess.on.mockImplementation((event: string, callback: (err: Error) => void) => {
        if (event === 'error') {
          callback(new Error('EPERM'));
        }
      });
      vi.mocked(os.platform).mockReturnValue('linux');
      vi.mocked(os.arch).mockReturnValue('x64');

      // Act & Assert
      await expect(service.getContext(sampleArgs)).rejects.toThrow('Failed to start the roberto-mcp process: EPERM');
    });
  });
});