/**
 * @file packages/client/src/features/navigator/StatusBarNavigatorService.spec.ts
 * @stamp S-20251107T192000Z-C-TEST-REFACTOR-COMPLETE
 * @test-target packages/client/src/features/navigator/StatusBarNavigatorService.ts
 * @description
 * Verifies the complete logic of the StatusBarNavigatorService in isolation. It uses
 * a complete vi.mock of the 'vscode' module to provide a fully controlled test
 * environment, as mandated by the project's testing standards for extension code.
 * @criticality The test target is CRITICAL as it is a primary user-facing UI orchestrator.
 * @testing-layer Unit
 */

// --- HOISTING-SAFE VSCODE MOCK ---
vi.mock('vscode', () => {
    const mockStatusBarItem = { show: vi.fn(), text: '', tooltip: '', command: '' };
    const mockCreateStatusBarItem = vi.fn(() => mockStatusBarItem);
    const mockShowQuickPick = vi.fn();
    const mockShowInputBox = vi.fn();
    const mockUpdateWorkspaceFolders = vi.fn().mockReturnValue(true);
    const mockRegisterCommand = vi.fn();
    const mockWorkspaceFolders: vscode.WorkspaceFolder[] = [];
  
    return {
      window: {
        createStatusBarItem: mockCreateStatusBarItem,
        showQuickPick: mockShowQuickPick,
        showInputBox: mockShowInputBox,
        createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
      },
      workspace: {
        updateWorkspaceFolders: mockUpdateWorkspaceFolders,
        get workspaceFolders() { return mockWorkspaceFolders; }
      },
      commands: {
        registerCommand: mockRegisterCommand,
      },
      Uri: {
        file: (path: string): vscode.Uri => ({ fsPath: path, path: path, scheme: 'file' } as vscode.Uri),
      },
      StatusBarAlignment: { Left: 1 },
      QuickPickItemKind: { Separator: -1 },
      __mocks: {
        mockStatusBarItem,
        mockShowQuickPick,
        mockShowInputBox,
        mockUpdateWorkspaceFolders,
        mockRegisterCommand,
        mockWorkspaceFolders,
      },
      default: {},
    };
  });
  
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import type { Mock, Mocked } from 'vitest';
  import * as vscode from 'vscode';
  import { StatusBarNavigatorService } from './StatusBarNavigatorService';
  import { GitWorktreeManager, type WorktreeSession } from '../../lib/git/GitWorktreeManager';
  import type { GitAdapter } from '../../lib/git/IGitAdapter';
  
  vi.mock('../../lib/git/GitWorktreeManager');
  
  type MockedVSCode = typeof vscode & {
    __mocks: {
      mockStatusBarItem: Mocked<vscode.StatusBarItem>;
      mockShowQuickPick: Mock;
      mockShowInputBox: Mock;
      mockUpdateWorkspaceFolders: Mock;
      mockRegisterCommand: Mock;
      mockWorkspaceFolders: vscode.WorkspaceFolder[];
    };
  };
  
  const {
    mockStatusBarItem,
    mockShowQuickPick,
    mockShowInputBox,
    mockUpdateWorkspaceFolders,
    mockRegisterCommand,
    mockWorkspaceFolders,
  } = (vscode as MockedVSCode).__mocks;
  
  type NavigatorItem = vscode.QuickPickItem & { id: string };
  
  describe('StatusBarNavigatorService', () => {
    // These variables are shared across all tests in this suite
    let service: StatusBarNavigatorService;
    let mockGitWorktreeManager: Mocked<GitWorktreeManager>;
    let mockSubscriptions: vscode.Disposable[];
    let mockMainProjectRoot: vscode.WorkspaceFolder;
  
    // This hook runs before EACH test, resetting the state
    beforeEach(() => {
      vi.clearAllMocks();
  
      mockMainProjectRoot = {
        uri: vscode.Uri.file('/mock/workspace'),
        name: 'mock-project',
        index: 0,
      };
      mockWorkspaceFolders.length = 0;
      mockWorkspaceFolders.push(mockMainProjectRoot);
  
      const mockGitAdapter = {} as GitAdapter;
      mockGitWorktreeManager = new GitWorktreeManager(mockGitAdapter) as Mocked<GitWorktreeManager>;
      mockSubscriptions = [];
  
      service = new StatusBarNavigatorService(
        mockGitWorktreeManager,
        vscode,
        mockSubscriptions
      );
    });
  
    describe('initialize', () => {
      it('should create a status bar item with correct initial properties', () => {
        service.initialize(mockMainProjectRoot);
        expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(vscode.StatusBarAlignment.Left, 100);
        expect(mockStatusBarItem.command).toBe('roboSmith.showNavigator');
      });
  
      it('should register the showNavigator command', () => {
        service.initialize(mockMainProjectRoot);
        expect(mockRegisterCommand).toHaveBeenCalledWith('roboSmith.showNavigator', expect.any(Function));
      });
    });
  
    describe('showNavigator (Command Logic)', () => {
      // FIX: Define the mock data needed for this test suite
      const MOCK_SESSIONS: readonly WorktreeSession[] = [
        { sessionId: 's1', status: 'Running', branchName: 'feat/one', worktreePath: '/path/s1', changePlan: [] },
        { sessionId: 's2', status: 'Queued', branchName: 'fix/two', worktreePath: '/path/s2', changePlan: [] },
      ];
      
      it('should render the correct status icon for each session state', async () => {
        const detailedSessions: readonly WorktreeSession[] = [
          { sessionId: 's1', status: 'Running', branchName: 'running-task', worktreePath: '/path/s1', changePlan: [] },
          { sessionId: 's2', status: 'Queued', branchName: 'queued-task', worktreePath: '/path/s2', changePlan: [] },
          { sessionId: 's3', status: 'Held', branchName: 'held-task', worktreePath: '/path/s3', changePlan: [] },
        ];
        service.initialize(mockMainProjectRoot);
        mockGitWorktreeManager.getAllSessions.mockReturnValue(detailedSessions);
  
        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();
  
        // Cast the retrieved arguments to the correct type one time.
        // This allows TypeScript to correctly infer the type of 'item' in the .find() calls below.
        const quickPickItems = mockShowQuickPick.mock.calls[0][0] as NavigatorItem[];
  
        const runningItem = quickPickItems.find(item => item.id === 's1');
        const queuedItem = quickPickItems.find(item => item.id === 's2');
        const heldItem = quickPickItems.find(item => item.id === 's3');
  
        // Add null/undefined checks to satisfy strict null checking
        expect(runningItem?.label).toContain('(▶️)');
        expect(queuedItem?.label).toContain('(⏳)');
        expect(heldItem?.label).toContain('(⏸️)');
      });

      it('should display a minimal list when no sessions are active', async () => {
        service.initialize(mockMainProjectRoot);
        // Ensure the mock returns an empty array for this specific test
        mockGitWorktreeManager.getAllSessions.mockReturnValue([]);
  
        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();
  
        expect(mockShowQuickPick).toHaveBeenCalledOnce();
        const quickPickItems = mockShowQuickPick.mock.calls[0][0];
  
        // Assert that only the essential items are shown
        expect(quickPickItems).toHaveLength(4); // My Project, Separator, Create New, Separator
        expect(quickPickItems).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: 'main' }),
          expect.objectContaining({ id: 'createNew' }),
        ]));
      });
  
      it('should switch to the main project when "My Project" is selected', async () => {
        service.initialize(mockMainProjectRoot);
        mockShowQuickPick.mockResolvedValue({ id: 'main' } as NavigatorItem);
  
        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();
  
        expect(mockUpdateWorkspaceFolders).toHaveBeenCalledWith(0, 1, { uri: mockMainProjectRoot.uri });
        expect(mockStatusBarItem.text).toBe('🤖 RoboSmith: My Project (main)');
      });
  
      // FIX: This is one of the corrected tests. It now uses the variables from beforeEach.
      it('should switch to the correct worktree when a session is selected', async () => {
        service.initialize(mockMainProjectRoot);
        mockGitWorktreeManager.getAllSessions.mockReturnValue(MOCK_SESSIONS);
        mockShowQuickPick.mockResolvedValue({ id: 's1' } as NavigatorItem);
  
        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();
  
        expect(mockUpdateWorkspaceFolders).toHaveBeenCalledWith(0, 1, {
          uri: expect.objectContaining({ fsPath: MOCK_SESSIONS[0].worktreePath }),
        });
        expect(mockStatusBarItem.text).toBe(`🤖 RoboSmith: ${MOCK_SESSIONS[0].branchName}`);
      });
  
      // FIX: This is the second corrected test. It also uses variables from beforeEach.
      it('should handle user cancellation from QuickPick gracefully', async () => {
        service.initialize(mockMainProjectRoot);
        mockShowQuickPick.mockResolvedValue(undefined); // Simulates ESC
  
        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();
  
        expect(mockUpdateWorkspaceFolders).not.toHaveBeenCalled();
        expect(mockShowInputBox).not.toHaveBeenCalled();
      });
    });
  
    describe('createNewWorkflow (Flow Logic)', () => {
      it('should prompt for a name, create a worktree, and switch to it', async () => {
        const newSession: WorktreeSession = { sessionId: 's-new', branchName: 'feat/new-task', worktreePath: '/path/new', status: 'Running', changePlan: [] };
        service.initialize(mockMainProjectRoot);
  
        mockShowQuickPick.mockResolvedValue({ id: 'createNew' } as NavigatorItem);
        mockShowInputBox.mockResolvedValue('New Task');
        mockGitWorktreeManager.createWorktree.mockResolvedValue(newSession);
  
        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();
  
        expect(mockShowInputBox).toHaveBeenCalledOnce();
        expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledOnce();
        expect(mockUpdateWorkspaceFolders).toHaveBeenCalledWith(0, 1, {
          uri: expect.objectContaining({ fsPath: newSession.worktreePath }),
        });
        expect(mockStatusBarItem.text).toBe(`🤖 RoboSmith: ${newSession.branchName}`);
      });
    });
  });