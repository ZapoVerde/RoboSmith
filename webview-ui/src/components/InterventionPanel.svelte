<!--
 * @file webview-ui/src/components/InterventionPanel.svelte
 * @stamp {"timestamp":"2025-11-09T02:44:00.000Z"}
 * @architectural-role UI Component
 * @description Provides the unified UI for observing and controlling a workflow. It operates in a read-only mode to display history or an interactive mode (when `isHalted` is true) to accept user guidance and resume execution.
 * @core-principles
 * 1. IS a purely presentational component.
 * 2. OWNS the local UI state (e.g., text input content).
 * 3. DELEGATES all business logic for event dispatching to the imported logic module.
-->
<script lang="ts">
  import {
    dispatchResumeWorkflow,
    dispatchRetryBlock,
  } from './InterventionPanel.logic';
  import type { ContextSegment } from '../../../packages/client/src/shared/types';

  export let isHalted: boolean = false;
  export let executionPayload: ContextSegment[] = [];
  export let sessionId: string;

  let guidanceText: string = '';

  // The function is available globally in the webview, so this call is correct.
  const vscode = acquireVsCodeApi();

  function handleAbort() {
    vscode.postMessage({
      command: 'rejectAndDiscard',
      payload: { sessionId },
    });
  }
</script>

<div class="intervention-panel">
  <div class="chat-history">
    {#each executionPayload as segment (segment.id)}
      <div class="segment" data-type={segment.type}>
        <pre>{segment.content}</pre>
      </div>
    {/each}
  </div>

  {#if isHalted}
    <div class="interactive-controls">
      <textarea
        bind:value={guidanceText}
        placeholder="Add guidance for the next step..."
      ></textarea>
      <div class="button-group">
        <button on:click={() => dispatchRetryBlock(sessionId, guidanceText)}>
          [Retry]
        </button>
        <button on:click={() => dispatchResumeWorkflow(sessionId, guidanceText)}>
          [Resume]
        </button>
        <button class="abort" on:click={handleAbort}> [Abort] </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .intervention-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .chat-history {
    flex-grow: 1;
    overflow-y: auto;
    padding: 1rem;
    background-color: var(--vscode-editor-background);
  }

  .segment {
    margin-bottom: 1rem;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--vscode-editorGroup-border);
  }

  .segment pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: var(--vscode-editor-font-family);
  }

  .interactive-controls {
    flex-shrink: 0;
    padding: 1rem;
    border-top: 1px solid var(--vscode-editorGroup-border);
    background-color: var(--vscode-sideBar-background);
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 80px;
    margin-bottom: 0.5rem;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    font-family: var(--vscode-editor-font-family);
  }

  .button-group {
    display: flex;
    gap: 0.5rem;
  }

  button {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 0.5rem 1rem;
    cursor: pointer;
  }

  button:hover {
    background-color: var(--vscode-button-hoverBackground);
  }

  button.abort {
    background-color: var(--vscode-errorForeground);
    color: var(--vscode-editor-background);
  }
</style>