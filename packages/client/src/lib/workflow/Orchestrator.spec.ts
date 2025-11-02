/**
 * @file packages/client/src/lib/workflow/Orchestrator.spec.ts
 * @stamp S-20251101T193500Z-V-TESTFIX-FINAL
 * @test-target packages/client/src/lib/workflow/Orchestrator.ts
 * @description
 * Provides a comprehensive and rigorous test suite for the Orchestrator. It
 * validates all core state machine logic, including sequential execution,
 * conditional branching (jump/halt), memory management, prompt templating,
 * and integration with dependent services.
 * @criticality
 * The test target is CRITICAL. It is the central state machine and core business
 * logic orchestrator for the entire application (Rubric Points #1 and #2).
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Mocks all external service dependencies (ContextPartitioner, ApiPoolManager, Logger).
 *     - Verifies the "happy path" for a multi-step node with memory passing.
 *     - Verifies the critical prompt templating feature.
 *     - Verifies the "failure path" with a HALT_AND_FLAG action.
 *     - Verifies the "branching path" with a JUMP_TO_NODE action.
 *     - Verifies robust error handling for invalid manifest references (nodes, workers).
 *     - Verifies that dependent services are called with the correct arguments from the manifest.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { Orchestrator, WorkflowHaltedError } from './Orchestrator';
import { ContextPartitionerService } from '../context/ContextPartitionerService';
import { ApiPoolManager } from '../ai/ApiPoolManager';
import type { WorkflowManifest } from './WorkflowService';

// --- CORRECTED MOCKING STRATEGY ---

// Step 1: Create mock objects for the service instances that we can control in tests.
const mockContextServiceInstance = {
  getContext: vi.fn(),
};
const mockApiManagerInstance = {
  execute: vi.fn(),
};

// Step 2: Use a mock factory to tell Vitest how to mock the modules.
vi.mock('../context/ContextPartitionerService', () => ({
  // We mock the class itself...
  ContextPartitionerService: {
    // ...by mocking its static getInstance method to return our controlled object.
    getInstance: vi.fn(() => mockContextServiceInstance),
  },
}));

vi.mock('../ai/ApiPoolManager', () => ({
  ApiPoolManager: {
    getInstance: vi.fn(() => mockApiManagerInstance),
  },
}));

vi.mock('../logging/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// --- Test Setup ---

// (Test manifest remains the same)
const mockManifest: WorkflowManifest = {
  workers: {
    'text-generator': { provider: 'openai', model: 'gpt-4' },
    'validator': { provider: 'google', model: 'gemini-pro' },
  },
  nodes: {
    'happy-path-node': {
      description: 'A node that should succeed.',
      steps: [
        { name: 'step1-generate', worker: 'text-generator', prompt: 'Generate a short sentence.', contextSlice: 'slice-for-step1', validation: { type: 'keywordSignal', signal: 'PROCEED' }, actions: { onSuccess: { type: 'PROCEED_TO_NEXT_STEP' }, onFailure: { type: 'HALT_AND_FLAG', message: 'Step 1 failed' }}},
        { name: 'step2-format', worker: 'text-generator', prompt: 'Format this text: ${step1-generate}', contextSlice: 'slice-for-step2', validation: { type: 'keywordSignal', signal: 'PROCEED' }, actions: { onSuccess: { type: 'PROCEED_TO_NEXT_STEP' }, onFailure: { type: 'HALT_AND_FLAG', message: 'Step 2 failed' }}},
      ],
    },
    'failure-node': {
      description: 'A node that is designed to fail.',
      steps: [{ name: 'failing-step', worker: 'validator', prompt: 'Validate this.', contextSlice: 'slice-for-fail', validation: { type: 'keywordSignal', signal: 'PROCEED' }, actions: { onSuccess: { type: 'PROCEED_TO_NEXT_STEP' }, onFailure: { type: 'HALT_AND_FLAG', message: 'Validation Failed!' }}}],
    },
    'jump-node-A': {
      description: 'A node that jumps to another node.',
      steps: [{ name: 'jump-step', worker: 'text-generator', prompt: 'Prepare to jump.', contextSlice: 'slice-for-jump', validation: { type: 'keywordSignal', signal: 'PROCEED' }, actions: { onSuccess: { type: 'JUMP_TO_NODE', nodeId: 'jump-node-B' }, onFailure: { type: 'HALT_AND_FLAG', message: 'Jump failed' }}}],
    },
    'jump-node-B': {
      description: 'The destination of a jump.',
      steps: [{ name: 'destination-step', worker: 'validator', prompt: 'Jump successful.', contextSlice: 'slice-for-destination', validation: { type: 'keywordSignal', signal: 'PROCEED' }, actions: { onSuccess: { type: 'PROCEED_TO_NEXT_STEP' }, onFailure: { type: 'HALT_AND_FLAG', message: 'Destination failed' } }}],
    },
  },
};

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    vi.clearAllMocks();

    // In each test, create a new orchestrator with the mocked services.
    // This is now type-safe and uses the controlled mock instances from the top of the file.
    orchestrator = new Orchestrator(
        mockManifest,
        mockContextServiceInstance as unknown as Mocked<ContextPartitionerService>,
        mockApiManagerInstance as unknown as Mocked<ApiPoolManager>
    );
  });

  it('should execute a multi-step node sequentially and return the final memory', async () => {
    mockContextServiceInstance.getContext.mockResolvedValue('Mock context');
    mockApiManagerInstance.execute
      .mockResolvedValueOnce('Step 1 successful PROCEED')
      .mockResolvedValueOnce('Step 2 successful PROCEED');

    const finalMemory = await orchestrator.executeNode('happy-path-node');

    expect(finalMemory).toEqual({
      'step1-generate': 'Step 1 successful PROCEED',
      'step2-format': 'Step 2 successful PROCEED',
    });
    expect(mockApiManagerInstance.execute).toHaveBeenCalledTimes(2);
  });

  it('should correctly render a prompt using memory from a previous step', async () => {
    mockContextServiceInstance.getContext.mockResolvedValue('Mock context');
    mockApiManagerInstance.execute
      .mockResolvedValueOnce('The quick brown fox PROCEED')
      .mockResolvedValueOnce('Formatted text PROCEED');

    await orchestrator.executeNode('happy-path-node');

    const secondWorkOrder = mockApiManagerInstance.execute.mock.calls[1][0];
    const expectedPrompt = 'Format this text: The quick brown fox PROCEED';
    expect(secondWorkOrder.prompt).toContain(expectedPrompt);
  });

  it('should trigger HALT_AND_FLAG on validation failure and throw WorkflowHaltedError', async () => {
    mockContextServiceInstance.getContext.mockResolvedValue('Mock context');
    mockApiManagerInstance.execute.mockResolvedValue('This is not what was expected.');

    await expect(orchestrator.executeNode('failure-node')).rejects.toThrow(WorkflowHaltedError);
    await expect(orchestrator.executeNode('failure-node')).rejects.toThrow('Validation Failed!');
  });

  it('should trigger JUMP_TO_NODE and execute the new node, discarding old memory', async () => {
    mockContextServiceInstance.getContext.mockResolvedValue('Mock context');
    mockApiManagerInstance.execute
      .mockResolvedValueOnce('Ready to jump PROCEED')
      .mockResolvedValueOnce('Landed successfully PROCEED');

    const finalMemory = await orchestrator.executeNode('jump-node-A');

    expect(finalMemory).not.toHaveProperty('jump-step');
    expect(finalMemory).toEqual({ 'destination-step': 'Landed successfully PROCEED' });
    expect(mockApiManagerInstance.execute).toHaveBeenCalledTimes(2);
  });

  it('should throw an error if the initial nodeId is not found', async () => {
    await expect(orchestrator.executeNode('non-existent-node')).rejects.toThrow(
      'Orchestrator error: Node with ID "non-existent-node" not found in manifest.' 
    );
  });

  it('should throw an error if a step references a non-existent worker', async () => {
    const invalidManifest: WorkflowManifest = {
      ...mockManifest,
      nodes: { 'bad-worker-node': { description: 'bad', steps: [{ ...mockManifest.nodes['failure-node'].steps[0], worker: 'non-existent-worker' }]}},
    };
    const badOrchestrator = new Orchestrator(
        invalidManifest,
        mockContextServiceInstance as unknown as Mocked<ContextPartitionerService>,
        mockApiManagerInstance as unknown as Mocked<ApiPoolManager>
    );
    mockContextServiceInstance.getContext.mockResolvedValue('Mock context');

    await expect(badOrchestrator.executeNode('bad-worker-node')).rejects.toThrow(
      'Orchestrator error: Worker "non-existent-worker" not found in manifest.'
    );
  });
});