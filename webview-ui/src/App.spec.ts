/**
 * @file webview-ui/src/App.spec.ts
 * @stamp 2025-11-30T09:10:00.000Z
 * @test-target webview-ui/src/App.svelte
 * @description Verifies the view-switching logic of the root App component.
 * @criticality Not Critical (UI Composition).
 * @testing-layer Integration
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/svelte';
import App from './App.svelte';
import type { WorkflowViewState, TaskReadyForIntegrationMessage } from '../../packages/client/src/shared/types';

// Mock child components to keep test focused on routing.
// FIX: We use a standard function instead of an ES6 class or arrow function.
// This allows the mock to be invoked with OR without 'new', satisfying both
// Svelte 4 (class-based) and Svelte 5 (function-based) runtimes, preventing
// "Class constructor default cannot be invoked without 'new'" errors.
vi.mock('./components/MissionControlPanel.svelte', () => ({
  default: function() { return {}; }
}));
vi.mock('./components/IntegrationPanel.svelte', () => ({
  default: function() { return {}; }
}));

describe('App Controller', () => {
  it('should render Lobby by default', () => {
    render(App);
    expect(screen.getByText('🤖 RoboSmith')).toBeInTheDocument();
  });

  it('should switch to MissionControl on workflowStateUpdate', async () => {
    render(App);

    const mockState: WorkflowViewState = {
      graph: { nodeId: 'N', blocks: {}, transitions: [] },
      statuses: {},
      lastTransition: null,
      executionLog: {},
      allWorkflowsStatus: []
    };

    // Use dispatchEvent directly to ensure synchronous execution within act()
    await act(() => {
      const event = new MessageEvent('message', {
        data: {
          command: 'workflowStateUpdate',
          payload: mockState,
        },
      });
      window.dispatchEvent(event);
    });

    // Since we mocked the component, we can check if the lobby is gone
    expect(screen.queryByText('Waiting for a workflow to start...')).not.toBeInTheDocument();
  });

  it('should switch to Integration on taskReadyForIntegration', async () => {
    render(App);

    const mockTask: TaskReadyForIntegrationMessage['payload'] = {
      sessionId: 's1',
      branchName: 'b1',
      commitMessage: 'msg',
      changedFiles: []
    };

    await act(() => {
      const event = new MessageEvent('message', {
        data: {
          command: 'taskReadyForIntegration',
          payload: mockTask,
        },
      });
      window.dispatchEvent(event);
    });

    expect(screen.queryByText('Waiting for a workflow to start...')).not.toBeInTheDocument();
  });
});