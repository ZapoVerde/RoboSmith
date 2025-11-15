/**
 * @file webview-ui/src/components/InterventionPanel.logic.spec.ts
 * @stamp {"timestamp":"2025-11-09T02:27:00.000Z"}
 * @test-target webview-ui/src/components/InterventionPanel.logic.ts
 * @description Verifies the contract of the headless `InterventionPanel.logic` module, ensuring it correctly creates and dispatches the `resumeWorkflow` and `retryBlock` event payloads.
 * @criticality The test target is CRITICAL as it contains core business logic for controlling the workflow engine.
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Mocks the global `acquireVsCodeApi` function.
 *     - Verifies correct message payload for `dispatchResumeWorkflow`.
 *     - Verifies correct message payload for `dispatchRetryBlock`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We only import the *types* here. The actual implementation will be imported dynamically.
import type {
  dispatchResumeWorkflow as dispatchResumeWorkflowType,
  dispatchRetryBlock as dispatchRetryBlockType,
} from './InterventionPanel.logic';

// 1. Define the mock function that will be returned by the global stub.
const mockPostMessage = vi.fn();

// 2. Stub the global function. This MUST be done before the module under test is imported.
vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: mockPostMessage,
}));

describe('InterventionPanel.logic', () => {
  // These variables will hold the dynamically imported functions for each test.
  let dispatchResumeWorkflow: typeof dispatchResumeWorkflowType;
  let dispatchRetryBlock: typeof dispatchRetryBlockType;

  // This hook runs before each test.
  beforeEach(async () => {
    // Reset any previous mocks to ensure test isolation.
    vi.clearAllMocks();
    // CRITICAL STEP: This tells Vitest to discard its cache of the logic module.
    // The next time we import it, it will be re-executed from scratch.
    vi.resetModules();

    // DYNAMICALLY IMPORT the module. This happens *after* vi.stubGlobal is in place
    // and after the module cache is cleared, guaranteeing our mock is used.
    const logicModule = await import('./InterventionPanel.logic');
    dispatchResumeWorkflow = logicModule.dispatchResumeWorkflow;
    dispatchRetryBlock = logicModule.dispatchRetryBlock;
  });

  it('should dispatch the correct message for dispatchResumeWorkflow', () => {
    // Arrange
    const sessionId = 'session-123';
    const augmentedPrompt = 'Please focus on the authentication flow.';

    // Act
    dispatchResumeWorkflow(sessionId, augmentedPrompt);

    // Assert
    expect(mockPostMessage).toHaveBeenCalledOnce();
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'resumeWorkflow',
      payload: {
        sessionId: 'session-123',
        augmentedPrompt: 'Please focus on the authentication flow.',
      },
    });
  });

  it('should dispatch the correct message for dispatchRetryBlock', () => {
    // Arrange
    const sessionId = 'session-456';
    const augmentedPrompt =
      'The previous attempt failed. Retry but with JSON output.';

    // Act
    dispatchRetryBlock(sessionId, augmentedPrompt);

    // Assert
    expect(mockPostMessage).toHaveBeenCalledOnce();
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'retryBlock',
      payload: {
        sessionId: 'session-456',
        augmentedPrompt:
          'The previous attempt failed. Retry but with JSON output.',
      },
    });
  });

  it('should pass an empty string for augmentedPrompt if provided', () => {
    // Arrange
    const sessionId = 'session-abc';

    // Act
    dispatchRetryBlock(sessionId, ''); // Pass an empty string

    // Assert
    expect(mockPostMessage).toHaveBeenCalledOnce();
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'retryBlock',
      payload: {
        sessionId: 'session-abc',
        augmentedPrompt: '',
      },
    });
  });
  it('should handle dispatchResumeWorkflow when augmentedPrompt is not provided', () => {
    // Arrange
    const sessionId = 'session-789';

    // Act
    dispatchResumeWorkflow(sessionId, undefined); // Explicitly pass undefined

    // Assert
    expect(mockPostMessage).toHaveBeenCalledOnce();
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'resumeWorkflow',
      payload: {
        sessionId: 'session-789',
        augmentedPrompt: undefined,
      },
    });
  });

});