/**
 * @file packages/client/src/lib/git/GitWorktreeManager.ts
 * @stamp S-20251105T171000Z-C-ESLINT-FIX
 * @architectural-role Orchestrator
 * @description
 * The authoritative service for managing the lifecycle, state persistence, and
 * conflict detection of all user-initiated Git worktrees. It implements the
 * self-healing reconciliation loop on startup.
 * @core-principles
 * 1. OWNS the management and state persistence for all Git worktrees.
 * 2. ENFORCES safety and parallelism via the reconciliation loop.
 * 3. ABSTRACTS all raw 'git' command-line execution into a robust API.
 *
 * @api-declaration
 *   - export class GitWorktreeManager
 *   -   public static getInstance(): GitWorktreeManager
 *   -   public async initialize(context: vscode.ExtensionContext): Promise<void>
 *   -   public async createWorktree(args: CreateWorktreeArgs): Promise<WorktreeSession>
 *   -   public async removeWorktree(sessionId: string): Promise<void>
 *   -   public async runConflictScan(newChangePlan: string[]): Promise<ConflictScanResult>
 *
 * @contract
 *   assertions:
 *     purity: mutates          # Mutates internal state and VS Code globalState.
 *     external_io: none        # Delegates to Git CLI and FS API (external to the service's logic).
 *     state_ownership: ['sessionMap'] # Owns the in-memory map of active sessions.
 */

import * as vscode from 'vscode';
import { logger } from '../logging/logger';

// --- Data Contracts (Defined locally for now, to be moved to shared/types later) ---

/**
 * @id packages/client/src/lib/git/GitWorktreeManager.ts#WorktreeSession
 * @description Represents a single, managed Git worktree session.
 */
export interface WorktreeSession {
  sessionId: string;
  worktreePath: string;
  branchName: string;
  changePlan: string[];
  status: 'Running' | 'Queued' | 'Held';
}

/**
 * @id packages/client/src/lib/git/GitWorktreeManager.ts#CreateWorktreeArgs
 * @description Defines the arguments needed to create a new worktree.
 */
export interface CreateWorktreeArgs {
  changePlan: string[];
  baseBranch: string;
}

/**
 * @id packages/client/src/lib/git/GitWorktreeManager.ts#ConflictScanResult
 * @description Represents the outcome of a conflict scan.
 */
export type ConflictScanResult =
  | { status: 'CLEAR' }
  | { status: 'CLASH'; conflictingSessionId: string; conflictingFiles: string[] };

// --- Service Implementation ---

export class GitWorktreeManager {
  private static instance: GitWorktreeManager | undefined;
  // State ownership: The in-memory map of active sessions.
  private sessionMap: Map<string, WorktreeSession> = new Map();
  // Persistence Context: Required for the `_persistState` method.
  private persistenceContext: vscode.ExtensionContext | null = null;
  private readonly GLOBAL_STATE_KEY = 'activeWorktreeSessions';
  private readonly WORKTREES_DIR = '.worktrees';

  public constructor() {}

  public static getInstance(): GitWorktreeManager {
    if (!GitWorktreeManager.instance) {
      GitWorktreeManager.instance = new GitWorktreeManager();
    }
    return GitWorktreeManager.instance;
  }

  /**
   * CRITICAL V1 METHOD: Initializes the service, runs the self-healing
   * reconciliation loop, and loads the persisted state from globalState.
   * @param context The VS Code ExtensionContext, required for state persistence.
   */
  public async initialize(context: vscode.ExtensionContext): Promise<void> {
    this.persistenceContext = context;
    logger.info('Starting GitWorktreeManager reconciliation loop...');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      logger.warn('No workspace open. Skipping worktree reconciliation.');
      return;
    }
    const workspaceRootUri = workspaceFolders[0].uri;
    const worktreesUri = vscode.Uri.joinPath(workspaceRootUri, this.WORKTREES_DIR);

    try {
      // 1. Read Cached State (Extension's Memory)
      const cachedState = (await context.globalState.get(this.GLOBAL_STATE_KEY)) as
        | Record<string, WorktreeSession>
        | undefined;
      const cachedSessions = cachedState || {};
      let stateChanged = false;

      // 2. Read Ground Truth (The File System)
      // ReadDirectory returns an array of [name, type] tuples.
      const onDiskEntries = await vscode.workspace.fs.readDirectory(worktreesUri);
      const onDiskSessionIds = new Set(
        onDiskEntries.filter(([, type]) => type === vscode.FileType.Directory).map(([name]) => name)
      );

      // 3. Find and Handle "Ghosts" (In State, Not on Disk)
      for (const [sessionId, session] of Object.entries(cachedSessions)) {
        if (!onDiskSessionIds.has(sessionId)) {
          logger.warn(`Found "Ghost" worktree in state, removing: ${sessionId}.`);
          delete cachedSessions[sessionId];
          stateChanged = true;
        } else {
          // If it exists on disk, add it to the in-memory map.
          this.sessionMap.set(sessionId, session);
        }
      }

      // 4. Find and Handle "Zombies" (On Disk, Not in State)
      for (const sessionId of onDiskSessionIds) {
        if (!this.sessionMap.has(sessionId)) {
          logger.warn(`Found "Zombie" directory on disk. Ignoring: ${sessionId}.`);
          // Note: V1 only logs the warning. A future cleanup command will address this.
        }
      }

      // 5. Persist and Finalize
      if (stateChanged) {
        await this._persistState();
      }

      logger.info(`Reconciliation complete. Loaded ${this.sessionMap.size} active sessions.`);
    } catch (e) {
      // Handle case where .worktrees/ directory doesn't exist on first run
      if (e instanceof vscode.FileSystemError && e.code === 'FileNotFound') {
        logger.info(`Worktrees directory not found. Initializing with 0 sessions.`);
      } else {
        logger.error('Critical failure during worktree reconciliation.', { error: e });
        // The service will start with an empty map to prevent further crashes.
        this.sessionMap = new Map();
      }
    }
  }

  // --- Core API Stubs (Logic implemented in later tasks) ---

  public async createWorktree(args: CreateWorktreeArgs): Promise<WorktreeSession> {
    logger.debug('STUB: Executing git worktree add command...');
    // Simulated worktree creation
    const newSession: WorktreeSession = {
      sessionId: `session-${Math.random().toString(36).slice(2, 9)}`,
      worktreePath: `/mock/path/to/worktree`,
      branchName: args.baseBranch,
      changePlan: args.changePlan,
      status: 'Running',
    };
    this.sessionMap.set(newSession.sessionId, newSession);
    await this._persistState();
    return newSession;
  }

  public async removeWorktree(sessionId: string): Promise<void> {
    logger.debug(`STUB: Executing git worktree remove for ${sessionId}`);
    this.sessionMap.delete(sessionId);
    await this._persistState();
  }

  public async runConflictScan(_newChangePlan: string[]): Promise<ConflictScanResult> { // FIX: Underscore prefix
    logger.debug('STUB: Running conflict scan...');
    // The actual scan logic will run against this.sessionMap
    return { status: 'CLEAR' };
  }

  // --- Private Persistence Utility ---

  private async _persistState(): Promise<void> {
    if (!this.persistenceContext) {
      logger.warn('Cannot persist state: Context not initialized.');
      return;
    }
    const stateRecord = Object.fromEntries(this.sessionMap);
    await this.persistenceContext.globalState.update(this.GLOBAL_STATE_KEY, stateRecord);
  }

  // Exposed for testing purposes
  public _getSessionMap(): ReadonlyMap<string, WorktreeSession> {
    return this.sessionMap;
  }
}