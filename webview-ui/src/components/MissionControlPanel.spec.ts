/**
 * @file webview-ui/src/components/MissionControlPanel.spec.ts
 * @stamp 2025-11-30T08:50:00.000Z
 * @test-target webview-ui/src/components/MissionControlPanel.svelte
 * @description Verifies the rendering contract of the MissionControlPanel, ensuring it correctly visualizes the graph and applies status styles based on the input `state` prop.
 * @criticality Not Critical (UI Rendering).
 * @testing-layer Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import MissionControlPanel from './MissionControlPanel.svelte';
import type { WorkflowViewState } from '../../../packages/client/src/shared/types';

// Mock logic module
vi.mock('./MissionControlPanel.logic', () => ({
  handleBlockClick: vi.fn(),
}));

import { handleBlockClick } from './MissionControlPanel.logic';

const mockState: WorkflowViewState = {
  graph: {
    nodeId: 'TestNode',
    blocks: {
      'TestNode__Step1': { name: 'Step 1' },
      'TestNode__Step2': { name: 'Step 2' },
    },
    transitions: [],
  },
  statuses: {
    'TestNode__Step1': 'complete',
    'TestNode__Step2': 'active',
  },
  lastTransition: null,
  executionLog: {},
  allWorkflowsStatus: [],
};

describe('MissionControlPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the blocks defined in the graph', () => {
    render(MissionControlPanel, { props: { state: mockState } });

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
  });

  it('should apply correct status classes', () => {
    render(MissionControlPanel, { props: { state: mockState } });

    const step1 = screen.getByText('Step 1').closest('button');
    const step2 = screen.getByText('Step 2').closest('button');

    expect(step1?.classList.contains('status-complete')).toBe(true);
    expect(step2?.classList.contains('status-active')).toBe(true);
  });

  it('should call handleBlockClick when a block is clicked', async () => {
    const user = userEvent.setup();
    render(MissionControlPanel, { props: { state: mockState } });

    await user.click(screen.getByText('Step 1'));

    expect(handleBlockClick).toHaveBeenCalledWith(expect.anything(), 'TestNode__Step1');
  });
});