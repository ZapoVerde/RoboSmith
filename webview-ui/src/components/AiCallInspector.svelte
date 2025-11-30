<!--
 * @file webview-ui/src/components/AiCallInspector.svelte
 * @stamp 2025-11-30T20:40:00.000Z
 * @architectural-role UI Component
 * @description Provides the interface for browsing AI call logs, editing prompts, and triggering re-runs.
 * @core-principles
 * 1. IS a purely presentational component.
 * 2. OWNS the local UI state for navigation (selected log) and editing (form inputs).
 * 3. DELEGATES the "Re-run" action to the headless logic module.
-->

<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { AiCallLog } from '../../../packages/client/src/shared/types';
    import { handleRerun, type Dispatcher } from './AiCallInspector.logic';
  
    export let logs: AiCallLog[] = [];
  
    // Local UI State
    let selectedLogId: string | null = null;
    let editedRequest: AiCallLog['request'] | null = null;
  
    // Derived State
    $: selectedLog = logs.find((l) => l.callId === selectedLogId) || null;
  
    // Reset edited request when selection changes
    $: if (selectedLog && (!editedRequest || selectedLog.callId !== selectedLogId)) {
      // Deep clone to detach from the prop
      editedRequest = JSON.parse(JSON.stringify(selectedLog.request));
    }
  
    // Formatting Helper
    function formatTime(iso: string) {
      return new Date(iso).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
  
    // Dispatcher Setup
    const svelteDispatch = createEventDispatcher();
    const vscode = acquireVsCodeApi();
  
    const safeDispatch: Dispatcher = (command, payload) => {
      // 1. Notify parent (optional, mostly for testing)
      svelteDispatch(command, payload);
      // 2. Send to Backend
      vscode.postMessage({ command, payload });
    };
  
    function onRerun() {
      if (editedRequest) {
        handleRerun(safeDispatch, editedRequest);
      }
    }
  </script>
  
  <div class="inspector-container">
    <!-- SIDEBAR: Log List -->
    <aside class="sidebar">
      <header>
        <h3>History</h3>
      </header>
      <div class="log-list">
        {#each logs as log (log.callId)}
          <button
            class="log-item"
            class:selected={log.callId === selectedLogId}
            on:click={() => (selectedLogId = log.callId)}
          >
            <div class="log-meta">
              <span class="time">{formatTime(log.timestamp)}</span>
              <span class="status {log.error ? 'error' : 'success'}">
                {log.error ? 'ERR' : 'OK'}
              </span>
            </div>
            <div class="log-step">{log.stepName || 'Unknown Step'}</div>
          </button>
        {/each}
      </div>
    </aside>
  
    <!-- MAIN: Detail View -->
    <main class="detail-view">
      {#if selectedLog && editedRequest}
        <div class="toolbar">
          <h2>Inspect & Refine</h2>
          <button class="primary" on:click={onRerun}>🔬 Re-run & Compare</button>
        </div>
  
        <div class="panels">
          <!-- LEFT: Request Editor -->
          <div class="panel request-panel">
            <h4>Request (Editable)</h4>
            
            <div class="field-group">
              <label for="prompt">Prompt:</label>
              <textarea
                id="prompt"
                bind:value={editedRequest.prompt}
                rows="10"
              ></textarea>
            </div>
  
            <div class="field-row">
              <div class="field-group">
                <label for="model">Model:</label>
                <input id="model" type="text" bind:value={editedRequest.model} />
              </div>
              <div class="field-group">
                <label for="temp">Temp:</label>
                <input
                  id="temp"
                  type="number"
                  step="0.1"
                  bind:value={editedRequest.temperature}
                />
              </div>
            </div>
          </div>
  
          <!-- RIGHT: Response Viewer -->
          <div class="panel response-panel">
            <h4>Original Response</h4>
            {#if selectedLog.error}
              <div class="error-banner">
                {selectedLog.error}
              </div>
            {:else}
              <pre class="response-content">{selectedLog.response.content}</pre>
              <div class="stats">
                Duration: {selectedLog.response.durationMs}ms
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="empty-state">
          <p>Select a log entry from the left to inspect it.</p>
        </div>
      {/if}
    </main>
  </div>
  
  <style>
    .inspector-container {
      display: flex;
      height: 100vh;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
  
    /* Sidebar */
    .sidebar {
      width: 250px;
      border-right: 1px solid var(--vscode-panel-border);
      display: flex;
      flex-direction: column;
      background-color: var(--vscode-sideBar-background);
    }
  
    .sidebar header {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
  
    .log-list {
      overflow-y: auto;
      flex: 1;
    }
  
    .log-item {
      width: 100%;
      text-align: left;
      padding: 0.5rem 1rem;
      border: none;
      border-bottom: 1px solid var(--vscode-tree-indentGuidesStroke);
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
  
    .log-item:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
  
    .log-item.selected {
      background-color: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
  
    .log-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.85em;
      opacity: 0.8;
      margin-bottom: 2px;
    }
  
    .status.error {
      color: var(--vscode-charts-red);
      font-weight: bold;
    }
    .status.success {
      color: var(--vscode-charts-green);
    }
  
    .log-step {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  
    /* Main View */
    .detail-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  
    .toolbar {
      padding: 1rem;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  
    .toolbar h2 {
      margin: 0;
      font-size: 1.2rem;
    }
  
    .panels {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
  
    .panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 1rem;
      overflow-y: auto;
    }
  
    .request-panel {
      border-right: 1px solid var(--vscode-panel-border);
    }
  
    .field-group {
      display: flex;
      flex-direction: column;
      margin-bottom: 1rem;
    }
  
    .field-row {
      display: flex;
      gap: 1rem;
    }
  
    label {
      margin-bottom: 0.25rem;
      font-weight: 600;
      font-size: 0.9em;
    }
  
    input,
    textarea {
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 0.5rem;
      font-family: var(--vscode-editor-font-family);
    }
  
    textarea {
      resize: vertical;
    }
  
    .response-content {
      white-space: pre-wrap;
      font-family: var(--vscode-editor-font-family);
      background-color: var(--vscode-textBlockQuote-background);
      padding: 1rem;
      border-radius: 4px;
    }
  
    .error-banner {
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      padding: 1rem;
      color: var(--vscode-inputValidation-errorForeground);
    }
  
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      opacity: 0.6;
    }
  
    button.primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 0.5rem 1rem;
      cursor: pointer;
      border-radius: 2px;
    }
  
    button.primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
  </style>