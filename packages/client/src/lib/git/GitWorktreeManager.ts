/**
 * @file packages/client/src/lib/git/GitWorktreeManager.ts
 * @stamp S-20251105T195212Z-C-ARCH-COMPLIANT
 * @architectural-role Orchestrator
 * @description
 * The authoritative service for orchestrating the lifecycle, state, and
 * conflict detection of all Git worktrees. It is a pure orchestrator that
 * depends on an injected GitAdapter to perform all I/O.
 * @core-principles
 * 1. OWNS the stateful logic for the worktree reconciliation loop.
 * 2. DELEGATES all Git commands, file system reads, and state persistence to the adapter.
 * 3. MUST be fully testable in isolation with a mock adapter.
 *
 * @api-declaration
 *   - export class GitWorktreeManager
 *   -   public constructor(gitAdapter: GitAdapter)
 *   -   public async initialize(): Promise<void>
 *   -   public async createWorktree(args: CreateWorktreeArgs): Promise<WorktreeSession>
 *   -   public async removeWorktree(sessionId: string): Promise<void>
 *   -   public async runConflictScan(newChangePlan: string[]): Promise<ConflictScanResult>
 *
 * @contract
 *   assertions:
 *     purity: mutates
 *     external_io: none
 *     state_ownership: ['sessionMap']
 */

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logging/logger';
import type { GitAdapter } from './IGitAdapter';

// --- Data Contracts ---

/**
 * @id packages/client/src/lib/git/GitWorktreeManager.ts#WorktreeSession
 * @description Represents a single, managed Git worktree session, including its state and planned changes.
 */
export interface WorktreeSession {
  /** A unique identifier for the session (and its tab), matching the worktree's directory name. */
  sessionId: string;
  /** The absolute path to the root of the worktree's directory. */
  worktreePath: string;
  /** The name of the dedicated Git branch checked out in this worktree. */
  branchName: string;
  /** The list of "seed files" that this session's workflow intends to modify. */
  changePlan: string[];
  /** The current operational status of the workflow (e.g., Running, Queued, Held). */
  status: 'Running' | 'Queued' | 'Held';
}

/**
 * @id packages/client/src/lib/git/GitWorktreeManager.ts#CreateWorktreeArgs
 * @description Defines the set of arguments required to create a new, isolated worktree session.
 */
export interface CreateWorktreeArgs {
  /** The initial list of "seed files" the new workflow intends to modify. */
  changePlan: string[];
  /** The name of the Git branch to use as the starting point for the new worktree. */
  baseBranch: string;
}

/**
 * @id packages/client/src/lib/git/GitWorktreeManager.ts#ConflictScanResult
 * @description A discriminated union representing the outcome of a conflict scan between a new change plan and existing sessions.
 */
export type ConflictScanResult =
  | { status: 'CLEAR' }
  | {
      status: 'CLASH';
      conflictingSessionId: string;
      conflictingFiles: string[];
    };

// --- Service Implementation ---

export class GitWorktreeManager {
  private sessionMap: Map<string, WorktreeSession> = new Map();
  private readonly GLOBAL_STATE_KEY = 'activeWorktreeSessions';
  private readonly WORKTREES_DIR = '.worktrees';

  /**
   * The manager's constructor uses Dependency Injection to receive its I/O adapter.
   * An instance of this class cannot be created without providing its dependency.
   */
  public constructor(private readonly gitAdapter: GitAdapter) {}

  /**
   * Initializes the service by running the self-healing reconciliation loop.
   * MUST be called once on extension activation.
   */
  public async initialize(): Promise<void> {
    logger.info('Starting GitWorktreeManager reconciliation loop...');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      logger.warn('No workspace open. Skipping worktree reconciliation.');
      return;
    }
    const workspaceRootUri = workspaceFolders[0].uri;
    const worktreesUri = vscode.Uri.joinPath(workspaceRootUri, this.WORKTREES_DIR);

    try {
      const cachedState = this.gitAdapter.getGlobalState<Record<string, WorktreeSession>>(
        this.GLOBAL_STATE_KEY
      );
      const cachedSessions = cachedState || {};
      let stateChanged = false;

      const onDiskEntries = await this.gitAdapter.readDirectory(worktreesUri);
      const onDiskSessionIds = new Set(
        onDiskEntries.filter(([, type]) => type === vscode.FileType.Directory).map(([name]) => name)
      );

      for (const [sessionId, session] of Object.entries(cachedSessions)) {
        if (!onDiskSessionIds.has(sessionId)) {
          logger.warn(`Found "Ghost" worktree in state, removing: ${sessionId}.`);
          delete cachedSessions[sessionId];
          stateChanged = true;
        } else {
          this.sessionMap.set(sessionId, session);
        }
      }

      for (const sessionId of onDiskSessionIds) {
        if (!this.sessionMap.has(sessionId)) {
          logger.warn(`Found "Zombie" directory on disk. Ignoring: ${sessionId}.`);
        }
      }

      if (stateChanged) {
        await this._persistState();
      }

      logger.info(`Reconciliation complete. Loaded ${this.sessionMap.size} active sessions.`);
    } catch (e) {
      if (e instanceof vscode.FileSystemError && e.code === 'FileNotFound') {
        logger.info(`Worktrees directory not found. Initializing with 0 sessions.`);
      } else {
        logger.error('Critical failure during worktree reconciliation.', { error: e });
        this.sessionMap = new Map();
      }
    }
  }

  public async createWorktree(args: CreateWorktreeArgs): Promise<WorktreeSession> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) throw new Error('Cannot create worktree: No workspace folder open.');
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    const sessionId = uuidv4();
    const branchName = `robo-smith/${sessionId.slice(0, 8)}`;
    const worktreePath = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      this.WORKTREES_DIR,
      sessionId
    ).fsPath;

    // Delegate all Git commands to the adapter
    await this.gitAdapter.exec(['worktree', 'add', '-b', branchName, worktreePath, args.baseBranch], {
      cwd: workspaceRoot,
    });

    const newSession: WorktreeSession = {
      sessionId,
      worktreePath,
      branchName,
      changePlan: args.changePlan,
      status: 'Running',
    };

    this.sessionMap.set(newSession.sessionId, newSession);
    await this._persistState();
    logger.info(`Successfully created worktree: ${sessionId}`);
    return newSession;
  }

  public async removeWorktree(sessionId: string): Promise<void> {
    const session = this.sessionMap.get(sessionId);
    if (!session) {
      logger.warn(`Cannot remove worktree: Session ID "${sessionId}" not found.`);
      return;
    }
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) throw new Error('Cannot remove worktree: No workspace folder open.');
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Delegate all Git commands to the adapter
    await this.gitAdapter.exec(['worktree', 'remove', session.worktreePath], { cwd: workspaceRoot });
    await this.gitAdapter.exec(['branch', '-d', session.branchName], { cwd: workspaceRoot });

    this.sessionMap.delete(sessionId);
    await this._persistState();
    logger.info(`Successfully removed worktree: ${sessionId}`);
  }

  public async runConflictScan(newChangePlan: string[]): Promise<ConflictScanResult> {
    for (const session of this.sessionMap.values()) {
      const conflictingFiles = session.changePlan.filter((file) => newChangePlan.includes(file));
      if (conflictingFiles.length > 0) {
        return {
          status: 'CLASH',
          conflictingSessionId: session.sessionId,
          conflictingFiles,
        };
      }
    }
    return { status: 'CLEAR' };
  }

  private async _persistState(): Promise<void> {
    const stateRecord = Object.fromEntries(this.sessionMap);
    // Delegate state persistence to the adapter
    await this.gitAdapter.updateGlobalState(this.GLOBAL_STATE_KEY, stateRecord);
  }

  public _getSessionMap(): ReadonlyMap<string, WorktreeSession> {
    return this.sessionMap;
  }
}