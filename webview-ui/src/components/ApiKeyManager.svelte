<!--
 * @file webview-ui/src/components/ApiKeyManager.svelte
 * @stamp S-20251101-T042500Z-C-COMPLIANT
 * @architectural-role UI Component
 * @description Provides the user interface for managing `ApiKey` objects. It is a purely presentational component that delegates all business logic and event creation to the headless `ApiKeyManager.logic.ts` module.
 * @core-principles
 * 1. IS a purely presentational component.
 * 2. OWNS the DOM structure and local UI state (form inputs).
 * 3. DELEGATES all business logic and validation to the imported logic module.
 *
 * @api-declaration
 *   - PROPS:
 *     - export let keys: ApiKey[] = [];
 *   - EVENTS:
 *     - on:addApiKey (payload: ApiKey)
 *     - on:removeApiKey (payload: { id: string })
 *
 * @contract
 *   assertions:
 *     purity: mutates          # This component manages its own internal form state and renders to the DOM.
 *     external_io: none        # All I/O is delegated via events.
 *     state_ownership: ['form_state'] # Owns the local state for the 'add key' form inputs.
-->

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ApiKey } from '@shared/domain/api-key';
  import { handleAddKey, handleDeleteKey } from './ApiKeyManager.logic';

  export let keys: ApiKey[] = [];

  const dispatch = createEventDispatcher();

  // Component still owns the state of the form inputs
  let newId = '';
  let newSecret = '';
  let newProvider: ApiKey['provider'] = 'openai';

  function onFormSubmit() {
    const nextState = handleAddKey(dispatch, {
      id: newId,
      secret: newSecret,
      provider: newProvider,
    });
    // Update local state with the reset values from the logic function
    newId = nextState.id;
    newSecret = nextState.secret;
    newProvider = nextState.provider;
  }

  // The component just wires the browser event to the tested logic
  const onDeleteClick = (keyId: string) => handleDeleteKey(dispatch, keyId);
</script>

<main>
  <section class="key-list-section">
    <h2>Managed API Keys</h2>
    {#if keys.length === 0}
      <p>No API keys have been added yet.</p>
    {:else}
      <ul>
        {#each keys as key (key.id)}
          <li class="key-item">
            <div class="key-info">
              <span class="key-id">{key.id}</span>
              <span class="key-provider">{key.provider}</span>
            </div>
            <button on:click={() => onDeleteClick(key.id)}>Delete</button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="add-key-section">
    <h2>Add New Key</h2>
    <form on:submit|preventDefault={onFormSubmit}>
      <div class="form-field">
        <label for="key-id">Key ID (a unique name)</label>
        <input id="key-id" type="text" bind:value={newId} required />
      </div>
      <div class="form-field">
        <label for="key-secret">Secret Key</label>
        <input id="key-secret" type="password" bind:value={newSecret} required />
      </div>
      <div class="form-field">
        <label for="key-provider">Provider</label>
        <select id="key-provider" bind:value={newProvider} required>
          <option value="openai">OpenAI</option>
          <option value="google">Google</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>
      <button type="submit">Add Key</button>
    </form>
  </section>
</main>

<style>
  /* Styles remain unchanged */
  main {
    padding: 1rem;
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  h2 {
    margin-top: 0;
    border-bottom: 1px solid var(--vscode-editor-widget-border);
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .key-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background-color: var(--vscode-sideBar-background);
    border-radius: 4px;
    border: 1px solid var(--vscode-input-border, transparent);
  }

  .key-info {
    display: flex;
    flex-direction: column;
  }

  .key-id {
    font-weight: bold;
  }

  .key-provider {
    font-size: 0.8em;
    opacity: 0.7;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  input,
  select,
  button {
    font-family: inherit;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--vscode-input-border);
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
  }

  button {
    cursor: pointer;
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }

  button:hover {
    background-color: var(--vscode-button-hoverBackground);
  }
</style>