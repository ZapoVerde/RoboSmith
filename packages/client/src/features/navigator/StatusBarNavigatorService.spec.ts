/**
 * @file packages/client/src/features/navigator/StatusBarNavigatorService.spec.ts
 * @stamp 2025-11-30T17:00:00.000Z
 * @test-target packages/client/src/features/navigator/StatusBarNavigatorService.ts
 * @description
 * Verifies the complete lifecycle of the Status Bar Navigator.
 * 1. Initialization and rendering.
 * 2. Navigation logic (switching contexts).
 * 3. Creation logic (Queue integration and Ignition state persistence).
 * @criticality CRITICAL
 * @testing-layer Unit
 */

import { vi } from 'vitest';

// --- Mocks ---
vi.mock('uuid', () => ({ v4: vi.fn(() => 'mocked-uuid') }));

vi.mock('vscode', () => {
    const mockStatusBarItem = { show: vi.fn(), text: '', tooltip: '', command: '' };
    const mockCreateStatusBarItem = vi.fn(() => mockStatusBarItem);
    const mockShowQuickPick = vi.fn();
    const mockShowInputBox = vi.fn();
    const mockUpdateWorkspaceFolders = vi.fn().mockReturnValue(true);
    const mockRegisterCommand = vi.fn();
    const mockGlobalStateUpdate = vi.fn();
    const mockWorkspaceFolders: unknown[] = [];
  
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
        file: (path: string) => ({ fsPath: path, path: path, scheme: 'file', toJSON: () => path }),
      },
      StatusBarAlignment: { Left: 1 },
      QuickPickItemKind: { Separator: -1 },
      // Expose mocks for assertions
      __mocks: {
        mockStatusBarItem,
        mockShowQuickPick,
        mockShowInputBox,
        mockUpdateWorkspaceFolders,
        mockRegisterCommand,
        mockWorkspaceFolders,
        mockGlobalStateUpdate
      },
      default: {},
    };
});
  
// Mock Dependencies
vi.mock('../../lib/git/GitWorktreeManager');
vi.mock('../../lib/workflow/WorktreeQueueManager');
  
import { describe, it, expect, beforeEach } from 'vitest';
import type { Mock, Mocked } from 'vitest';
import * as vscode from 'vscode';
import { StatusBarNavigatorService, type INavigatorDependencies } from './StatusBarNavigatorService';
import { GitWorktreeManager, type WorktreeSession } from '../../lib/git/GitWorktreeManager';
import { WorktreeQueueManager } from '../../lib/workflow/WorktreeQueueManager';
import type { GitAdapter } from '../../lib/git/IGitAdapter';
  
// Access internal mocks
type MockedVSCode = typeof vscode & {
    __mocks: {
      mockStatusBarItem: Mocked<vscode.StatusBarItem>;
      mockShowQuickPick: Mock;
      mockShowInputBox: Mock;
      mockUpdateWorkspaceFolders: Mock;
      mockRegisterCommand: Mock;
      mockWorkspaceFolders: unknown[];
      mockGlobalStateUpdate: Mock;
    };
};

const {
    mockStatusBarItem,
    mockShowQuickPick,
    mockShowInputBox,
    mockUpdateWorkspaceFolders,
    mockRegisterCommand,
    mockWorkspaceFolders,
    mockGlobalStateUpdate
} = (vscode as MockedVSCode).__mocks;
  
type NavigatorItem = vscode.QuickPickItem & { id: string };
  
describe('StatusBarNavigatorService', () => {
    let service: StatusBarNavigatorService;
    let mockGitWorktreeManager: Mocked<GitWorktreeManager>;
    let mockWorktreeQueueManager: Mocked<WorktreeQueueManager>;
    let mockContext: vscode.ExtensionContext;
    let mockMainProjectRoot: vscode.WorkspaceFolder;
    let mockDeps: INavigatorDependencies;
  
    beforeEach(() => {
      vi.clearAllMocks();
  
      mockMainProjectRoot = {
        uri: vscode.Uri.file('/mock/workspace'),
        name: 'mock-project',
        index: 0,
      };
      mockWorkspaceFolders.length = 0;
      mockWorkspaceFolders.push(mockMainProjectRoot);
  
      // Stub managers
      const mockAdapter = {} as GitAdapter;
      mockGitWorktreeManager = new GitWorktreeManager(mockAdapter) as Mocked<GitWorktreeManager>;
      mockWorktreeQueueManager = new WorktreeQueueManager(mockGitWorktreeManager) as Mocked<WorktreeQueueManager>;
      
      // Stub Context
      mockContext = {
          globalState: { update: mockGlobalStateUpdate },
          subscriptions: []
      } as unknown as vscode.ExtensionContext;

      // Construct explicit dependency object to avoid 'vscode as any'
      mockDeps = {
          window: {
              createStatusBarItem: vscode.window.createStatusBarItem,
              showQuickPick: vscode.window.showQuickPick,
              showInputBox: vscode.window.showInputBox,
          },
          workspace: {
              updateWorkspaceFolders: vscode.workspace.updateWorkspaceFolders,
          },
          commands: {
              registerCommand: vscode.commands.registerCommand,
          }
      };
  
      service = new StatusBarNavigatorService(
        mockGitWorktreeManager,
        mockWorktreeQueueManager,
        mockContext,
        mockDeps,
        mockContext.subscriptions
      );
    });
  
    describe('Initialization', () => {
      it('should create a status bar item with correct initial properties', () => {
        service.initialize(mockMainProjectRoot);
        // We check the mock accessed via the __mocks property
        expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(vscode.StatusBarAlignment.Left, 100);
        expect(mockStatusBarItem.command).toBe('roboSmith.showNavigator');
        expect(mockStatusBarItem.show).toHaveBeenCalled();
      });
  
      it('should register the showNavigator command', () => {
        service.initialize(mockMainProjectRoot);
        expect(mockRegisterCommand).toHaveBeenCalledWith('roboSmith.showNavigator', expect.any(Function));
      });
    });
  
    describe('Navigation (showNavigator)', () => {
      const MOCK_SESSIONS: readonly WorktreeSession[] = [
        { sessionId: 's1', status: 'Running', branchName: 'feat/one', worktreePath: '/path/s1', changePlan: [] },
        { sessionId: 's2', status: 'Queued', branchName: 'fix/two', worktreePath: '/path/s2', changePlan: [] },
      ];
      
      it('should render the correct status icon for each session state', async () => {
        const detailedSessions: readonly WorktreeSession[] = [
          { sessionId: 's1', status: 'Running', branchName: 'running', worktreePath: '/path/s1', changePlan: [] },
          { sessionId: 's2', status: 'Queued', branchName: 'queued', worktreePath: '/path/s2', changePlan: [] },
          { sessionId: 's3', status: 'Held', branchName: 'held', worktreePath: '/path/s3', changePlan: [] },
        ];
        service.initialize(mockMainProjectRoot);
        mockGitWorktreeManager.getAllSessions.mockReturnValue(detailedSessions);
  
        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();
  
        const quickPickItems = mockShowQuickPick.mock.calls[0][0] as NavigatorItem[];
  
        const runningItem = quickPickItems.find(item => item.id === 's1');
        const queuedItem = quickPickItems.find(item => item.id === 's2');
        const heldItem = quickPickItems.find(item => item.id === 's3');
  
        expect(runningItem?.label).toContain('▶️');
        expect(queuedItem?.label).toContain('⏳');
        expect(heldItem?.label).toContain('⏸️');
      });

      it('should display minimal list when no sessions active', async () => {
        service.initialize(mockMainProjectRoot);
        mockGitWorktreeManager.getAllSessions.mockReturnValue([]);
  
        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();
  
        const quickPickItems = mockShowQuickPick.mock.calls[0][0] as NavigatorItem[];
        expect(quickPickItems).toHaveLength(4); // Main + Create + 2 Separators
      });
  
      it('should switch to the main project when "My Project" is selected', async () => {
        service.initialize(mockMainProjectRoot);
        const mainItem: NavigatorItem = { label: 'My Project', id: 'main' };
        mockShowQuickPick.mockResolvedValue(mainItem);
  
        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();
  
        expect(mockUpdateWorkspaceFolders).toHaveBeenCalledWith(0, 1, { uri: mockMainProjectRoot.uri });
        expect(mockStatusBarItem.text).toBe('🤖 RoboSmith: My Project (main)');
      });
  
      it('should switch to the correct worktree when a session is selected', async () => {
        service.initialize(mockMainProjectRoot);
        mockGitWorktreeManager.getAllSessions.mockReturnValue(MOCK_SESSIONS);
        const sessionItem: NavigatorItem = { label: 'Session 1', id: 's1' };
        mockShowQuickPick.mockResolvedValue(sessionItem);
  
        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();
  
        expect(mockUpdateWorkspaceFolders).toHaveBeenCalledWith(0, 1, {
          uri: expect.objectContaining({ fsPath: MOCK_SESSIONS[0].worktreePath }),
        });
      });
    });
  
    describe('Creation (createNewWorkflow)', () => {
      it('should submit to queue, persist pending state, and switch workspace', async () => {
        service.initialize(mockMainProjectRoot);
        
        // 1. Select "Create New"
        const createItem: NavigatorItem = { label: 'Create New', id: 'createNew' };
        mockShowQuickPick.mockResolvedValueOnce(createItem);
        // 2. Enter Name
        mockShowInputBox.mockResolvedValue('My Task');
        // 3. Select Mode (Manual)
        const manualModeItem: NavigatorItem = { label: 'Manual', id: 'manual' };
        mockShowQuickPick.mockResolvedValueOnce(manualModeItem);
    
        // Queue Mock
        const mockSession: WorktreeSession = { 
            sessionId: 's1', 
            worktreePath: '/path/s1', 
            branchName: 'b1', 
            changePlan: [], 
            status: 'Running' 
        };
        mockWorktreeQueueManager.submitTask.mockResolvedValue(mockSession);
    
        // Act
        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();
    
        // Assert
        // 1. Submitted to Queue
        expect(mockWorktreeQueueManager.submitTask).toHaveBeenCalled();
        
        // 2. Persisted Ignition State
        expect(mockGlobalStateUpdate).toHaveBeenCalledWith(
            'roboSmith.pendingWorkflow',
            expect.objectContaining({
                sessionId: 's1',
                nodeId: 'Implement',
                isManualApprovalMode: true
            })
        );
    
        // 3. Switched Workspace
        expect(mockUpdateWorkspaceFolders).toHaveBeenCalledWith(
            expect.anything(), expect.anything(), { uri: expect.objectContaining({ fsPath: '/path/s1' }) }
        );
      });

      it('should cancel if user provides no name', async () => {
        service.initialize(mockMainProjectRoot);
        const createItem: NavigatorItem = { label: 'Create New', id: 'createNew' };
        mockShowQuickPick.mockResolvedValueOnce(createItem);
        mockShowInputBox.mockResolvedValue(undefined); // User canceled input

        const commandHandler = mockRegisterCommand.mock.calls[0][1];
        await commandHandler();

        expect(mockWorktreeQueueManager.submitTask).not.toHaveBeenCalled();
      });
    });
});