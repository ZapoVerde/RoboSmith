/**
 * @file webview-ui/src/components/ApiKeyManager.logic.spec.ts
 * @stamp S-20251101-T042000Z-C-COMPLIANT
 * @test-target webview-ui/src/components/ApiKeyManager.logic.ts
 * @description Verifies the contract of the headless `ApiKeyManager.logic` module. It ensures the module correctly validates form inputs, creates the appropriate event payloads, and returns the correct next state for the UI, thereby confirming all business logic.
 * @criticality The test target is CRITICAL as it contains the core business logic for managing API keys, a security-sensitive feature (Rubric Point #2).
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Verifies all public functions exported from the target module.
 *     - Verifies both success and failure paths (e.g., valid vs. invalid input).
 *     - Uses a mock dispatcher to isolate the logic from side effects.
 *     - Contains no dependencies on Svelte, the DOM, or any UI framework.
 */

import { describe, it, expect, vi } from 'vitest';
import { handleAddKey, handleDeleteKey } from './ApiKeyManager.logic';

describe('ApiKeyManager Logic', () => {
  describe('handleAddKey', () => {
    it('should dispatch "addApiKey" with the correct payload and return a reset state when inputs are valid', () => {
      // Arrange
      const mockDispatch = vi.fn();
      const newKeyData = {
        id: 'new-key',
        secret: 'new-secret',
        provider: 'google' as const,
      };

      // Act
      const nextState = handleAddKey(mockDispatch, newKeyData);

      // Assert - Dispatcher
      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith('addApiKey', {
        id: 'new-key',
        secret: 'new-secret',
        provider: 'google',
      });

      // Assert - Return Value
      expect(nextState).toEqual({
        id: '',
        secret: '',
        provider: 'openai',
      });
    });

    it('should not dispatch and should return original state when id is empty', () => {
      // Arrange
      const mockDispatch = vi.fn();
      const newKeyData = {
        id: '  ', // whitespace
        secret: 'new-secret',
        provider: 'openai' as const,
      };

      // Act
      const nextState = handleAddKey(mockDispatch, newKeyData);

      // Assert
      expect(mockDispatch).not.toHaveBeenCalled();
      expect(nextState).toBe(newKeyData); // Returns the original object.
    });
  });

  describe('handleDeleteKey', () => {
    it('should dispatch "removeApiKey" with the correct id payload', () => {
      // Arrange
      const mockDispatch = vi.fn();
      const keyIdToDelete = 'key-123';

      // Act
      handleDeleteKey(mockDispatch, keyIdToDelete);

      // Assert
      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith('removeApiKey', { id: 'key-123' });
    });
  });
});