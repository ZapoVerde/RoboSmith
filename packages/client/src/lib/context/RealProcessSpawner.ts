/**
 * @file packages/client/src/lib/context/RealProcessSpawner.ts
 * @stamp S-20251130T082000Z-C-PREAMBLE-FIX
 * @architectural-role Utility
 * @description Provides the concrete, "real" implementation of the ProcessSpawner
 * interface. This class encapsulates all direct interactions with the Node.js
 * 'child_process' module.
 * @core-principles
 * 1. MUST strictly implement the ProcessSpawner interface.
 * 2. IS the single, authoritative implementation for spawning real child processes.
 * 3. OWNS all platform-specific logic for resolving binary paths.
 *
 * @api-declaration
 *   - export class RealProcessSpawner implements ProcessSpawner
 *
 * @contract
 *   assertions:
 *     purity: mutates
 *     external_io: vscode_and_filesystem # Proxies for System I/O (spawning processes).
 *     state_ownership: none
 */

import { spawn, type ChildProcess } from 'child_process';
import type { ProcessSpawner, ManagedProcess } from './IProcessSpawner';

export class RealProcessSpawner implements ProcessSpawner {
  public spawn(binaryPath: string, cwd: string): ManagedProcess {
    const newProcess: ChildProcess = spawn(binaryPath, ['--server'], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    // The 'ChildProcess' object returned by Node's spawn is structurally
    // compatible with our 'ManagedProcess' interface, so we can return it directly.
    return newProcess;
  }
}