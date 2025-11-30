<!--
 * @file webview-ui/src/components/MissionControlPanel.svelte
 * @stamp 2025-11-30T08:40:00.000Z
 * @architectural-role UI Component
 * @description Provides the UI for the "living Visio diagram." It is a purely presentational component that renders the `WorkflowViewState` and delegates all business logic to its headless `.logic.ts` module.
 * @core-principles
 * 1. IS a purely presentational component.
 * 2. OWNS the DOM structure for the workflow graph.
 * 3. DELEGATES all business logic to the imported logic module.
 *
 * @api-declaration
 *   - PROPS:
 *     - export let state: WorkflowViewState;
 *   - EVENTS:
 *     - on:blockSelected (payload: { blockId: string })
 *
 * @contract
 *   assertions:
 *     purity: mutates          # Renders DOM based on props.
 *     external_io: none
 *     state_ownership: ['local_selection'] # Tracks visual selection state.
-->

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { WorkflowViewState } from '../../../packages/client/src/shared/types';
    import { handleBlockClick } from './MissionControlPanel.logic';
  
    export let state: WorkflowViewState;
  
    const dispatch = createEventDispatcher();
    let selectedBlockId: string | null = null;
  
    function onClick(blockId: string) {
      selectedBlockId = blockId;
      handleBlockClick(dispatch, blockId);
    }
  
    // Helper to determine CSS classes for a block based on state
    function getBlockClass(blockId: string, status: string): string {
      const base = 'block';
      const statusClass = status ? `status-${status}` : 'status-pending';
      const selectedClass = blockId === selectedBlockId ? 'selected' : '';
      return `${base} ${statusClass} ${selectedClass}`;
    }
  
    // Derive simple graph structure for rendering since we lack a full graph lib
    $: blocks = Object.entries(state.graph.blocks).map(([id, def]) => ({
      id,
      name: def.name,
      status: state.statuses[id] || 'pending',
    }));
  </script>
  
  <div class="mission-control">
    <div class="status-ticker">
      {#each state.allWorkflowsStatus as wf}
        <div class="ticker-item {wf.queue.toLowerCase()}">
          <span class="ticker-icon">
            {#if wf.health === 'GREEN'}🟢{:else if wf.health === 'AMBER'}🟡{:else}🔴{/if}
          </span>
          <span class="ticker-name">{wf.name}</span>
        </div>
      {/each}
    </div>
  
    <div class="graph-container">
      <div class="flowchart">
        {#each blocks as block (block.id)}
          <button
            type="button"
            class={getBlockClass(block.id, block.status)}
            on:click={() => onClick(block.id)}
            aria-label="Select block {block.name}"
          >
            <div class="block-icon">
              {#if block.status === 'complete'}✅
              {:else if block.status === 'active'}▶️
              {:else if block.status === 'failed'}❌
              {:else}⏳{/if}
            </div>
            <div class="block-name">{block.name}</div>
          </button>
          <!-- Simple arrow visualization between blocks -->
          {#if block.id !== blocks[blocks.length - 1].id}
             <div class="arrow">⬇</div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
  
  <style>
    .mission-control {
      display: flex;
      flex-direction: column;
      height: 100%;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
  
    .status-ticker {
      padding: 0.5rem;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 1rem;
      overflow-x: auto;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
    }
  
    .ticker-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8rem;
      white-space: nowrap;
    }
  
    .graph-container {
      flex: 1;
      overflow: auto;
      padding: 2rem;
      display: flex;
      justify-content: center;
    }
  
    .flowchart {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      max-width: 400px;
    }
  
    .block {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      width: 100%;
      border: 2px solid var(--vscode-widget-border);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    }
  
    .block:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
  
    .block.selected {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 4px var(--vscode-focusBorder);
    }
  
    .block.status-active {
      border-color: var(--vscode-charts-blue);
      background-color: var(--vscode-editor-selectionBackground);
    }
  
    .block.status-complete {
      border-color: var(--vscode-charts-green);
    }
  
    .block.status-failed {
      border-color: var(--vscode-charts-red);
    }
  
    .block-icon {
      font-size: 1.2rem;
    }
  
    .block-name {
      font-weight: bold;
    }
  
    .arrow {
      font-size: 1.5rem;
      color: var(--vscode-descriptionForeground);
      opacity: 0.5;
    }
  </style>