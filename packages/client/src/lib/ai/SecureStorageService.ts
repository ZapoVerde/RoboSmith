/**
 * @file packages/client/src/lib/ai/SecureStorageService.ts
 * @stamp S-20251031-T150230Z-C-a1b2c3d4
 * @architectural-role Configuration
 * @description Implements a secure wrapper around the VS Code SecretStorage API. It is the single, authoritative module for persisting and retrieving sensitive `ApiKey` data.
 * @core-principles
 * 1. IS the exclusive gateway for all `ApiKey` persistence operations.
 * 2. MUST abstract the underlying `vscode.SecretStorage` API from the rest of the application.
 * 3. MUST NOT contain any business logic beyond the secure storage and retrieval of secrets.
 *
 * @api-declaration
 *   - export class SecureStorageService
 *     - constructor(secretStorage: vscode.SecretStorage)
 *     - async getAllApiKeys(): Promise<Record<string, ApiKey>>
 *     - async storeApiKey(key: ApiKey): Promise<void>
 *     - async removeApiKey(keyId: string): Promise<void>
 *
 * @contract
 *   assertions:
 *     - purity: "mutates"       # This class mutates external state (the secret store).
 *     - external_io: "vscode"   # Interacts with the VS Code SecretStorage API.
 *     - state_ownership: "none" # Does not own any in-memory application state.
 */

import type { SecretStorage } from 'vscode';
import type { ApiKey } from './types';

export class SecureStorageService {
  private readonly KEYCHAIN_SERVICE_NAME = 'robo-smith-api-keys';
  private readonly secretStorage: SecretStorage;

  constructor(secretStorage: SecretStorage) {
    this.secretStorage = secretStorage;
  }

  async getAllApiKeys(): Promise<Record<string, ApiKey>> {
    const storedJson = await this.secretStorage.get(this.KEYCHAIN_SERVICE_NAME);
    if (!storedJson) {
      return {};
    }

    try {
      return JSON.parse(storedJson) as Record<string, ApiKey>;
    } catch (error) {
      console.error('Failed to parse stored API keys:', error);
      // In case of corruption, return an empty object to prevent a crash.
      return {};
    }
  }

  async storeApiKey(key: ApiKey): Promise<void> {
    const allKeys = await this.getAllApiKeys();
    const updatedKeys = {
      ...allKeys,
      [key.id]: key,
    };
    const updatedJson = JSON.stringify(updatedKeys, null, 2);
    await this.secretStorage.store(this.KEYCHAIN_SERVICE_NAME, updatedJson);
  }

  async removeApiKey(keyId: string): Promise<void> {
    const allKeys = await this.getAllApiKeys();
    delete allKeys[keyId];
    const updatedJson = JSON.stringify(allKeys, null, 2);
    await this.secretStorage.store(this.KEYCHAIN_SERVICE_NAME, updatedJson);
  }
}
