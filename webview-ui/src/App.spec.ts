/**
 * @file webview-ui/src/App.spec.ts
 * @stamp 2025-12-01T07:45:00.000Z
 * @test-target webview-ui/src/App.svelte
 * @description Verifies view switching. Uses data-testid for reliability.
 * @criticality Not Critical (UI Composition).
 * @testing-layer Integration
 *
 * @contract
 *   assertions:
 *     purity: mutates          # Renders to JSDOM.
 *     external_io: none        # Simulates window events.
 *     state_ownership: none
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/svelte';
import App from './App.svelte';
import type { 
  WorkflowViewState, 
  TaskReadyForIntegrationMessage, 
  AiCallLog 
} from '../../packages/client/src/shared/types';

// Global Stub
const mockPostMessage = vi.fn();
vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: mockPostMessage,
  getState: () => ({}),
  setState: () => {}
}));

describe('App Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('should render Lobby by default', () => {
    render(App);
    expect(screen.getByTestId('lobby-view')).toBeInTheDocument();
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

    // Wait for Lobby to disappear
    await waitFor(() => {
      expect(screen.queryByTestId('lobby-view')).not.toBeInTheDocument();
    });
    
    // Check that MissionControl loaded (it renders a div with class .mission-control)
    const mc = document.querySelector('.mission-control');
    expect(mc).toBeInTheDocument();
  });

  it('should switch to Integration on taskReadyForIntegration', async () => {
    render(App);

    const mockTask: TaskReadyForIntegrationMessage['payload'] = {
      sessionId: 's1',
      branchName: 'b1',
      commitMessage: 'msg',
      changedFiles: ['file.ts']
    };

    await act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          command: 'taskReadyForIntegration',
          payload: mockTask,
        },
      }));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('lobby-view')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Task Complete')).toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.queryByTestId('lobby-view')).not.toBeInTheDocument();
    });

    expect(screen.getByText('History')).toBeInTheDocument();
  });
});