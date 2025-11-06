/**
 * @file packages/client/src/lib/context/ContextPartitionerService.spec.ts
 * @stamp S-20251106T154021Z-V-DI-COMPLIANT
 * @test-target packages/client/src/lib/context/ContextPartitionerService.ts
 * @description
 * Verifies the contract of the refactored, dependency-injected
 * ContextPartitionerService. This suite uses a mock R_Mcp_ServerManager
 * to ensure the service correctly routes queries and handles success/failure
 * responses from the RPC client in isolation.
 * @criticality
 * The test target is CRITICAL as it is a high fan-out orchestrator of core business logic.
 * @testing-layer Unit
 */

// --- HOISTING-SAFE MOCKS ---
vi.mock('../logging/logger', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// We mock the dependency's module, not the class itself directly.
vi.mock('./R_Mcp_ServerManager');


import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { ContextPartitionerService, McpQueryError } from './ContextPartitionerService';
import { R_Mcp_ServerManager } from './R_Mcp_ServerManager';
import type { JsonRpcClient, JsonRpcClientFactory } from './R_Mcp_ServerManager';
import type { ProcessSpawner } from './IProcessSpawner';
import type { GetFileOutlineArgs, FileOutline } from './types';

describe('ContextPartitionerService (Stateless Façade)', () => {
    let mockServerManager: Mocked<R_Mcp_ServerManager>;
    let mockClient: Mocked<JsonRpcClient>;
    let service: ContextPartitionerService;

    const mockWorktreePath = '/mock/repo/worktree';

    beforeEach(() => {
        vi.clearAllMocks();
      
        mockClient = { sendCall: vi.fn() };

        // Create minimal, type-correct stubs for R_Mcp_ServerManager's dependencies.
        const mockSpawnerStub = {} as ProcessSpawner;
        const mockClientFactoryStub = (() => mockClient) as JsonRpcClientFactory;

        // Instantiate the dependency with the type-safe stubs.
        mockServerManager = new R_Mcp_ServerManager(mockSpawnerStub, mockClientFactoryStub) as Mocked<R_Mcp_ServerManager>;
      
        // Mock the specific method on the dependency that our service-under-test will call.
        mockServerManager.getClientFor = vi.fn().mockReturnValue(mockClient);

        // Instantiate the service-under-test using the new public constructor,
        // injecting our fully-formed mock dependency.
        service = new ContextPartitionerService(mockServerManager);
    });
    
    const outlineArgs: GetFileOutlineArgs = {
        worktreePath: mockWorktreePath,
        filePath: 'src/component.ts',
    };

    describe('API Call Delegation (Happy Path)', () => {
        it('should correctly call getFileOutline by delegating to the client', async () => {
            const mockFileOutline: FileOutline = { functions: [], classes: [] };
            mockClient.sendCall.mockResolvedValue(mockFileOutline);

            const result = await service.getFileOutline(outlineArgs);

            expect(mockServerManager.getClientFor).toHaveBeenCalledWith(mockWorktreePath);
            expect(mockClient.sendCall).toHaveBeenCalledWith('get_file_outline', { filePath: outlineArgs.filePath });
            expect(result).toEqual(mockFileOutline);
        });
    });

    describe('Failure Handling', () => {
        it('should throw McpQueryError if no active R-MCP client is found', async () => {
            mockServerManager.getClientFor.mockReturnValue(undefined);

            await expect(service.getFileOutline(outlineArgs)).rejects.toThrow(McpQueryError);
            expect(mockClient.sendCall).not.toHaveBeenCalled();
        });

        it('should throw McpQueryError if the underlying JSON-RPC call fails', async () => {
            mockClient.sendCall.mockRejectedValue(new Error('RPC Internal Server Error'));

            await expect(service.getFileOutline(outlineArgs)).rejects.toThrow(McpQueryError);
        });
    });
});