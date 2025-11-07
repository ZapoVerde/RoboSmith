/**
 * @file packages/client/src/lib/git/GitWorktreeManager.spec.ts
 * @test-target packages/client/src/lib/git/GitWorktreeManager.ts
 * @description Verifies the orchestration logic of the GitWorktreeManager in
 * isolation by providing a mocked IGitAdapter. It tests the self-healing
 * reconciliation loop, state management, command delegation, and the new conflict scan logic.
 * @criticality The test target is CRITICAL.
 * @testing-layer Unit
 */

// --- HOISTING-SAFE MOCKS ---
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
  },
  Uri: {
    joinPath: vi.fn((base, ...parts) => ({ fsPath: `${base.fsPath}/${parts.join('/')}` })),
  },
  FileType: {
    Directory: 2,
  },
  FileSystemError: class MockFileSystemError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
  default: {},
}));

vi.mock('../logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}));


import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import * as vscode from 'vscode';
import { GitWorktreeManager, type WorktreeSession, type CreateWorktreeArgs } from './GitWorktreeManager';
import { logger } from '../logging/logger';
import type { GitAdapter } from './IGitAdapter';


describe('GitWorktreeManager', () => {
  let manager: GitWorktreeManager;
  let mockGitAdapter: Mocked<GitAdapter>;

  const MOCK_SESSION_A: WorktreeSession = {
    sessionId: 'session-a',
    worktreePath: '/mock/workspace/.worktrees/session-a',
    branchName: 'robo-smith/session-a',
    changePlan: ['file-a.ts', 'shared.ts'],
    status: 'Running',
  };

  const MOCK_SESSION_B: WorktreeSession = {
    sessionId: 'session-b',
    worktreePath: '/mock/workspace/.worktrees/session-b',
    branchName: 'robo-smith/session-b',
    changePlan: ['file-b.ts'],
    status: 'Queued',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockGitAdapter = {
      exec: vi.fn(),
      readDirectory: vi.fn(),
      getGlobalState: vi.fn().mockReturnValue(undefined),
      updateGlobalState: vi.fn(),
    };

    manager = new GitWorktreeManager(mockGitAdapter);
  });

  describe('initialize (Reconciliation Loop)', () => {
    it('should do nothing if state and disk are synchronized ("Happy Path")', async () => {
      // Arrange
      mockGitAdapter.getGlobalState.mockReturnValue({
        [MOCK_SESSION_A.sessionId]: MOCK_SESSION_A,
        [MOCK_SESSION_B.sessionId]: MOCK_SESSION_B,
      });
      mockGitAdapter.readDirectory.mockResolvedValue([
        ['session-a', vscode.FileType.Directory],
        ['session-b', vscode.FileType.Directory],
      ]);

      // Act
      await manager.initialize();

      // Assert
      expect(mockGitAdapter.updateGlobalState).not.toHaveBeenCalled();
      expect(manager._getSessionMap().size).toBe(2);
      expect(manager._getSessionMap().get('session-a')).toEqual(MOCK_SESSION_A);
    });

    it('should remove "Ghost" sessions (in state, not on disk)', async () => {
      // Arrange
      mockGitAdapter.getGlobalState.mockReturnValue({
        [MOCK_SESSION_A.sessionId]: MOCK_SESSION_A, // Exists on disk
        [MOCK_SESSION_B.sessionId]: MOCK_SESSION_B, // Ghost
      });
      mockGitAdapter.readDirectory.mockResolvedValue([
        ['session-a', vscode.FileType.Directory],
      ]);

      // Act
      await manager.initialize();

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Found "Ghost" worktree in state, removing: session-b')
      );
      expect(mockGitAdapter.updateGlobalState).toHaveBeenCalledOnce();
      const updatedState = mockGitAdapter.updateGlobalState.mock.calls[0][1];
      expect(updatedState).toEqual({ [MOCK_SESSION_A.sessionId]: MOCK_SESSION_A });
      expect(manager._getSessionMap().size).toBe(1);
    });

    it('should ignore "Zombie" directories (on disk, not in state)', async () => {
      // Arrange
      mockGitAdapter.getGlobalState.mockReturnValue({
        [MOCK_SESSION_A.sessionId]: MOCK_SESSION_A,
      });
      mockGitAdapter.readDirectory.mockResolvedValue([
        ['session-a', vscode.FileType.Directory],
        ['session-zombie', vscode.FileType.Directory], // Zombie
      ]);

      // Act
      await manager.initialize();

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Found "Zombie" directory on disk. Ignoring: session-zombie')
      );
      expect(mockGitAdapter.updateGlobalState).not.toHaveBeenCalled();
      expect(manager._getSessionMap().size).toBe(1);
      expect(manager._getSessionMap().has('session-zombie')).toBe(false);
    });

    it('should gracefully handle unexpected errors during directory read', async () => {
      // Arrange
      const unexpectedError = new Error('EIO: I/O error');
      mockGitAdapter.readDirectory.mockRejectedValue(unexpectedError);

      // Act
      await manager.initialize();

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        'Critical failure during worktree reconciliation.',
        { error: unexpectedError }
      );
      expect(manager._getSessionMap().size).toBe(0);
    });
  });

  describe('createWorktree', () => {
    it('should execute git command, persist state, and return a new session', async () => {
      // Arrange
      const args: CreateWorktreeArgs = {
        baseBranch: 'main',
        changePlan: ['src/index.ts'],
      };
      const expectedSessionId = 'mock-uuid-1234';
      const expectedBranchName = `robo-smith/${expectedSessionId.slice(0, 8)}`;
      const expectedPath = `/mock/workspace/.worktrees/${expectedSessionId}`;

      // Act
      const result = await manager.createWorktree(args);

      // Assert
      expect(mockGitAdapter.exec).toHaveBeenCalledWith(
        ['worktree', 'add', '-b', expectedBranchName, expectedPath, args.baseBranch],
        { cwd: '/mock/workspace' }
      );
      expect(mockGitAdapter.updateGlobalState).toHaveBeenCalledOnce();
      const persistedState = mockGitAdapter.updateGlobalState.mock.calls[0][1];
      expect(persistedState).toHaveProperty(expectedSessionId);
      expect(result.sessionId).toBe(expectedSessionId);
      expect(result.branchName).toBe(expectedBranchName);
      expect(result.worktreePath).toBe(expectedPath);
    });

    it('should not persist state if the git command fails', async () => {
      // Arrange
      const gitError = new Error('Git command failed');
      mockGitAdapter.exec.mockRejectedValue(gitError);
      const args: CreateWorktreeArgs = { baseBranch: 'main', changePlan: [] };

      // Act & Assert
      await expect(manager.createWorktree(args)).rejects.toThrow(gitError);
      expect(manager._getSessionMap().size).toBe(0);
      expect(mockGitAdapter.updateGlobalState).not.toHaveBeenCalled();
    });
  });

  describe('removeWorktree', () => {
    it('should execute cleanup commands and persist the removal', async () => {
      // Arrange
      manager['sessionMap'].set(MOCK_SESSION_A.sessionId, MOCK_SESSION_A);

      // Act
      await manager.removeWorktree(MOCK_SESSION_A.sessionId);

      // Assert
      expect(mockGitAdapter.exec).toHaveBeenCalledTimes(2);
      expect(mockGitAdapter.exec).toHaveBeenCalledWith(
        ['worktree', 'remove', MOCK_SESSION_A.worktreePath],
        { cwd: '/mock/workspace' }
      );
      expect(mockGitAdapter.exec).toHaveBeenCalledWith(
        ['branch', '-d', MOCK_SESSION_A.branchName],
        { cwd: '/mock/workspace' }
      );
      expect(mockGitAdapter.updateGlobalState).toHaveBeenCalledWith('activeWorktreeSessions', {});
      expect(manager._getSessionMap().size).toBe(0);
    });

    it('should log a warning and do nothing if the session ID is not found', async () => {
      // Act
      await manager.removeWorktree('non-existent-id');

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot remove worktree: Session ID "non-existent-id" not found.'
      );
      expect(mockGitAdapter.exec).not.toHaveBeenCalled();
      expect(mockGitAdapter.updateGlobalState).not.toHaveBeenCalled();
    });
  });

  describe('runConflictScan', () => {
    beforeEach(() => {
      // Setup the manager with existing sessions for conflict scanning
      manager['sessionMap'].set(MOCK_SESSION_A.sessionId, MOCK_SESSION_A);
      manager['sessionMap'].set(MOCK_SESSION_B.sessionId, MOCK_SESSION_B);
    });

    it('should return CLEAR status when there are no file overlaps', async () => {
      // Arrange
      const newChangePlan = ['new-file.ts', 'another-new-file.ts'];

      // Act
      const result = await manager.runConflictScan(newChangePlan);

      // Assert
      expect(result.status).toBe('CLEAR');
    });

    it('should return CLASH status with correct details on file overlap', async () => {
      // Arrange
      const newChangePlan = ['src/component.ts', 'shared.ts']; // Overlaps with MOCK_SESSION_A

      // Act
      const result = await manager.runConflictScan(newChangePlan);

      // Assert
      expect(result.status).toBe('CLASH');
      if (result.status === 'CLASH') {
        expect(result.conflictingSessionId).toBe(MOCK_SESSION_A.sessionId);
        expect(result.conflictingFiles).toEqual(['shared.ts']);
      }
    });
  });
});