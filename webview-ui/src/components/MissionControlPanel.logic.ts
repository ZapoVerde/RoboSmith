/**
 * @file webview-ui/src/components/MissionControlPanel.logic.ts
 * @stamp 2025-11-30T08:40:00.000Z
 * @architectural-role Business Logic
 * @description Headless logic for the MissionControlPanel component. Isolates event dispatching for block selection from the Svelte UI.
 * @core-principles
 * 1. IS the single source of truth for the MissionControlPanel's interactive behavior.
 * 2. OWNS the logic for creating event payloads for user interactions.
 * 3. MUST be pure TypeScript with no dependencies on Svelte or the DOM.
 *
 * @api-declaration
 *   - export function handleBlockClick(dispatch: (event: 'blockSelected', payload: { blockId: string }) => void, blockId: string): void
 *
 * @contract
 *   assertions:
 *     purity: pure          # Functions are deterministic side-effect wrappers.
 *     external_io: none     # Delegates I/O via the dispatcher.
 *     state_ownership: none # Stateless module.
 */

/**
 * Handles the user clicking on a block in the workflow graph.
 * @param dispatch The Svelte event dispatcher.
 * @param blockId The ID of the block that was clicked.
 */
export function handleBlockClick(
    dispatch: (event: 'blockSelected', payload: { blockId: string }) => void,
    blockId: string
  ): void {
    dispatch('blockSelected', { blockId });
  }