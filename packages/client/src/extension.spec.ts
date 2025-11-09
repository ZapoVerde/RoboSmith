/**
 * @file packages/client/src/extension.spec.ts
 * @stamp S-20251107T194000Z-C-FINAL-TEST-PASS
 * @test-target packages/client/src/extension.ts
 * @description
 * Verifies the behavior of the extension's Composition Root (`activate` function).
 * This suite confirms that all primary services are correctly instantiated and
 * their initialization methods are called, and that critical startup errors are handled gracefully.
 * @criticality The test target is CRITICAL as it is the application's entry point.
 * @testing-layer Integration
 */

// --- HOISTING-SAFE MOCKS ---
vi.mock('vscode', () => {
    // ... (vscode mock is unchanged)
    const mockShowErrorMessage = vi.fn();
    const mockWorkspaceFolders: vscode.WorkspaceFolder[] = [];
    return {
        window: { showErrorMessage: mockShowErrorMessage, createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
        workspace: { get workspaceFolders() { return mockWorkspaceFolders; } },
        commands: { registerCommand: vi.fn() },
        ExtensionMode: { Development: 1, Production: 2, Test: 3 },
        __mocks: { mockShowErrorMessage, mockWorkspaceFolders },
        default: {},
    };
});

const mockGwmInitialize = vi.fn();
vi.mock('./lib/git/GitWorktreeManager', () => ({
    GitWorktreeManager: vi.fn().mockImplementation(function() { return { initialize: mockGwmInitialize }; }),
}));

const mockSbnInitialize = vi.fn();
vi.mock('./features/navigator/StatusBarNavigatorService', () => ({
    StatusBarNavigatorService: vi.fn().mockImplementation(function() { return { initialize: mockSbnInitialize }; }),
}));

vi.mock('./lib/logging/logger', () => ({
    logger: { initialize: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// FIX: Provide a constructable mock for RealGitAdapter.
vi.mock('./lib/git/RealGitAdapter', () => ({
    RealGitAdapter: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import { activate } from './extension';
import { logger } from './lib/logging/logger';
import { RealGitAdapter } from './lib/git/RealGitAdapter';
import { GitWorktreeManager } from './lib/git/GitWorktreeManager';
import { StatusBarNavigatorService } from './features/navigator/StatusBarNavigatorService';

type MockedVSCode = typeof vscode & {
    __mocks: { mockShowErrorMessage: Mock; mockWorkspaceFolders: vscode.WorkspaceFolder[]; };
};

const { mockShowErrorMessage, mockWorkspaceFolders } = (vscode as MockedVSCode).__mocks;

describe('Extension Activation', () => {
    let mockContext: vscode.ExtensionContext;
    let mockMainProjectRoot: vscode.WorkspaceFolder;

    beforeEach(() => {
        vi.clearAllMocks();
        mockMainProjectRoot = { uri: { fsPath: '/mock/workspace' } as vscode.Uri, name: 'mock-project', index: 0 };
        mockWorkspaceFolders.length = 0;
        mockWorkspaceFolders.push(mockMainProjectRoot);
        mockContext = { subscriptions: [], extensionMode: vscode.ExtensionMode.Test } as unknown as vscode.ExtensionContext;
    });

    it('should instantiate and initialize all services on a happy path', async () => {
        mockGwmInitialize.mockResolvedValue(undefined);
        await activate(mockContext);
        expect(logger.initialize).toHaveBeenCalledWith(vscode.ExtensionMode.Test);
        expect(GitWorktreeManager).toHaveBeenCalledOnce();
        expect(mockGwmInitialize).toHaveBeenCalledOnce();
        expect(StatusBarNavigatorService).toHaveBeenCalledOnce();
        expect(mockSbnInitialize).toHaveBeenCalledWith(mockMainProjectRoot);
        expect(mockShowErrorMessage).not.toHaveBeenCalled();
    });

    it('should show an error and halt if no workspace folder is open', async () => {
        mockWorkspaceFolders.length = 0;
        await activate(mockContext);
        expect(mockShowErrorMessage).toHaveBeenCalledWith(
            'RoboSmith failed to start: No workspace folder open. RoboSmith requires a project to be open.'
        );
        // It fails before any services are instantiated.
        expect(RealGitAdapter).not.toHaveBeenCalled();
        expect(GitWorktreeManager).not.toHaveBeenCalled();
    });

    it('should show an error and halt if a core service fails to initialize', async () => {
        const initError = new Error('Filesystem corrupted');
        mockGwmInitialize.mockRejectedValue(initError);
        await activate(mockContext);

        expect(logger.error).toHaveBeenCalledWith('Failed to activate RoboSmith extension: Filesystem corrupted');
        expect(mockShowErrorMessage).toHaveBeenCalledWith('RoboSmith failed to start: Filesystem corrupted');
        
        // Assert that the constructor was called...
        expect(GitWorktreeManager).toHaveBeenCalledOnce();
        expect(StatusBarNavigatorService).toHaveBeenCalledOnce();

        // FIX: Assert that the *second* service's initialize method was NOT called.
        expect(mockSbnInitialize).not.toHaveBeenCalled();
    });
});