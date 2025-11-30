/**
 * @file webview-ui/src/App.spec.ts
 * @stamp 2025-11-30T21:40:00.000Z
 * @test-target webview-ui/src/App.svelte
 * @description Verifies the view-switching logic of the root App component, including the new AI Call Inspector view.
 * @criticality Not Critical (UI Composition).
 * @testing-layer Integration
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/svelte';
import App from './App.svelte';
import type { 
  WorkflowViewState, 
  TaskReadyForIntegrationMessage, 
  AiCallLog 
} from '../../packages/client/src/shared/types';

// Mock child components to keep test focused on routing.
// We use a standard function to satisfy Svelte runtime requirements for mocked components.
vi.mock('./components/MissionControlPanel.svelte', () => ({
  default: function() { return {}; }
}));
vi.mock('./components/IntegrationPanel.svelte', () => ({
  default: function() { return {}; }
}));
vi.mock('./components/AiCallInspector.svelte', () => ({
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

    await act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'workflowStateUpdate',
          payload: mockState,
        },
      }));
    });

    // Lobby should disappear
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
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'taskReadyForIntegration',
          payload: mockTask,
        },
      }));
    });

    expect(screen.queryByText('Waiting for a workflow to start...')).not.toBeInTheDocument();
  });

  it('should switch to AiCallInspector on showAiCallInspector', async () => {
    render(App);

    const mockLogs: AiCallLog[] = [];

    await act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'showAiCallInspector',
          payload: { logs: mockLogs },
        },
      }));
    });

    expect(screen.queryByText('Waiting for a workflow to start...')).not.toBeInTheDocument();
  });
});