// ----- webview-ui/src/components/InterventionPanel.spec.ts -----
/**
 * @file webview-ui/src/components/InterventionPanel.spec.ts
 * @stamp S-20251129T132000Z-C-FIX-HOISTING
 * @test-target webview-ui/src/components/InterventionPanel.svelte
 * @description Verifies the rendering contract of the InterventionPanel.
 * @criticality The test target is CRITICAL.
 * @testing-layer Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import InterventionPanel from './InterventionPanel.svelte';
import type { ContextSegment } from '../../../packages/client/src/shared/types';

// --- Mock Dependencies ---

// 1. Use vi.hoisted to create the mocks BEFORE the module mock is evaluated
const { mockDispatchResumeWorkflow, mockDispatchRetryBlock } = vi.hoisted(() => {
  return {
    mockDispatchResumeWorkflow: vi.fn(),
    mockDispatchRetryBlock: vi.fn(),
  };
});

// 2. Mock the headless logic module using the hoisted mocks
vi.mock('./InterventionPanel.logic.ts', () => ({
  dispatchResumeWorkflow: mockDispatchResumeWorkflow,
  dispatchRetryBlock: mockDispatchRetryBlock,
}));

// 3. Mock the global VSCode API
const mockPostMessage = vi.fn();
vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: mockPostMessage,
}));

describe('InterventionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Test Case 1: Read-Only Mode Rendering ---
  it('should render only the chat history when not halted', () => {
    // Arrange
    const samplePayload: ContextSegment[] = [
      { id: '1', type: 'INPUT', content: 'This is the input.', timestamp: '' },
    ];
    render(InterventionPanel, {
      props: {
        isHalted: false,
        executionPayload: samplePayload,
        sessionId: 'test-session',
      },
    });

    // Assert
    expect(screen.getByText('This is the input.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Resume/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Abort/ })).toBeNull();
  });

  // --- Test Case 2: Interactive Mode Rendering ---
  it('should render the interactive controls when halted', () => {
    // Arrange
    render(InterventionPanel, { props: { isHalted: true, sessionId: 'test-session' } });

    // Assert
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abort/ })).toBeInTheDocument();
  });

  // --- Test Case 3: Button Click Handlers (with user input) ---
  it('should call the correct dispatch functions with guidance text when buttons are clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const sessionId = 'session-with-guidance';
    render(InterventionPanel, { props: { isHalted: true, sessionId } });

    const guidanceInput = screen.getByRole('textbox');
    const retryButton = screen.getByRole('button', { name: /Retry/ });
    const resumeButton = screen.getByRole('button', { name: /Resume/ });
    const abortButton = screen.getByRole('button', { name: /Abort/ });

    const guidanceText = 'This is my guidance.';
    await user.type(guidanceInput, guidanceText);

    // Act & Assert (Retry)
    await user.click(retryButton);
    expect(mockDispatchRetryBlock).toHaveBeenCalledWith(sessionId, guidanceText);

    // Act & Assert (Resume)
    await user.click(resumeButton);
    expect(mockDispatchResumeWorkflow).toHaveBeenCalledWith(sessionId, guidanceText);

    // Act & Assert (Abort)
    await user.click(abortButton);
    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'rejectAndDiscard',
      payload: { sessionId },
    });
  });

  // --- Supplementary Test: Button Clicks (without user input) --- 
  it('should call dispatch functions with an empty string for guidance if none is provided', async () => {
    // Arrange
    const user = userEvent.setup();
    const sessionId = 'session-no-guidance';
    render(InterventionPanel, { props: { isHalted: true, sessionId } });

    const retryButton = screen.getByRole('button', { name: /Retry/ });
    const resumeButton = screen.getByRole('button', { name: /Resume/ });

    // Act & Assert (Retry)
    await user.click(retryButton);
    expect(mockDispatchRetryBlock).toHaveBeenCalledWith(sessionId, '');

    // Act & Assert (Resume)
    await user.click(resumeButton);
    expect(mockDispatchResumeWorkflow).toHaveBeenCalledWith(sessionId, '');
  });
});