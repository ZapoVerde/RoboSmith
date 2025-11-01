/**
 * @file packages/client/src/events/handler.spec.ts
 * @stamp S-20251031-T152300Z-V-CREATED
 * @test-target packages/client/src/events/handler.ts
 * @description Verifies that the event handler correctly routes new API key management commands to the appropriate mocked store actions.
 * @criticality The test target is CRITICAL as it is a core orchestrator.
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Mocks the `settingsStore` dependency.
 *     - Verifies that each command calls the correct store action.
 *     - Verifies that payloads and dependencies are passed correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { handleEvent, type EventHandlerContext } from './handler';
import { settingsStore } from '../features/settings/state/SettingsStore';
import { SecureStorageService } from '../lib/ai/SecureStorageService';
import type { Message } from '../shared/types';
import type { ApiKey } from '@shared/domain/api-key';

// Mock the dependencies that the handler will call.
vi.mock('../features/settings/state/SettingsStore');
vi.mock('../lib/ai/SecureStorageService');

describe('handleEvent', () => {
  let mockContext: EventHandlerContext;
  let mockSecureStorageService: Mocked<SecureStorageService>;

  // Create spies for the store's actions
  const mockLoadApiKeys = vi.fn();
  const mockAddApiKey = vi.fn();
  const mockRemoveApiKey = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockSecureStorageService = new SecureStorageService({} as any) as Mocked<SecureStorageService>;

    mockContext = {
      secureStorageService: mockSecureStorageService,
    };

    // Before each test, mock the implementation of getState to return our spies.
    // This allows us to intercept calls made by the handler.
    vi.mocked(settingsStore.getState).mockReturnValue({
      loadApiKeys: mockLoadApiKeys,
      addApiKey: mockAddApiKey,
      removeApiKey: mockRemoveApiKey,
    } as any);
  });

  it("should route the 'loadApiKeys' command to the settings store", async () => {
    // Arrange
    const message: Message = { command: 'loadApiKeys', payload: undefined };

    // Act
    await handleEvent(message, mockContext);

    // Assert
    expect(mockLoadApiKeys).toHaveBeenCalledOnce();
    expect(mockLoadApiKeys).toHaveBeenCalledWith(mockContext.secureStorageService);
  });

  it("should route the 'addApiKey' command to the settings store with the correct payload", async () => {
    // Arrange
    const newApiKey: ApiKey = { id: 'key-1', provider: 'openai', secret: 'sk-1' };
    const message: Message = { command: 'addApiKey', payload: newApiKey };

    // Act
    await handleEvent(message, mockContext);

    // Assert
    expect(mockAddApiKey).toHaveBeenCalledOnce();
    expect(mockAddApiKey).toHaveBeenCalledWith(newApiKey, mockContext.secureStorageService);
  });

  it("should route the 'removeApiKey' command to the settings store with the correct ID", async () => {
    // Arrange
    const message: Message = {
      command: 'removeApiKey',
      payload: { id: 'key-to-delete' },
    };

    // Act
    await handleEvent(message, mockContext);

    // Assert
    expect(mockRemoveApiKey).toHaveBeenCalledOnce();
    expect(mockRemoveApiKey).toHaveBeenCalledWith(
      'key-to-delete',
      mockContext.secureStorageService
    );
  });
});
