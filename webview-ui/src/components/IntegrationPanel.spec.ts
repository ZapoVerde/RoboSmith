/**
 * @file webview-ui/src/components/IntegrationPanel.spec.ts
 * @stamp 2025-11-30T08:40:00.000Z
 * @test-target webview-ui/src/components/IntegrationPanel.svelte
 * @description Verifies the rendering contract of the IntegrationPanel, ensuring it correctly displays task details and that its buttons are wired to the correct logic handlers.
 * @criticality Not Critical (UI Rendering).
 * @testing-layer Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import IntegrationPanel from './IntegrationPanel.svelte';
import type { TaskReadyForIntegrationMessage } from '../../../packages/client/src/shared/types';

// Mock global API
const mockPostMessage = vi.fn();
vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: mockPostMessage,
}));

// Mock logic module
vi.mock('./IntegrationPanel.logic', () => ({
  handleAccept: vi.fn((dispatch, id) => dispatch('acceptAndMerge', { sessionId: id })),
  handleReject: vi.fn((dispatch, id) => dispatch('rejectAndDiscard', { sessionId: id })),
  handleHold: vi.fn((dispatch, id) => dispatch('finishAndHold', { sessionId: id })),
  handleOpenTerminal: vi.fn((dispatch, id) => dispatch('openTerminalInWorktree', { sessionId: id })),
}));

describe('IntegrationPanel', () => {
  const mockTask: TaskReadyForIntegrationMessage['payload'] = {
    sessionId: 's1',
    branchName: 'feat/test',
    commitMessage: 'Implemented feature',
    changedFiles: ['src/a.ts', 'src/b.ts'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render task details', () => {
    render(IntegrationPanel, { props: { task: mockTask } });

    expect(screen.getByText('feat/test')).toBeInTheDocument();
    expect(screen.getByText('Implemented feature')).toBeInTheDocument();
    expect(screen.getByText('src/a.ts')).toBeInTheDocument();
  });

  it('should dispatch openTerminalInWorktree when button is clicked', async () => {
    const user = userEvent.setup();
    render(IntegrationPanel, { props: { task: mockTask } });

    await user.click(screen.getByText(/Open Terminal/));

    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'openTerminalInWorktree',
      payload: { sessionId: 's1' },
    });
  });

  it('should dispatch acceptAndMerge when Accept is clicked', async () => {
    const user = userEvent.setup();
    render(IntegrationPanel, { props: { task: mockTask } });

    await user.click(screen.getByText(/Accept/));

    expect(mockPostMessage).toHaveBeenCalledWith({
      command: 'acceptAndMerge',
      payload: { sessionId: 's1' },
    });
  });
});