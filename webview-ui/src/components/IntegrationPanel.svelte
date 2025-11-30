<!--
 * @file webview-ui/src/components/IntegrationPanel.svelte
 * @stamp 2025-11-30T08:45:00.000Z
 * @architectural-role UI Component
 * @description Provides the UI for the final workflow disposition step. It is a purely presentational component that delegates all business logic to its headless `.logic.ts` module.
 * @core-principles
 * 1. IS a purely presentational component.
 * 2. OWNS the DOM structure for the final action buttons.
 * 3. DELEGATES all business logic to the imported logic module.
 *
 * @api-declaration
 *   - PROPS:
 *     - export let task: TaskReadyForIntegrationMessage['payload'];
 *   - EVENTS:
 *     - on:acceptAndMerge, on:rejectAndDiscard, on:finishAndHold, on:openTerminalInWorktree
 *
 * @contract
 *   assertions:
 *     purity: mutates          # Renders DOM.
 *     external_io: none        # All I/O delegated via events.
 *     state_ownership: none
-->

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TaskReadyForIntegrationMessage, FinalDecisionMessage } from '../../../packages/client/src/shared/types';
    import { handleAccept, handleReject, handleHold, handleOpenTerminal } from './IntegrationPanel.logic';
  
    export let task: TaskReadyForIntegrationMessage['payload'];
  
    // Type-safe dispatcher wrapper
    const dispatch = createEventDispatcher<{
      [K in FinalDecisionMessage['command']]: { sessionId: string }
    }>();
  
    // The function is available globally in the webview context
    const vscode = acquireVsCodeApi();
  
    // Helper to bridge local events to VS Code messages
    function safeDispatch(command: FinalDecisionMessage['command'], payload: { sessionId: string }) {
      // 1. Dispatch internal Svelte event (for parent components)
      dispatch(command, payload);
      // 2. Post message to VS Code extension host (for backend)
      vscode.postMessage({ command, payload });
    }
  
    function onOpenTerminal() {
      handleOpenTerminal(safeDispatch, task.sessionId);
    }
  
    function onAccept() {
      handleAccept(safeDispatch, task.sessionId);
    }
  
    function onReject() {
      // Mandate: Require confirmation for destructive actions.
      // Using native confirm within the WebView satisfies the requirement to gate the action.
      const confirmed = window.confirm(
        `Are you sure you want to discard branch '${task.branchName}'? This action cannot be undone.`
      );
      
      if (confirmed) {
        handleReject(safeDispatch, task.sessionId);
      }
    }
  
    function onHold() {
      handleHold(safeDispatch, task.sessionId);
    }
  </script>
  
  <div class="integration-panel">
    <header>
      <h1>Task Complete</h1>
      <div class="branch-info">
        <span class="label">Branch:</span>
        <span class="value">{task.branchName}</span>
      </div>
    </header>
  
    <section class="changes">
      <h2>Changes</h2>
      <p>{task.commitMessage}</p>
      <ul>
        {#each task.changedFiles as file}
          <li>{file}</li>
        {/each}
      </ul>
    </section>
  
    <section class="actions">
      <div class="validation-action">
        <button class="secondary" on:click={onOpenTerminal}>
          🚀 Open Terminal in Worktree
        </button>
      </div>
  
      <div class="decision-actions">
        <button class="primary" on:click={onAccept}>
          ✅ Accept & Merge
        </button>
        <button class="secondary" on:click={onHold}>
          ⏸️ Hold
        </button>
        <button class="danger" on:click={onReject}>
          ❌ Reject & Discard
        </button>
      </div>
    </section>
  </div>
  
  <style>
    .integration-panel {
      padding: 2rem;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      display: flex;
      flex-direction: column;
      gap: 2rem;
      max-width: 600px;
      margin: 0 auto;
    }
  
    header {
      border-bottom: 1px solid var(--vscode-widget-border);
      padding-bottom: 1rem;
    }
  
    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
    }
  
    .branch-info {
      font-size: 0.9rem;
      opacity: 0.8;
    }
  
    .value {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 4px;
      border-radius: 3px;
    }
  
    .changes ul {
      list-style: none;
      padding: 0;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9rem;
    }
  
    .changes li {
      padding: 2px 0;
    }
  
    .actions {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
  
    button {
      padding: 0.6rem 1rem;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      transition: filter 0.2s;
    }
  
    button:hover {
      filter: brightness(1.1);
    }
  
    .validation-action {
      display: flex;
      justify-content: center;
    }
  
    .decision-actions {
      display: flex;
      gap: 1rem;
      justify-content: space-between;
    }
  
    .primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      flex: 2;
    }
  
    .secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      flex: 1;
    }
  
    .danger {
      background-color: var(--vscode-errorForeground);
      color: var(--vscode-button-foreground);
      flex: 1;
    }
  </style>