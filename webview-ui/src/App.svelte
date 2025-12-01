<!--
 * @file webview-ui/src/App.svelte
 * @stamp 2025-12-01T07:45:00.000Z
 * @architectural-role UI Component
 * @description The root UI component. Uses standard Svelte syntax and nested rendering to ensure stability and testability.
 * @core-principles
 * 1. IS the top-level container for all webview UI.
 * 2. OWNS the state that determines which primary view is visible.
 * 3. DELEGATES all complex UI to child components.
 *
 * @contract
 *   assertions:
 *     purity: mutates          # Manages view state.
 *     external_io: none        # Receives messages via window listener.
 *     state_ownership: ['currentView', 'workflowState', 'integrationTask', 'aiCallLogs']
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import type { 
    ExtensionMessage, 
    WorkflowViewState, 
    TaskReadyForIntegrationMessage, 
    AiCallLog 
  } from '../../packages/client/src/shared/types';
  
  import MissionControlPanel from './components/MissionControlPanel.svelte';
  import IntegrationPanel from './components/IntegrationPanel.svelte';
  import AiCallInspector from './components/AiCallInspector.svelte';
  
  type View = 'Lobby' | 'MissionControl' | 'Integration' | 'Inspector';

  // State (Svelte 5 Runes)
  let currentView = $state<View>('Lobby');
  let workflowState = $state<WorkflowViewState | null>(null);
  let integrationTask = $state<TaskReadyForIntegrationMessage['payload'] | null>(null);
  let aiCallLogs = $state<AiCallLog[]>([]);

  onMount(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data as ExtensionMessage;

      switch (message.command) {
        case 'workflowStateUpdate':
          workflowState = message.payload;
          currentView = 'MissionControl';
          break;

        case 'taskReadyForIntegration':
          integrationTask = message.payload;
          currentView = 'Integration';
          break;

        case 'showAiCallInspector':
          aiCallLogs = message.payload.logs;
          currentView = 'Inspector';
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  });
</script>

<main>
  <!-- Nested logic ensures mutual exclusivity in the DOM -->
  {#if currentView === 'MissionControl'}
    {#if workflowState}
      <MissionControlPanel state={workflowState} />
    {/if}
  {:else if currentView === 'Integration'}
    {#if integrationTask}
      <IntegrationPanel task={integrationTask} />
    {/if}
  {:else if currentView === 'Inspector'}
    <AiCallInspector logs={aiCallLogs} />
  {:else}
    <div class="lobby" data-testid="lobby-view">
      <h1>🤖 RoboSmith</h1>
      <p>Waiting for a workflow to start...</p>
      <p class="hint">Use the Status Bar Navigator to begin.</p>
    </div>
  {/if}
</main>

<style>
  main {
    height: 100vh;
    overflow: hidden;
    background-color: var(--vscode-editor-background);
    color: var(--vscode-foreground);
  }

  .lobby {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    opacity: 0.7;
  }

  .hint {
    font-size: 0.9rem;
    font-style: italic;
  }
</style>