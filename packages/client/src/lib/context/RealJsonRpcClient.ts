/**
 * @file packages/client/src/lib/context/RealJsonRpcClient.ts
 * @architectural-role Utility
 * @description A concrete implementation of the JsonRpcClient interface.
 * It manages asynchronous communication with a child process using JSON-RPC 2.0 over stdio.
 */

import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logging/logger';
import type { JsonRpcClient } from './R_Mcp_ServerManager';
import type { ManagedProcess } from './IProcessSpawner';

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class RealJsonRpcClient implements JsonRpcClient {
  private pendingRequests = new Map<string, { resolve: (val: unknown) => void; reject: (err: Error) => void }>();

  constructor(private process: ManagedProcess) {
    this.setupResponseListener();
  }

  public async sendCall(method: string, params: unknown): Promise<unknown> {
    const stdin = this.process.stdin; // Capture locally to satisfy TypeScript

    if (!stdin) {
      throw new Error('Process stdin is not available');
    }

    const id = uuidv4();
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const jsonString = JSON.stringify(message);
      try {
        stdin.write(jsonString + '\n');
        logger.debug(`[RPC-OUT] ${method} (ID: ${id})`);
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  private setupResponseListener() {
    const stdout = this.process.stdout;

    if (!stdout) {
      logger.error('Process stdout is not available. Cannot listen for RPC responses.');
      return;
    }

    const rl = readline.createInterface({
      input: stdout,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!line.trim()) return;

      try {
        const response = JSON.parse(line) as JsonRpcResponse;
        this.handleResponse(response);
      } catch (error) {
        logger.warn('Failed to parse RPC response line', { line, error });
      }
    });

    this.process.on('exit', () => {
      this.rejectAll('Process exited unexpectedly');
    });
  }

  private handleResponse(response: JsonRpcResponse) {
    const { id, result, error } = response;
    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    this.pendingRequests.delete(id);

    if (error) {
      logger.warn(`[RPC-ERR] ID: ${id}`, { error });
      pending.reject(new Error(`RPC Error ${error.code}: ${error.message}`));
    } else {
      logger.debug(`[RPC-IN] ID: ${id}`);
      pending.resolve(result);
    }
  }

  private rejectAll(reason: string) {
    for (const { reject } of this.pendingRequests.values()) {
      reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }
}