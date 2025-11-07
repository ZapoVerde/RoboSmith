/**
 * @file packages/client/src/lib/workflow/WorktreeQueueManager.ts
 * @stamp S-20251107T091500Z-C-QUEUE-MANAGER-CREATED
 * @architectural-role Orchestrator
 * @description Implements the "air traffic controller" for all worktree creation requests.
 * It manages contention for shared files by implementing a deterministic FIFO queuing system.
 * @core-principles
 * 1. OWNS the state of the task queue (pending, waiting, running).
 * 2. DELEGATES all conflict scanning and worktree creation to the GitWorktreeManager.
 * 3. ORCHESTRATES the automatic processing of the queue when tasks complete.
 *
 * @api-declaration
 *   - export class WorktreeQueueManager
 *   -   public constructor(gitWorktreeManager: GitWorktreeManager)
 *   -   public submitTask(args: CreateWorktreeArgs, priority?: number): Promise<WorktreeSession>
 *   -   public markTaskComplete(sessionId: string): void
 *
 * @contract
 *   assertions:
 *     purity: "mutates"
 *     external_io: "none"
 *     state_ownership: "['queue']"
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logging/logger';
import type { GitWorktreeManager, CreateWorktreeArgs, WorktreeSession } from '../git/GitWorktreeManager';

/**
 * Represents a single worktree creation request being managed by the queue.
 */
export interface QueuedTask {
  /** A unique identifier for this specific request. */
  taskId: string;
  /** The arguments needed to create the worktree once it's clear to proceed. */
  args: CreateWorktreeArgs;
  /** The ISO timestamp of when the task was submitted, for FIFO sorting. */
  timestamp: string;
  /** An optional user-defined priority (lower number is higher priority). */
  priority?: number;
  /** The current status of the task within the queue. */
  status: 'PENDING' | 'RUNNING' | 'WAITING';
  /** The ID of the created WorktreeSession, populated once the task is running. */
  sessionId?: string;
  /** A function to call to resolve the promise returned when the task was submitted. */
  resolve: (session: WorktreeSession) => void;
  /** A function to call to reject the promise if the task fails. */
  reject: (reason?: unknown) => void;
}

export class WorktreeQueueManager {
  private queue: QueuedTask[] = [];

  public constructor(private readonly gitWorktreeManager: GitWorktreeManager) {}

  public submitTask(args: CreateWorktreeArgs, priority?: number): Promise<WorktreeSession> {
    return new Promise<WorktreeSession>((resolve, reject) => {
      const newTask: QueuedTask = {
        taskId: uuidv4(),
        args,
        priority,
        timestamp: new Date().toISOString(),
        status: 'PENDING',
        resolve,
        reject,
      };

      this.queue.push(newTask);
      logger.info(`Task ${newTask.taskId} submitted to the queue.`);
      void this._processQueue();
    });
  }

  public markTaskComplete(sessionId: string): void {
    const taskIndex = this.queue.findIndex(
      (task) => task.sessionId === sessionId
    );

    if (taskIndex > -1) {
      const completedTaskId = this.queue[taskIndex].taskId;
      this.queue.splice(taskIndex, 1);
      logger.info(`Task ${completedTaskId} (session: ${sessionId}) marked as complete and removed from queue.`);
    } else {
      // This is not an error. It just means the completed task was an external blocker.
      logger.info(`Completion signal for external session ${sessionId} received.`);
    }

    // Always re-process the queue after any completion signal.
    void this._processQueue();
  }

  private async _processQueue(): Promise<void> {
    if (this.queue.some((task) => task.status === 'RUNNING')) {
      logger.debug('Queue processing skipped: A task is already running.');
      return;
    }

    const sortedQueue = [...this.queue]
      .filter((task) => task.status === 'PENDING' || task.status === 'WAITING')
      .sort((a, b) => {
        const priorityA = a.priority ?? Infinity;
        const priorityB = b.priority ?? Infinity;
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        return a.timestamp.localeCompare(b.timestamp);
      });

    const candidate = sortedQueue[0];
    if (!candidate) {
      logger.debug('Queue processing finished: No pending tasks.');
      return;
    }

    const scanResult = await this.gitWorktreeManager.runConflictScan(candidate.args.changePlan);

    if (scanResult.status === 'CLEAR') {
      logger.info(`Task ${candidate.taskId} is clear to run. Proceeding with worktree creation.`);
      candidate.status = 'RUNNING';
      try {
        const session = await this.gitWorktreeManager.createWorktree(candidate.args);
        // Associate the session ID with the task for future lookup.
        candidate.sessionId = session.sessionId;
        candidate.resolve(session);
      } catch (error) {
        logger.error(`Task ${candidate.taskId} failed during execution.`, { error });
        candidate.reject(error);
        // Remove the failed task from the queue
        this.queue = this.queue.filter((t) => t.taskId !== candidate.taskId);
      }
    } else {
      candidate.status = 'WAITING';
      logger.info(
        `Task ${candidate.taskId} has a conflict with session ${scanResult.conflictingSessionId}. Status set to WAITING.`
      );
    }
  }
}