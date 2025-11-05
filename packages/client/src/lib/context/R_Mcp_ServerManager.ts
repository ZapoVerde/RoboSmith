/**
 * @file packages/client/src/lib/context/R_Mcp_ServerManager.ts
 * @stamp S-20251105T160000Z-C-RACE-CONDITION-FIX
 * @architectural-role Orchestrator
 * @description
 * A singleton service responsible for managing the lifecycle of all roberto-mcp
 * server processes (the "On-Demand Server-per-Worktree" model). It acts as the
 * stateful orchestrator, ensuring a hot R-MCP server is only running for an
 * actively executing worktree.
 * @core-principles
 * 1. OWNS the stateful lifecycle and process management of all R-MCP server processes.
 * 2. DELEGATES all I/O to the managed child process.
 * 3. MUST abstract platform-specific binary resolution.
 *
 * @api-declaration
 *   - export class R_Mcp_ServerManager
 *   -   public static getInstance(clientFactory: JsonRpcClientFactory): R_Mcp_ServerManager
 *   -   public async spinUpServer(worktreePath: string): Promise<void>
 *   -   public async spinDownServer(worktreePath: string): Promise<void>
 *   -   public getClientFor(worktreePath: string): JsonRpcClient | undefined
 *
 * @contract
 *   assertions:
 *     purity: mutates          # Owns and mutates internal state map of active servers.
 *     state_ownership: ['activeServers'] # The sole owner of the map tracking active R-MCP instances.
 *     external_io: none        # Delegates I/O to the child process.
 */

import * as path from 'path';
import * as os from 'os';
import { spawn, type ChildProcess } from 'child_process';
import { logger } from '../logging/logger';
import type { Readable, Writable } from 'stream';


// --- Custom Error Types ---

export class MissingBinaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingBinaryError';
  }
}

export class ProcessStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProcessStartError';
  }
}

// --- Testability Abstractions ---

export interface ProcessStreamProvider {
    readonly stdin: Writable | null;
    readonly stdout: Readable | null;
    readonly stderr: Readable | null;
    on: ChildProcess['on'];
    kill: ChildProcess['kill'];
}

export interface JsonRpcClient {
  sendCall: (method: string, params: unknown) => Promise<unknown>;
}

export type JsonRpcClientFactory = (processStreams: ProcessStreamProvider) => JsonRpcClient;

interface ManagedProcess {
  process: ProcessStreamProvider;
  client: JsonRpcClient;
}

// --- Service Implementation ---

export class R_Mcp_ServerManager {
  private static instance: R_Mcp_ServerManager | undefined;
  private activeServers: Map<string, ManagedProcess> = new Map();
  private clientFactory: JsonRpcClientFactory;

  private constructor(clientFactory: JsonRpcClientFactory) {
    this.clientFactory = clientFactory;
  }

  public static getInstance(clientFactory: JsonRpcClientFactory): R_Mcp_ServerManager {
    if (!R_Mcp_ServerManager.instance) {
      R_Mcp_ServerManager.instance = new R_Mcp_ServerManager(clientFactory);
    }
    return R_Mcp_ServerManager.instance;
  }

  public async spinUpServer(worktreePath: string): Promise<void> {
    if (this.activeServers.has(worktreePath)) {
      logger.debug(`R-MCP server already active for: ${worktreePath}. Skipping spawn.`);
      return;
    }

    const binaryPath = this.getBinaryPath();
    logger.info(`Spawning R-MCP server for: ${worktreePath}`);
    
    // FIX: Wrap the entire process lifecycle in a promise that we control for robust rejection.
    return new Promise<void>((resolve, reject) => { 
        
        const newProcess = spawn(binaryPath, ['--server'], {
            cwd: worktreePath,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
        });
        
        const processStreams: ProcessStreamProvider = newProcess;
        
        // Define a single rejection point function for consistency.
        const cleanupAndReject = (error: Error) => {
            logger.error(`R-MCP process failed. Reason: ${error.message}`, { worktreePath });
            this.activeServers.delete(worktreePath);
            processStreams.kill('SIGKILL'); // Use SIGKILL to guarantee termination
            reject(new ProcessStartError(`R-MCP operation failed for ${worktreePath}: ${error.message}`));
        };

        // Attach the immediate error handler. This is the process's main failure channel.
        processStreams.on('error', cleanupAndReject);
        
        // Guard clause for stream availability. This check is often synchronous.
        if (!processStreams.stdin || !processStreams.stdout) {
            // Note: This must return here to prevent the promise from being created before rejection
            return cleanupAndReject(new Error('R-MCP failed to open necessary I/O streams.'));
        }

        const client = this.clientFactory(processStreams);
        this.activeServers.set(worktreePath, { process: processStreams, client });
        
        // Start the indexing call and control the main promise flow.
        client.sendCall('index_code', { worktreePath })
            .then(() => {
                logger.info(`R-MCP initial indexing complete for: ${worktreePath} (Warm Start).`);
                resolve(); // Resolve the external promise on success.
            })
            .catch((e) => {
                cleanupAndReject(e as Error); // Rejects if indexing fails.
            });
    });
  }

  public async spinDownServer(worktreePath: string): Promise<void> {
    const managedProcess = this.activeServers.get(worktreePath);

    if (!managedProcess) {
      logger.debug(`R-MCP server not found for: ${worktreePath}. Skipping kill.`);
      return;
    }

    managedProcess.process.kill('SIGTERM');
    this.activeServers.delete(worktreePath);
    logger.info(`R-MCP server shut down for: ${worktreePath}.`);
  }

  public getClientFor(worktreePath: string): JsonRpcClient | undefined {
    return this.activeServers.get(worktreePath)?.client;
  }

  private getBinaryPath(): string {
    const platform = os.platform();
    const arch = os.arch();
    const binDir = path.join(__dirname, '..', 'bin');

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

    return path.join(binDir, binaryName);
  }
}