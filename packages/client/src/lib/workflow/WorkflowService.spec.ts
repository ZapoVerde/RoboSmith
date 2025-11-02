/**
 * @file packages/client/src/lib/workflow/WorkflowService.spec.ts
 * @stamp S-20251101T175000Z-V-TESTFIX-COMPLETE
 * @test-target packages/client/src/lib/workflow/WorkflowService.ts
 * @description
 * Verifies the contract of the WorkflowService. It ensures that the service
 * correctly locates, reads, and validates the `workflows.json` manifest, and that
 * it throws specific, user-friendly errors for all anticipated failure modes
 * (file not found, invalid JSON, schema mismatch).
 * @criticality
 * The test target is CRITICAL. As the loader for the Orchestrator's instructions, 
 * its reliability is paramount to the entire system's function (Rubric Point #2).
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Mocks the `vscode.workspace.fs` API to simulate file system interactions.
 *     - Verifies that a `ManifestNotFoundError` is thrown when the file does not exist.
 *     - Verifies that an `InvalidJsonError` is thrown for malformed JSON content.
 *     - Verifies that a `SchemaValidationError` is thrown for structurally incorrect data.
 *     - Verifies successful parsing and return of a valid manifest object.
 */

// CORRECTED: This is the definitive, hoisting-safe pattern. The mock is now
// complete enough to satisfy all dependencies, including the logger.
vi.mock('vscode', () => {
    // Mock function for fs.readFile
    const mockReadFile = vi.fn();
  
    // Mock for the object returned by createOutputChannel
    const mockOutputChannel = {
      appendLine: vi.fn(),
      append: vi.fn(),
      clear: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
      hide: vi.fn(),
      name: 'RoboSmith',
    };
  
    // Mock for the window object
    const mockWindow = {
      createOutputChannel: vi.fn().mockReturnValue(mockOutputChannel),
    };
  
    // Return the complete mock object for the 'vscode' module.
    return {
      workspace: {
        fs: {
          readFile: mockReadFile,
        },
      },
      window: mockWindow, // <-- The missing piece
      Uri: {
        file: (path: string) => ({ fsPath: path }),
      },
      default: {},
      // Expose the internal mocks for the test to access
      __mockReadFile: mockReadFile,
      __mockOutputChannel: mockOutputChannel,
    };
  });
  
  // Now that the mock is fully defined, we can safely import the modules.
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { WorkflowService, type WorkflowManifest } from './WorkflowService';
  import * as vscode from 'vscode';
  import type { Mock } from 'vitest';
  
  // Extract the exposed mock function from the mocked module for use in the tests.
  const mockReadFile = (vscode as unknown as { __mockReadFile: Mock }).__mockReadFile;
  
  
  describe('WorkflowService', () => {
    let service: WorkflowService;
    const workspaceRoot = '/test/workspace';
  
    const validManifest: WorkflowManifest = {
      workers: {
        testWorker: { provider: 'openai', model: 'gpt-4' },
      },
      nodes: {
        testNode: {
          description: 'A test node',
          steps: [],
        },
      },
    };
  
    // Helper to convert string to Uint8Array for the mock fs API
    const stringToUint8Array = (str: string) => Buffer.from(str, 'utf8');
  
    beforeEach(() => {
      vi.clearAllMocks();
      // Reset the singleton instance for test isolation
      WorkflowService['instance'] = undefined;
      service = WorkflowService.getInstance();
    });
  
    it('should throw ManifestNotFoundError if the file does not exist', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('File not found'));
  
      // Act & Assert
      await expect(service.loadWorkflow(workspaceRoot)).rejects.toThrow(
        'Workflow manifest not found at: /test/workspace/.vision/workflows.json'
      );
    });
  
    it('should throw InvalidJsonError if the file contains malformed JSON', async () => {
      // Arrange
      const malformedJson = '{ "workers": { "test": "abc" },,, }'; // Extra commas
      mockReadFile.mockResolvedValue(stringToUint8Array(malformedJson));
  
      // Act & Assert
      await expect(service.loadWorkflow(workspaceRoot)).rejects.toThrow(
        'The workflows.json file contains invalid JSON. Please check its syntax.'
      );
    });
  
    it('should throw SchemaValidationError if the JSON is valid but structurally incorrect', async () => {
      // Arrange
      const invalidSchema = {
        // Missing 'nodes' property
        workers: { testWorker: { provider: 'openai', model: 'gpt-4' } },
      };
      mockReadFile.mockResolvedValue(stringToUint8Array(JSON.stringify(invalidSchema)));
  
      // Act & Assert
      await expect(service.loadWorkflow(workspaceRoot)).rejects.toThrow(
        'The workflows.json file does not conform to the required schema.'
      );
    });
  
    it('should successfully parse and return a valid manifest object', async () => {
      // Arrange
      const manifestString = JSON.stringify(validManifest, null, 2);
      mockReadFile.mockResolvedValue(stringToUint8Array(manifestString));
  
      // Act
      const result = await service.loadWorkflow(workspaceRoot);
  
      // Assert
      expect(result).toEqual(validManifest);
      expect(mockReadFile).toHaveBeenCalledWith({
        fsPath: '/test/workspace/.vision/workflows.json',
      });
    });
  });