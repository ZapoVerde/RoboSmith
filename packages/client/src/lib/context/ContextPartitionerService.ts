/**
 * @file packages/client/src/lib/context/ContextPartitionerService.ts
 * @stamp S-20251101-T161500Z-C-CREATED
 * @architectural-role Utility
 * @description
 * A singleton service that acts as a stateless façade for the pre-compiled
 * `roberto-mcp` binary. It abstracts the complexities of platform-specific
 * binary selection and child process execution, providing a clean, promise-based
 * API for retrieving surgically precise context slices.
 * @core-principles
 * 1. IS the single, authoritative entry point for generating context slices.
 * 2. MUST abstract the complexity of child process management and I/O.
 * 3. OWNS the logic for selecting the correct platform-specific binary at runtime.
 * 4. DELEGATES all context generation logic to the external `roberto-mcp` binary.
 *
 * @api-declaration
 *   - export class ContextPartitionerService
 *   -   public static getInstance(): ContextPartitionerService
 *   -   public async getContext(args: GetContextArgs): Promise<ContextPackage>
 *
 * @contract
 *   assertions:
 *     - purity: "read-only"      # The service itself is stateless and only reads from the filesystem via the binary.
 *     - external_io: "none"     # The service orchestrates I/O but delegates it entirely to a child process.
 *     - state_ownership: "none" # This service is stateless.
 */

import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { logger } from '../logging/logger';

// --- Custom Error Types ---

class MissingBinaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingBinaryError';
  }
}

class ProcessExecutionError extends Error {
  constructor(message: string, public exitCode: number | null, public stderr: string) {
    super(message);
    this.name = 'ProcessExecutionError';
  }
}

class ProcessTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProcessTimeoutError';
  }
}

// --- Data Contracts ---

/**
 * Defines the arguments required to request a specific context slice.
 */
export interface GetContextArgs {
  /**
   * The absolute path to the source file from which context will be extracted.
   */
  filePath: string;

  /**
   * The named identifier of the context "slice" to generate, which corresponds
   * to a predefined rule within the roberto-mcp binary.
   */
  sliceName: string;
}

/**
 * A type alias for the final, string-based context package returned by the
 * service, ready to be injected into an AI prompt.
 */
export type ContextPackage = string;

// --- Service Implementation ---

export class ContextPartitionerService {
    private static instance: ContextPartitionerService | undefined;
  private executionTimeout = 10000; // 10 seconds

  // The constructor is private to enforce the singleton pattern.
  private constructor() {}

  /**
   * Gets the single, shared instance of the ContextPartitionerService.
   */
  public static getInstance(): ContextPartitionerService {
    if (!ContextPartitionerService.instance) {
      ContextPartitionerService.instance = new ContextPartitionerService();
    }
    return ContextPartitionerService.instance;
  }

  /**
   * Retrieves a named context slice by executing the roberto-mcp binary.
   * @param args An object containing the filePath and sliceName.
   * @returns A promise that resolves with the context package string.
   * @throws An error if the binary cannot be found, fails to execute,
   *         or returns a non-zero exit code.
   */
  public async getContext(args: GetContextArgs): Promise<ContextPackage> {
    const binaryPath = this.getBinaryPath();

    const childProcessPromise = new Promise<ContextPackage>((resolve, reject) => {
      const child = spawn(binaryPath, [args.filePath, args.sliceName]);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        logger.error('Failed to spawn context partitioner binary.', { error: err });
        reject(
          new ProcessExecutionError(`Failed to start the roberto-mcp process: ${err.message}`, null, '')
        );
      });

      child.on('close', (code) => {
        if (code === 0) {
          logger.debug('Context partitioner executed successfully.', { sliceName: args.sliceName });
          resolve(stdout);
        } else {
          logger.error('Context partitioner binary failed with a non-zero exit code.', {
            exitCode: code,
            stderr,
          });
          reject(
            new ProcessExecutionError(
              `roberto-mcp failed with exit code ${code}.`,
              code,
              stderr
            )
          );
        }
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new ProcessTimeoutError(`Context partitioner timed out after ${this.executionTimeout}ms.`)),
        this.executionTimeout
      )
    );

    return Promise.race([childProcessPromise, timeoutPromise]);
  }

  /**
   * Determines the correct, platform-specific binary path.
   * NOTE: This assumes the extension is running from a standard installation
   * where `__dirname` can be used to locate the packaged `bin` directory.
   */
  private getBinaryPath(): string {
    const platform = os.platform(); // 'darwin', 'linux', 'win32'
    const arch = os.arch(); // 'x64', 'arm64'
    const binDir = path.join(__dirname, '..', 'bin'); // Assumes bin is a sibling of the 'out' dir

    let binaryName = '';

    if (platform === 'darwin') {
      binaryName = arch === 'arm64' ? 'roberto-mcp-macos-arm64' : 'roberto-mcp-macos-x64';
    } else if (platform === 'linux') {
      binaryName = 'roberto-mcp-linux-x64';
    } else if (platform === 'win32') {
      binaryName = 'roberto-mcp-windows-x64.exe';
    } else {
      throw new MissingBinaryError(`Unsupported platform: ${platform}`);
    }

    const binaryPath = path.join(binDir, binaryName);
    // In a real scenario, you'd also check if the file exists here.
    // fs.existsSync(binaryPath)
    return binaryPath;
  }
}