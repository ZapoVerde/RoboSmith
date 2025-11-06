/**
 * @file packages/client/src/lib/workflow/WorkflowService.spec.ts
 * @test-target packages/client/src/lib/workflow/WorkflowService.ts
 * @description Verifies the contract of the WorkflowService, ensuring it correctly locates, reads, and validates the `workflows.json` manifest, and that it throws specific, user-friendly errors for all anticipated failure modes.
 * @criticality The test target is CRITICAL as it is the loader for the Orchestrator's instructions.
 * @testing-layer Unit
 */

// --- HOISTING-SAFE MOCKS ---
vi.mock('vscode', () => {
  const mockReadFile = vi.fn();
  const mockOutputChannel = { appendLine: vi.fn() };
  const mockWindow = { createOutputChannel: vi.fn().mockReturnValue(mockOutputChannel) };

  return {
    workspace: {
      fs: {
        readFile: mockReadFile,
      },
    },
    window: mockWindow,
    Uri: {
      file: (path: string) => ({ fsPath: path }),
    },
    default: {},
    __mockReadFile: mockReadFile,
  };
});

// --- IMPORTS ---
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WorkflowService,
  ManifestNotFoundError,
  InvalidJsonError,
  SchemaValidationError,
} from './WorkflowService';
import * as vscode from 'vscode';
import type { Mock } from 'vitest';
import type { WorkflowManifest } from '../../shared/types';

// --- MOCK ACCESSOR ---
const mockReadFile = (vscode as unknown as { __mockReadFile: Mock }).__mockReadFile;

// --- TEST SUITE ---
describe('WorkflowService', () => {
  let service: WorkflowService;
  const workspaceRoot = '/test/workspace';

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
    await expect(service.loadWorkflow(workspaceRoot)).rejects.toThrow(ManifestNotFoundError);
    await expect(service.loadWorkflow(workspaceRoot)).rejects.toThrow(
      'Workflow manifest not found at: /test/workspace/.vision/workflows.json. Ensure the .vision/workflows.json file exists.'
    );
  });

  it('should throw InvalidJsonError if the file contains malformed JSON', async () => {
    // Arrange
    const malformedJson = '{ "nodes": {},,, }'; // Invalid due to extra commas
    mockReadFile.mockResolvedValue(stringToUint8Array(malformedJson));

    // Act & Assert
    await expect(service.loadWorkflow(workspaceRoot)).rejects.toThrow(InvalidJsonError);
    await expect(service.loadWorkflow(workspaceRoot)).rejects.toThrow(
      'The workflows.json file contains invalid JSON. Please check its syntax.'
    );
  });

  it('should throw SchemaValidationError if the JSON is valid but structurally incorrect', async () => {
    // Arrange
    // An array is valid JSON, but not a valid manifest structure (which must be an object).
    const invalidSchema = "[]";
    mockReadFile.mockResolvedValue(stringToUint8Array(invalidSchema));

    // Act & Assert
    await expect(service.loadWorkflow(workspaceRoot)).rejects.toThrow(SchemaValidationError);
    await expect(service.loadWorkflow(workspaceRoot)).rejects.toThrow(
      'The workflows.json file does not conform to the required schema. It must be a dictionary of NodeDefinition objects.'
    );
  });

  it('should successfully parse and return a valid manifest object', async () => {
    // Arrange
    const validManifest: WorkflowManifest = {
      'Node:Test': {
        entry_block: 'Node:Test__Block:Start',
        context_inheritance: true,
        static_memory: {},
        blocks: {
          'Block:Start': {
            worker: 'Worker:Test',
            payload_merge_strategy: [],
            transitions: [],
          },
        },
      },
    };
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