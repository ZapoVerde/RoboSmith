/**
 * @file packages/client/src/lib/context/ContextPartitionerService.ts
 * @stamp S-20251106T154021Z-C-COMPLIANT-FIX
 * @architectural-role Utility
 * @description A stateless façade for all context queries. It routes requests from
 * the Orchestrator to the correct R-MCP server instance via the injected
 * R_Mcp_ServerManager dependency.
 * @core-principles
 * 1. IS a stateless façade for context queries.
 * 2. DELEGATES all process awareness to the R_Mcp_ServerManager.
 * 3. OWNS the logic for translating method calls into JSON-RPC messages.
 *
 * @api-declaration
 *   - export class McpQueryError extends Error
 *   - export class ContextPartitionerService
 *     - public constructor(serverManager: R_Mcp_ServerManager)
 *     - public static getInstance(serverManager: R_Mcp_ServerManager): ContextPartitionerService
 *     - public async getFileOutline(args: GetFileOutlineArgs): Promise<FileOutline>
 *     - public async getSymbolReferences(args: GetSymbolReferencesArgs): Promise<SymbolReference[]>
 *
 * @contract
 *   assertions:
 *     - purity: "pure"          # This service is stateless and only delegates work.
 *     - external_io: "none"     # Delegates I/O to the JSON-RPC client provided by the manager.
 *     - state_ownership: "none" # This service is stateless.
 */

import type {
  FileOutline,
  GetFileOutlineArgs,
  GetSymbolReferencesArgs,
  SymbolReference,
} from './types';
import { R_Mcp_ServerManager } from './R_Mcp_ServerManager';
import { logger } from '../logging/logger';

// --- Custom Error Types ---

export class McpQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpQueryError';
  }
}

// --- Service Implementation ---

export class ContextPartitionerService {
  private static instance: ContextPartitionerService | undefined;
  // The service now holds its dependency, which is provided via the constructor.
  private readonly serverManager: R_Mcp_ServerManager;

  // The constructor is now public to allow for dependency injection.
  public constructor(serverManager: R_Mcp_ServerManager) {
    this.serverManager = serverManager;
  }

  /**
   * Gets the single, shared instance of the ContextPartitionerService.
   * The serverManager dependency MUST be provided on the first call.
   */
  public static getInstance(serverManager: R_Mcp_ServerManager): ContextPartitionerService {
    if (!ContextPartitionerService.instance) {
      ContextPartitionerService.instance = new ContextPartitionerService(serverManager);
    }
    return ContextPartitionerService.instance;
  }

  /**
   * Requests the structured symbol outline for a given file from the R-MCP server.
   * @param args The worktree path and the file path.
   */
  public async getFileOutline(args: GetFileOutlineArgs): Promise<FileOutline> {
    const client = this.serverManager.getClientFor(args.worktreePath);
    const toolName = 'get_file_outline';
    
    if (!client) {
      throw new McpQueryError(
        `Cannot call ${toolName}: No active R-MCP server for worktree ${args.worktreePath}.`
      );
    }

    try {
      logger.debug(`Sending R-MCP query: ${toolName}`, { ...(args as unknown as Record<string, unknown>) });
      const result = await client.sendCall(toolName, { filePath: args.filePath });
      return result as FileOutline;
    } catch (error) {
      logger.error(`R-MCP query failed for ${toolName}.`, { error });
      throw new McpQueryError(`R-MCP server returned an error for ${toolName}.`);
    }
  }

  /**
   * Requests all symbol references for a given symbol name across the worktree.
   * @param args The worktree path and the symbol name.
   */
  public async getSymbolReferences(args: GetSymbolReferencesArgs): Promise<SymbolReference[]> {
    const client = this.serverManager.getClientFor(args.worktreePath);
    const toolName = 'get_symbol_references';

    if (!client) {
      throw new McpQueryError(
        `Cannot call ${toolName}: No active R-MCP server for worktree ${args.worktreePath}.`
      );
    }

    try {
      logger.debug(`Sending R-MCP query: ${toolName}`, { ...(args as unknown as Record<string, unknown>) });
      const result = await client.sendCall(toolName, { symbolName: args.symbolName });
      return result as SymbolReference[];
    } catch (error) {
      logger.error(`R-MCP query failed for ${toolName}.`, { error });
      throw new McpQueryError(`R-MCP server returned an error for ${toolName}.`);
    }
  }
}