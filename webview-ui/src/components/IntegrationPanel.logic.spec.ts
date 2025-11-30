/**
 * @file webview-ui/src/components/IntegrationPanel.logic.spec.ts
 * @stamp 2025-11-30T08:40:00.000Z
 * @test-target webview-ui/src/components/IntegrationPanel.logic.ts
 * @description Verifies the contract of the headless `IntegrationPanel.logic` module, ensuring it correctly creates and dispatches all final decision event payloads.
 * @criticality Not Critical (UI Interaction Logic).
 * @testing-layer Unit
 */

import { describe, it, expect, vi } from 'vitest';
import { handleAccept, handleReject, handleHold, handleOpenTerminal } from './IntegrationPanel.logic';

describe('IntegrationPanel Logic', () => {
  const sessionId = 'test-session-id';

  it('should dispatch acceptAndMerge', () => {
    const dispatch = vi.fn();
    handleAccept(dispatch, sessionId);
    expect(dispatch).toHaveBeenCalledWith('acceptAndMerge', { sessionId });
  });

  it('should dispatch rejectAndDiscard', () => {
    const dispatch = vi.fn();
    handleReject(dispatch, sessionId);
    expect(dispatch).toHaveBeenCalledWith('rejectAndDiscard', { sessionId });
  });

  it('should dispatch finishAndHold', () => {
    const dispatch = vi.fn();
    handleHold(dispatch, sessionId);
    expect(dispatch).toHaveBeenCalledWith('finishAndHold', { sessionId });
  });

  it('should dispatch openTerminalInWorktree', () => {
    const dispatch = vi.fn();
    handleOpenTerminal(dispatch, sessionId);
    expect(dispatch).toHaveBeenCalledWith('openTerminalInWorktree', { sessionId });
  });
});