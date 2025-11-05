/**
 * @file packages/client/src/lib/git/GitWorktreeManager.spec.ts
 * @stamp S-20251105T180500Z-V-HOISTING-FINAL-FIX
 * @test-target packages/client/src/lib/git/GitWorktreeManager.ts
 * @description
 * Verifies the complete functionality of the GitWorktreeManager, focusing on the
 * critical self-healing reconciliation loop, state persistence, and the handling
 * of "ghost" and "zombie" worktrees on startup.
 * @criticality
 * CRITICAL (Reason: State Store Ownership, I/O & Concurrency Management).
 * @testing-layer Integration
 *
 * @contract
 *   assertions:
 *     purity: read-only
 *     external_io: none      # All external APIs (fs, globalState) are mocked.
 *     state_ownership: none
 */


import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { Mock, Mocked } from 'vitest';

// --- HOISTING-SAFE MOCKS: Everything inside the factory ---
vi.mock('vscode', () => {
  // Define MockFileSystemError INSIDE the factory
  class MockFileSystemError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }
  
  const mockReadDirectory = vi.fn();
  
  interface MockUri {
      fsPath: string;
      path: string;
      scheme: string;
      authority: string;
      query: string;
      fragment: string;
      with: Mock;
      toJSON: Mock;
  }
  
  const mockUri = {
    fsPath: '/mock/workspace/root',
    with: vi.fn(),
    path: '/mock/workspace/root',
    scheme: 'file',
    authority: '',
    query: '',
    fragment: '',
    toJSON: vi.fn(),
  } as unknown as MockUri;
  
  return {
    workspace: {
      workspaceFolders: [{ uri: mockUri }],
      fs: {
        readDirectory: mockReadDirectory,
      },
    },
    Uri: {
      joinPath: vi.fn((base: MockUri, ...parts: string[]) => ({
        fsPath: `${base.fsPath}/${parts.join('/')}`,
        path: `${base.path}/${parts.join('/')}`,
        scheme: 'file',
        authority: '',
        query: '',
        fragment: '',
        with: vi.fn(),
        toJSON: vi.fn(),
      })),
      file: vi.fn(),
    },
    FileType: {
        Directory: 2,
        File: 1,
    },
    FileSystemError: MockFileSystemError,
  };
});

vi.mock('../logging/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// NOW import after mocks are defined
import * as vscode from 'vscode';
import { GitWorktreeManager, type WorktreeSession } from './GitWorktreeManager';
import { logger } from '../logging/logger';

// Access the mock directly from the mocked module
const mockReadDirectory = vscode.workspace.fs.readDirectory as Mock;

describe('GitWorktreeManager - Reconciliation Loop', () => {
    let manager: GitWorktreeManager;
    let mockContext: Mocked<vscode.ExtensionContext>;
    
    const mockGlobalStateGet = vi.fn();
    const mockGlobalStateUpdate = vi.fn();

    const WORKTREES_DIR_URI = '/mock/workspace/root/.worktrees';
    const MOCK_SESSION_1: WorktreeSession = {
        sessionId: 'session-a',
        worktreePath: `${WORKTREES_DIR_URI}/session-a`,
        branchName: 'a-branch',
        changePlan: ['a.ts'],
        status: 'Running',
    };
    const MOCK_SESSION_2: WorktreeSession = {
        sessionId: 'session-b',
        worktreePath: `${WORKTREES_DIR_URI}/session-b`,
        branchName: 'b-branch',
        changePlan: ['b.ts'],
        status: 'Queued',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        
        (GitWorktreeManager as unknown as Record<string, unknown>)['instance'] = undefined;
        manager = GitWorktreeManager.getInstance();

        mockContext = {
            globalState: {
                get: mockGlobalStateGet,
                update: mockGlobalStateUpdate,
            },
        } as unknown as Mocked<vscode.ExtensionContext>;

        mockGlobalStateGet.mockResolvedValue({
            [MOCK_SESSION_1.sessionId]: MOCK_SESSION_1,
            [MOCK_SESSION_2.sessionId]: MOCK_SESSION_2,
        });
        
        mockReadDirectory.mockResolvedValue([
            ['session-a', vscode.FileType.Directory],
            ['session-b', vscode.FileType.Directory],
            ['.git', vscode.FileType.Directory],
        ]);
    });

    it('should initialize with a clean state when cached state and disk match', async () => {
        await manager.initialize(mockContext);
        
        expect(mockGlobalStateUpdate).not.toHaveBeenCalled();
        expect(manager._getSessionMap().size).toBe(2);
        expect(manager._getSessionMap().get('session-a')).toEqual(MOCK_SESSION_1);
    });
    
    it('should handle missing .worktrees/ directory by initializing with 0 sessions', async () => {
        // Create error with code property from the start
        const fileNotFoundError = Object.assign(
            new vscode.FileSystemError('Not Found'),
            { code: 'FileNotFound' }
        );
        mockReadDirectory.mockRejectedValue(fileNotFoundError);
        
        await manager.initialize(mockContext);
        
        expect(manager._getSessionMap().size).toBe(0);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Worktrees directory not found'));
    });

    it('should remove "Ghost" sessions (In State, Not on Disk) and persist the change', async () => {
        mockReadDirectory.mockResolvedValue([
            ['session-a', vscode.FileType.Directory],
        ]);
        
        await manager.initialize(mockContext);
        
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Ghost'));
        expect(manager._getSessionMap().size).toBe(1);
        expect(manager._getSessionMap().has('session-b')).toBe(false);
        
        expect(mockGlobalStateUpdate).toHaveBeenCalledOnce();
        const updatedState = mockGlobalStateUpdate.mock.calls[0][1];
        expect(updatedState).toEqual({ [MOCK_SESSION_1.sessionId]: MOCK_SESSION_1 });
    });
    
    it('should ignore "Zombie" directories (On Disk, Not in State) and log a warning', async () => {
        mockGlobalStateGet.mockResolvedValue({
            [MOCK_SESSION_1.sessionId]: MOCK_SESSION_1,
        });
        
        await manager.initialize(mockContext);
        
        // FIX: Logger is called with a single string, not two args
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Zombie'));
        expect(manager._getSessionMap().size).toBe(1);
        expect(manager._getSessionMap().has('session-b')).toBe(false);
        expect(mockGlobalStateUpdate).not.toHaveBeenCalled();
    });

    it('should correctly handle the general case when both Ghost and Zombie exist', async () => {
        mockGlobalStateGet.mockResolvedValue({
            [MOCK_SESSION_1.sessionId]: MOCK_SESSION_1,
            [MOCK_SESSION_2.sessionId]: MOCK_SESSION_2,
        });

        const MOCK_ZOMBIE_ID = 'session-c';
        mockReadDirectory.mockResolvedValue([
            ['session-a', vscode.FileType.Directory],
            [MOCK_ZOMBIE_ID, vscode.FileType.Directory],
        ]);

        await manager.initialize(mockContext);

        expect(logger.warn).toHaveBeenCalledTimes(2);
        expect(manager._getSessionMap().size).toBe(1);
        expect(manager._getSessionMap().has('session-a')).toBe(true);
        expect(manager._getSessionMap().has('session-b')).toBe(false);
        expect(manager._getSessionMap().has('session-c')).toBe(false);
        expect(mockGlobalStateUpdate).toHaveBeenCalledOnce();
    });
});