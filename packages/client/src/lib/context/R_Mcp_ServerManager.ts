/**
 * @file packages/client/src/lib/context/R_Mcp_ServerManager.ts
 * @stamp S-20251130T224800Z-C-BINARY-PATH-INJECTION
 * @architectural-role Orchestrator
 * @description A stateful service that manages the lifecycle of R-MCP server
 * processes. Provides an honest, two-phase API that separates process spawning
 * from application-level initialization. This is a pure, dependency-injected
 * service whose lifecycle is managed by the application's composition root.
 * @core-principles
 * 1. OWNS the in-memory map of active R-MCP server processes.
 * 2. DELEGATES all process spawning and termination to the injected adapter.
 * 3. ENFORCES explicit two-phase initialization: spawn, then initialize.
 * 4. IS a plain class with no singleton pattern, ensuring complete test isolation.
 * 5. RECEIVES the binary path via constructor injection to support cross-platform portability.
 *
 * @api-declaration
 *   - export class R_Mcp_ServerManager
 *   -   public constructor(spawner: ProcessSpawner, clientFactory: JsonRpcClientFactory, binaryPath: string)
 *   -   public async spawnProcess(worktreePath: string): Promise<ManagedProcess>
 *   -   public async initializeServer(worktreePath: string, process: ManagedProcess): Promise<void>
 *   -   public async spinDownServer(worktreePath: string): Promise<void>
 *   -   public getClientFor(worktreePath: string): JsonRpcClient | undefined
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"
 *     - external_io: "none"
 *     - state_ownership: "['activeServers']"
 */

import { logger } from '../logging/logger';
import type { ProcessSpawner, ManagedProcess } from './IProcessSpawner';

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

/**
 * @id packages/client/src/lib/context/R_Mcp_ServerManager.ts#JsonRpcClient
 * @description Defines the abstract contract for a client that can send JSON-RPC
 * method calls over a given transport, such as the stdio streams of a child process.
 */
export interface JsonRpcClient {
  /**
   * Sends a JSON-RPC method call to the server and awaits the result.
   * @param method The name of the tool or method to call (e.g., 'get_file_outline').
   * @param params The arguments object required by the specific tool.
   * @returns A promise resolving to the server's response result.
   */
  sendCall: (method: string, params: unknown) => Promise<unknown>;
}

/**
 * @id packages/client/src/lib/context/R_Mcp_ServerManager.ts#JsonRpcClientFactory
 * @description Defines the signature for a factory function that creates a
 * JsonRpcClient from a ManagedProcess, decoupling the manager from any
 * specific RPC client implementation.
 */
export type JsonRpcClientFactory = (processStreams: ManagedProcess) => JsonRpcClient;

interface ManagedProcessInternal {
  process: ManagedProcess;
  client: JsonRpcClient;
}

// --- Service Implementation ---

export class R_Mcp_ServerManager {
  private activeServers: Map<string, ManagedProcessInternal> = new Map();
  private readonly clientFactory: JsonRpcClientFactory;
  private readonly binaryPath: string;

  /**
   * Creates a new R_Mcp_ServerManager instance.
   * 
   * This is a plain, dependency-injected class. Its lifecycle is managed by
   * the application's composition root (extension.ts). Each instance maintains
   * its own isolated state, ensuring complete test independence.
   * 
   * @param spawner The process spawning adapter (injected dependency)
   * @param clientFactory The RPC client factory function (injected dependency)
   * @param binaryPath The absolute path to the r-mcp binary (injected dependency)
   */
  public constructor(
    private readonly spawner: ProcessSpawner,
    clientFactory: JsonRpcClientFactory,
    binaryPath: string
  ) {
    this.clientFactory = clientFactory;
    this.binaryPath = binaryPath;
  }

  /**
   * PHASE 1: Spawns an R-MCP server process and waits for it to become stable.
   * 
   * This method handles only OS-level process lifecycle concerns. It returns a
   * handle to the spawned process, which the caller must then pass to
   * `initializeServer()` to complete the two-phase initialization.
   * 
   * @param worktreePath The absolute path to the worktree for this server instance.
   * @returns A promise that resolves with a stable ManagedProcess handle.
   * @throws MissingBinaryError if the platform is unsupported.
   * @throws ProcessStartError if the process fails to spawn or lacks required I/O streams.
   */
  public async spawnProcess(worktreePath: string): Promise<ManagedProcess> {
    logger.info(`Spawning R-MCP server process for: ${worktreePath}`);
    
    return new Promise<ManagedProcess>((resolve, reject) => {
      // Use the injected binary path directly
      const processStreams = this.spawner.spawn(this.binaryPath, worktreePath);
      
      let isSettled = false;
      
      const handleSpawnError = (error: Error) => {
        if (isSettled) return;
        isSettled = true;
        
        logger.error(`R-MCP process failed to spawn.`, { worktreePath, error });
        processStreams.kill('SIGKILL');
        reject(new ProcessStartError(
          `R-MCP spawn failed for ${worktreePath}: ${error.message}`
        ));
      };
      
      processStreams.on('error', handleSpawnError);
      
      if (!processStreams.stdin || !processStreams.stdout) {
        return handleSpawnError(new Error('Process missing stdin or stdout'));
      }
      
      // Give the process a brief moment to fail if it's going to.
      // Spawn errors typically manifest immediately in the same tick.
      setImmediate(() => {
        if (!isSettled) {
          isSettled = true;
          logger.debug(`R-MCP process spawned successfully for: ${worktreePath}`);
          resolve(processStreams);
        }
      });
    });
  }

  /**
   * PHASE 2: Initializes the application-level RPC connection and registers the server.
   * 
   * This method assumes the process is already stable (from `spawnProcess()`). It
   * creates the RPC client, performs the initial indexing call, and registers the
   * server in the active servers map only upon success.
   * 
   * @param worktreePath The absolute path to the worktree.
   * @param process The stable ManagedProcess handle returned by `spawnProcess()`.
   * @throws ProcessStartError if the indexing call fails.
   */
  public async initializeServer(
    worktreePath: string,
    process: ManagedProcess
  ): Promise<void> {
    if (this.activeServers.has(worktreePath)) {
      logger.debug(`R-MCP server already active for: ${worktreePath}. Skipping initialization.`);
      return;
    }

    const client = this.clientFactory(process);
    
    try {
      logger.debug(`Sending initial index_code request for: ${worktreePath}`);
      await client.sendCall('index_code', { worktreePath });
      
      this.activeServers.set(worktreePath, { process, client });
      logger.info(`R-MCP server initialized and registered for: ${worktreePath}`);
    } catch (error) {
      logger.error(`R-MCP indexing failed. Killing process.`, { worktreePath, error });
      process.kill('SIGKILL');
      throw new ProcessStartError(
        `R-MCP indexing failed for ${worktreePath}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Terminates an active R-MCP server and removes it from the registry.
   * 
   * @param worktreePath The absolute path to the worktree whose server should be terminated.
   */
  public async spinDownServer(worktreePath: string): Promise<void> {
    const managedProcess = this.activeServers.get(worktreePath);

    if (!managedProcess) {
      logger.debug(`R-MCP server not found for: ${worktreePath}. Skipping kill.`);
      return;
    }

    managedProcess.process.kill('SIGTERM');
    this.activeServers.delete(worktreePath);
    logger.info(`R-MCP server shut down for: ${worktreePath}`);
  }

  /**
   * Retrieves the active RPC client for a given worktree, if one exists.
   * 
   * @param worktreePath The absolute path to the worktree.
   * @returns The JsonRpcClient for the worktree, or undefined if no server is active.
   */
  public getClientFor(worktreePath: string): JsonRpcClient | undefined {
    return this.activeServers.get(worktreePath)?.client;
  }
}