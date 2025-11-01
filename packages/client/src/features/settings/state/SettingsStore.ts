/**
 * @file packages/client/src/features/settings/state/SettingsStore.ts
 * @stamp S-20251031-T152000Z-C-FINALIZED
 * @architectural-role State Management
 * @description Defines the central Zustand store for user settings using the vanilla, framework-agnostic core. This ensures it is testable in a Node.js environment and has no dependency on React.
 * @core-principles
 * 1. IS the single, authoritative source of truth for user settings state.
 * 2. OWNS the state for `aiConnections`.
 * 3. DELEGATES all persistence I/O to the `SecureStorageService`.
 * 4. MUST NOT import from the root 'zustand' package to avoid React dependencies.
 *
 * @api-declaration
 *   - export interface SettingsState
 *   - export interface SettingsActions
 *   - export type SettingsStore
 *   - export const settingsStore: StoreApi<SettingsStore>
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # This is a state store; its purpose is to manage mutable state.
 *     - external_io: "none"     # It is a pure, in-memory store that delegates I/O.
 *     - state_ownership: "['aiConnections']" # It exclusively owns this slice of global state.
 */

// This is the definitive fix: import 'createStore' directly from the vanilla entry point.
import { createStore } from 'zustand/vanilla';
import type { ApiKey } from '@shared/domain/api-key';
import type { SecureStorageService } from '../../../lib/ai/SecureStorageService';

export interface SettingsState {
  aiConnections: ApiKey[];
}

export interface SettingsActions {
  loadApiKeys: (storageService: SecureStorageService) => Promise<void>;
  addApiKey: (key: ApiKey, storageService: SecureStorageService) => Promise<void>;
  removeApiKey: (keyId: string, storageService: SecureStorageService) => Promise<void>;
}

export type SettingsStore = SettingsState & SettingsActions;

// We create and export the store instance directly. It is framework-agnostic.
export const settingsStore = createStore<SettingsStore>((set) => ({
  // Initial State
  aiConnections: [],

  // Actions
  loadApiKeys: async (storageService) => {
    const keysRecord = await storageService.getAllApiKeys();
    const loadedKeysArray = Object.values(keysRecord);
    set({ aiConnections: loadedKeysArray });
  },

  addApiKey: async (key, storageService) => {
    await storageService.storeApiKey(key);
    set((state) => ({
      aiConnections: [...state.aiConnections.filter((k) => k.id !== key.id), key],
    }));
  },

  removeApiKey: async (keyId, storageService) => {
    await storageService.removeApiKey(keyId);
    set((state) => ({
      aiConnections: state.aiConnections.filter((k) => k.id !== keyId),
    }));
  },
}));
