/**
 * @file packages/client/src/lib/workflow/WorktreeQueueManager.spec.ts
 * @stamp S-20251107T092000Z-C-QUEUE-MANAGER-TEST-CREATED
 * @test-target packages/client/src/lib/workflow/WorktreeQueueManager.ts
 * @description Verifies the WorktreeQueueManager's logic, including immediate execution for clear tasks, correct queuing on conflict, FIFO processing, and the auto-advancement of the queue when a task is marked complete.
 * @criticality The test target is CRITICAL.
 * @testing-layer Unit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { WorktreeQueueManager } from './WorktreeQueueManager';
import { GitWorktreeManager } from '../git/GitWorktreeManager';
import type { CreateWorktreeArgs, WorktreeSession, ConflictScanResult } from '../git/GitWorktreeManager';
import type { GitAdapter } from '../git/IGitAdapter';

// Hoisted Mocks
vi.mock('vscode', () => ({
  // Minimal mock to prevent import errors in dependencies
  workspace: {},
  Uri: {},
  FileType: {},
}));
vi.mock('uuid', () => ({ v4: vi.fn() }));
vi.mock('../logging/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../git/GitWorktreeManager');

describe('WorktreeQueueManager', () => {
  let manager: WorktreeQueueManager;
  let mockGitWorktreeManager: Mocked<GitWorktreeManager>;

  const MOCK_SESSION_A: WorktreeSession = { sessionId: 'session-a', worktreePath: '/a', branchName: 'a', changePlan: [], status: 'Running' };
  const MOCK_SESSION_B: WorktreeSession = { sessionId: 'session-b', worktreePath: '/b', branchName: 'b', changePlan: [], status: 'Running' };

  const ARGS_A: CreateWorktreeArgs = { baseBranch: 'main', changePlan: ['file-a.ts'] };
  const ARGS_B: CreateWorktreeArgs = { baseBranch: 'main', changePlan: ['file-b.ts'] };

  beforeEach(() => {
    vi.clearAllMocks();
    // The module is mocked, so `new GitWorktreeManager` returns a mock instance.
    // We provide a minimal, type-safe stub for its constructor argument to satisfy TypeScript.
    const mockAdapterStub = {} as GitAdapter;
    mockGitWorktreeManager = new GitWorktreeManager(mockAdapterStub) as Mocked<GitWorktreeManager>;
    manager = new WorktreeQueueManager(mockGitWorktreeManager);
  });

  it('should execute a task immediately if there are no conflicts', async () => {
    // Arrange
    mockGitWorktreeManager.runConflictScan.mockResolvedValue({ status: 'CLEAR' });
    mockGitWorktreeManager.createWorktree.mockResolvedValue(MOCK_SESSION_A);

    // Act
    const session = await manager.submitTask(ARGS_A);

    // Assert
    expect(session).toEqual(MOCK_SESSION_A);
    expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledWith(ARGS_A);
  });

  it('should queue a task if a conflict is detected', async () => {
    // Arrange
    const clashResult: ConflictScanResult = { status: 'CLASH', conflictingSessionId: 'blocker', conflictingFiles: [] };
    mockGitWorktreeManager.runConflictScan.mockResolvedValue(clashResult);

    // Act
    void manager.submitTask(ARGS_A);
    // Give the async queue processing a chance to run
    await new Promise(setImmediate);

    // Assert
    expect(mockGitWorktreeManager.createWorktree).not.toHaveBeenCalled();
  });

  it('should process tasks in FIFO order when a blocker is cleared', async () => {
    // Arrange
    const clashResult: ConflictScanResult = { status: 'CLASH', conflictingSessionId: 'blocker', conflictingFiles: [] };
    mockGitWorktreeManager.runConflictScan.mockResolvedValue(clashResult);
    mockGitWorktreeManager.createWorktree
      .mockResolvedValueOnce(MOCK_SESSION_A)
      .mockResolvedValueOnce(MOCK_SESSION_B);

    // Act
    const promiseA = manager.submitTask(ARGS_A); // Submitted first
    const promiseB = manager.submitTask(ARGS_B); // Submitted second

    await new Promise(setImmediate); // Let initial processing happen
    expect(mockGitWorktreeManager.createWorktree).not.toHaveBeenCalled();

    // Clear the blocker
    mockGitWorktreeManager.runConflictScan.mockResolvedValue({ status: 'CLEAR' });
    manager.markTaskComplete('blocking-session-id');
    const sessionA = await promiseA;

    // Assert: Task A ran first
    expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledWith(ARGS_A);
    expect(sessionA).toEqual(MOCK_SESSION_A);

    // Mark Task A as complete to unblock Task B
    manager.markTaskComplete(sessionA.sessionId);
    const sessionB = await promiseB;

    // Assert: Task B ran second
    expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledWith(ARGS_B);
    expect(sessionB).toEqual(MOCK_SESSION_B);
  });

  it('should prioritize a higher-priority task', async () => {
    // Arrange
    const clashResult: ConflictScanResult = { status: 'CLASH', conflictingSessionId: 'blocker', conflictingFiles: [] };
    mockGitWorktreeManager.runConflictScan.mockResolvedValue(clashResult);
    mockGitWorktreeManager.createWorktree
      .mockResolvedValueOnce(MOCK_SESSION_B) // Expect B to run first
      .mockResolvedValueOnce(MOCK_SESSION_A);

    // Act
    const promiseA = manager.submitTask(ARGS_A); // Lower priority (default)
    const promiseB = manager.submitTask(ARGS_B, 1); // Higher priority (1)

    await new Promise(setImmediate);
    expect(mockGitWorktreeManager.createWorktree).not.toHaveBeenCalled();

    // Clear the blocker
    mockGitWorktreeManager.runConflictScan.mockResolvedValue({ status: 'CLEAR' });
    manager.markTaskComplete('blocking-session-id');
    const sessionB = await promiseB;

    // Assert: Task B (priority) ran first
    expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledWith(ARGS_B);
    expect(sessionB).toEqual(MOCK_SESSION_B);

    // Mark Task B as complete to unblock Task A
    manager.markTaskComplete(sessionB.sessionId);
    const sessionA = await promiseA;

    // Assert: Task A ran second
    expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledWith(ARGS_A);
    expect(sessionA).toEqual(MOCK_SESSION_A);
  });

  it('should re-process the queue when a task is marked complete', async () => {
    // Arrange
    const clashResult: ConflictScanResult = { status: 'CLASH', conflictingSessionId: 'blocker', conflictingFiles: [] };
    mockGitWorktreeManager.runConflictScan.mockResolvedValue(clashResult);
    mockGitWorktreeManager.createWorktree.mockResolvedValue(MOCK_SESSION_A);

    const promiseA = manager.submitTask(ARGS_A);
    await new Promise(setImmediate);
    expect(mockGitWorktreeManager.createWorktree).not.toHaveBeenCalled();

    // Act
    mockGitWorktreeManager.runConflictScan.mockResolvedValue({ status: 'CLEAR' });
    manager.markTaskComplete('blocking-session-id'); // This triggers the re-processing
    const sessionA = await promiseA;

    // Assert
    expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledWith(ARGS_A);
    expect(sessionA).toEqual(MOCK_SESSION_A);
  });

  it('should reject the task promise and remove the task if execution fails', async () => {
    // Arrange
    const executionError = new Error('Git command failed');
    mockGitWorktreeManager.runConflictScan.mockResolvedValue({ status: 'CLEAR' });
    mockGitWorktreeManager.createWorktree.mockRejectedValue(executionError);

    // Act & Assert
    await expect(manager.submitTask(ARGS_A)).rejects.toThrow(executionError);

    // Assert that the queue is now empty and unblocked for the next task
    mockGitWorktreeManager.createWorktree.mockResolvedValue(MOCK_SESSION_B); // Setup for success
    const sessionB = await manager.submitTask(ARGS_B);
    expect(sessionB).toEqual(MOCK_SESSION_B);
    expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledWith(ARGS_B);
  });

  it('should queue a new task as PENDING if another task is already RUNNING', async () => {
    // Arrange
    let resolveFirstTask: ((value: WorktreeSession) => void) | undefined;
    const firstTaskRunningPromise = new Promise<WorktreeSession>(resolve => {
      resolveFirstTask = resolve;
    });

    mockGitWorktreeManager.runConflictScan.mockResolvedValue({ status: 'CLEAR' });
    mockGitWorktreeManager.createWorktree.mockReturnValue(firstTaskRunningPromise);

    // Act 1: Start the first task, which will hang in the 'RUNNING' state
    const promiseA = manager.submitTask(ARGS_A);
    await new Promise(setImmediate); // Allow the queue to process and start Task A

    // Act 2: Submit a second task while the first is still running
    const promiseB = manager.submitTask(ARGS_B);
    await new Promise(setImmediate);

    // Assert 1: Only the first task should have attempted to be created
    expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledOnce();
    expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledWith(ARGS_A);

    // Act 3: Complete the first task
    mockGitWorktreeManager.createWorktree.mockResolvedValue(MOCK_SESSION_B); // Set up for Task B's success
    if (resolveFirstTask) {
        resolveFirstTask(MOCK_SESSION_A);
      } else {
        throw new Error('Test setup failed: resolveFirstTask was not assigned.');
      }
    const sessionA = await promiseA;
    manager.markTaskComplete(sessionA.sessionId);

    // Assert 2: Now that Task A is complete, Task B should run and resolve
    const sessionB = await promiseB;
    expect(sessionB).toEqual(MOCK_SESSION_B);
    expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledTimes(2);
    expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledWith(ARGS_B);
  });
});