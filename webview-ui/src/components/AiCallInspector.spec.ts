/**
 * @file webview-ui/src/components/AiCallInspector.spec.ts
 * @stamp 2025-11-30T21:00:00.000Z
 * @test-target webview-ui/src/components/AiCallInspector.svelte
 * @description Verifies the rendering and interaction logic of the Inspector UI.
 * Confirms that logs are listed, details are shown on selection, and the "Re-run"
 * action delegates the *modified* state to the logic module.
 * @criticality Not Critical (UI Rendering).
 * @testing-layer Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen} from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import AiCallInspector from './AiCallInspector.svelte';
import type { AiCallLog } from '../../../packages/client/src/shared/types';

// --- Mocks ---

// 1. Logic Module Mock
const { mockHandleRerun } = vi.hoisted(() => ({
  mockHandleRerun: vi.fn(),
}));

vi.mock('./AiCallInspector.logic', () => ({
  handleRerun: mockHandleRerun,
}));

// 2. VS Code API Mock
vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: vi.fn(),
}));

// --- Test Data ---

const MOCK_LOGS: AiCallLog[] = [
  {
    callId: 'call-1',
    timestamp: '2023-01-01T12:00:00Z',
    sessionId: 'session-A',
    stepName: 'Step 1',
    request: {
      provider: 'openai',
      model: 'gpt-4o',
      prompt: 'Original Prompt',
      temperature: 0.5,
    },
    response: {
      content: 'Response 1',
      durationMs: 100,
      tokensUsed: {},
    },
  },
  {
    callId: 'call-2',
    timestamp: '2023-01-01T12:05:00Z',
    sessionId: 'session-A',
    stepName: 'Step 2 (Failed)',
    request: {
      provider: 'openai',
      model: 'gpt-4o',
      prompt: 'Prompt 2',
    },
    response: { content: '', durationMs: 50, tokensUsed: {} },
    error: 'Rate Limit',
  },
];

describe('AiCallInspector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the list of logs in the sidebar', () => {
    render(AiCallInspector, { props: { logs: MOCK_LOGS } });

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2 (Failed)')).toBeInTheDocument();
    expect(screen.getByText('ERR')).toBeInTheDocument(); // Status badge
  });

  it('should show the empty state by default', () => {
    render(AiCallInspector, { props: { logs: MOCK_LOGS } });
    expect(screen.getByText(/Select a log entry/)).toBeInTheDocument();
  });

  it('should display details when a log is selected', async () => {
    const user = userEvent.setup();
    render(AiCallInspector, { props: { logs: MOCK_LOGS } });

    // Click the first log item
    await user.click(screen.getByText('Step 1'));

    // Check Detail View
    expect(screen.getByDisplayValue('Original Prompt')).toBeInTheDocument(); // Textarea
    expect(screen.getByDisplayValue('gpt-4o')).toBeInTheDocument(); // Input
    expect(screen.getByText('Response 1')).toBeInTheDocument(); // Response view
  });

  it('should call handleRerun with MODIFIED data when button is clicked', async () => {
    const user = userEvent.setup();
    render(AiCallInspector, { props: { logs: MOCK_LOGS } });

    // 1. Select Log
    await user.click(screen.getByText('Step 1'));

    // 2. Modify Prompt
    const promptInput = screen.getByLabelText('Prompt:');
    await user.clear(promptInput);
    await user.type(promptInput, 'Modified Prompt');

    // 3. Modify Temperature
    const tempInput = screen.getByLabelText('Temp:');
    await user.clear(tempInput);
    await user.type(tempInput, '0.9');

    // 4. Click Re-run
    await user.click(screen.getByRole('button', { name: /Re-run & Compare/ }));

    // Assert logic call
    expect(mockHandleRerun).toHaveBeenCalledTimes(1);
    const [_, modifiedRequest] = mockHandleRerun.mock.calls[0]; // [dispatch, request]

    expect(modifiedRequest).toEqual({
      provider: 'openai',
      model: 'gpt-4o',
      prompt: 'Modified Prompt', // Changed
      temperature: 0.9,          // Changed
    });
  });
});