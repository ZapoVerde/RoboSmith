/**
 * @file webview-ui/src/components/MissionControlPanel.logic.spec.ts
 * @stamp 2025-11-30T08:40:00.000Z
 * @test-target webview-ui/src/components/MissionControlPanel.logic.ts
 * @description Verifies the contract of the headless `MissionControlPanel.logic` module, ensuring it correctly creates and dispatches the `blockSelected` event payload.
 * @criticality Not Critical (UI Interaction Logic).
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 *     state_ownership: none
 */

import { describe, it, expect, vi } from 'vitest';
import { handleBlockClick } from './MissionControlPanel.logic';

describe('MissionControlPanel Logic', () => {
  it('should dispatch "blockSelected" with the correct blockId payload', () => {
    // Arrange
    const mockDispatch = vi.fn();
    const blockId = 'NodeA__BlockB';

    // Act
    handleBlockClick(mockDispatch, blockId);

    // Assert
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith('blockSelected', { blockId });
  });
});