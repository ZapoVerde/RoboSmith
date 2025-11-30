<!--
 * @file webview-ui/src/App.svelte
 * @stamp 2025-11-30T21:40:00.000Z
 * @architectural-role UI Component
 * @description The root UI component for the webview. It acts as a view controller, listening for messages from the extension host and conditionally rendering the correct primary view.
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
  
  // Possible views
  type View = 'Lobby' | 'MissionControl' | 'Integration' | 'Inspector';

  let currentView: View = 'Lobby';
  
  // State for Views
  let workflowState: WorkflowViewState | null = null;
  let integrationTask: TaskReadyForIntegrationMessage['payload'] | null = null;
  let aiCallLogs: AiCallLog[] = [];

  onMount(() => {
    window.addEventListener('message', (event) => {
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
          
        // Future: Handle 'apiKeyListUpdate' for Settings view
      }
    });
  });
</script>

<main>
  {#if currentView === 'MissionControl' && workflowState}
    <MissionControlPanel state={workflowState} />
  {:else if currentView === 'Integration' && integrationTask}
    <IntegrationPanel task={integrationTask} />
  {:else if currentView === 'Inspector'}
    <AiCallInspector logs={aiCallLogs} />
  {:else}
    <div class="lobby">
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