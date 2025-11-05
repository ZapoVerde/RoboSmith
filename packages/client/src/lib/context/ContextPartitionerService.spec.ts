/**
 * @file packages/client/src/lib/context/ContextPartitionerService.spec.ts
 * @stamp S-20251105T163000Z-V-REWRITTEN-TO-FACADE
 * @test-target packages/client/src/lib/context/ContextPartitionerService.ts
 * @description
 * Verifies the contract of the ContextPartitionerService as a Stateless Façade.
 * This suite ensures the service correctly routes queries to the R_Mcp_ServerManager
 * and handles success/failure responses from the underlying JSON-RPC client.
 * @criticality
 * CRITICAL (Reason: Core Business Logic Orchestration, High Fan-Out).
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     purity: read-only
 *     external_io: none
 *     state_ownership: none
 */

// --- HOISTING-SAFE MOCKS ---

vi.mock('../logging/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock the core dependency: R_Mcp_ServerManager
vi.mock('./R_Mcp_ServerManager', () => ({
    R_Mcp_ServerManager: {
        getInstance: vi.fn(),
    },
    // Export the placeholder types so they are available for casting
    JsonRpcClient: class JsonRpcClient {},
}));

// --- Imports ---

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import {
  ContextPartitionerService,
  McpQueryError,
} from './ContextPartitionerService';
import { R_Mcp_ServerManager, type JsonRpcClient } from './R_Mcp_ServerManager';
import type {
  FileOutline,
  GetFileOutlineArgs,
  GetSymbolReferencesArgs,
  SymbolReference,
} from './types';

describe('ContextPartitionerService (Stateless Façade)', () => {
    let mockServerManager: Mocked<R_Mcp_ServerManager>;
    let mockClient: Mocked<JsonRpcClient>;
    let service: ContextPartitionerService;

    const mockWorktreePath = '/mock/repo/worktree';

    beforeEach(() => {
        vi.clearAllMocks();
        
        // 1. Create and configure the Mock Client (JSON-RPC)
        mockClient = {
            sendCall: vi.fn().mockResolvedValue({ functions: [], classes: [] }),
        } as unknown as Mocked<JsonRpcClient>;

        // 2. Create and configure the Mock Server Manager (Dependency)
        mockServerManager = {
            getClientFor: vi.fn().mockReturnValue(mockClient),
        } as unknown as Mocked<R_Mcp_ServerManager>;

        // 3. Set the singleton instance with the mock dependency
        ContextPartitionerService['instance'] = undefined;
        service = ContextPartitionerService.getInstance(mockServerManager);
    });
    
    // --- Test Data ---
    const outlineArgs: GetFileOutlineArgs = {
        worktreePath: mockWorktreePath,
        filePath: 'src/component.ts',
    };
    const referencesArgs: GetSymbolReferencesArgs = {
        worktreePath: mockWorktreePath,
        symbolName: 'ComponentClass',
    };
    const mockFileOutline: FileOutline = {
        functions: [{ name: 'init', signature: '() => void', line: 10 }],
        classes: [{ name: 'BaseComponent', line: 5 }],
    };
    const mockSymbolReferences: SymbolReference[] = [
        { filePath: 'src/main.ts', line: 20 },
    ];


    describe('API Call Delegation (Happy Path)', () => {
        it('should correctly call getFileOutline by delegating to the client', async () => {
            // Arrange
            mockClient.sendCall.mockResolvedValue(mockFileOutline);

            // Act
            const result = await service.getFileOutline(outlineArgs);

            // Assert
            expect(mockServerManager.getClientFor).toHaveBeenCalledWith(mockWorktreePath);
            expect(mockClient.sendCall).toHaveBeenCalledWith(
                'get_file_outline',
                { filePath: outlineArgs.filePath }
            );
            expect(result).toEqual(mockFileOutline);
        });

        it('should correctly call getSymbolReferences by delegating to the client', async () => {
            // Arrange
            mockClient.sendCall.mockResolvedValue(mockSymbolReferences);

            // Act
            const result = await service.getSymbolReferences(referencesArgs);

            // Assert
            expect(mockServerManager.getClientFor).toHaveBeenCalledWith(mockWorktreePath);
            expect(mockClient.sendCall).toHaveBeenCalledWith(
                'get_symbol_references',
                { symbolName: referencesArgs.symbolName }
            );
            expect(result).toEqual(mockSymbolReferences);
        });
    });

    describe('Failure Handling', () => {
        it('should throw McpQueryError if no active R-MCP client is found', async () => {
            // Arrange
            mockServerManager.getClientFor.mockReturnValue(undefined);

            // Act & Assert
            await expect(service.getFileOutline(outlineArgs)).rejects.toThrow(McpQueryError);
            expect(mockClient.sendCall).not.toHaveBeenCalled();
        });

        it('should throw McpQueryError if the underlying JSON-RPC call fails', async () => {
            // Arrange
            mockClient.sendCall.mockRejectedValue(new Error('RPC Internal Server Error'));

            // Act & Assert
            await expect(service.getFileOutline(outlineArgs)).rejects.toThrow(McpQueryError);
            expect(mockClient.sendCall).toHaveBeenCalled();
        });
    });
});