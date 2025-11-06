/**
 * @file packages/client/src/lib/workflow/ActionHandler.spec.ts
 * @test-target packages/client/src/lib/workflow/ActionHandler.ts
 * @description Verifies the contract of the `executeAction` function, ensuring it correctly parses and executes all atomic workflow commands and handles invalid or malformed actions gracefully.
 * @criticality The test target is CRITICAL as it contains core business logic for state transitions.
 * @testing-layer Unit
 */

// --- HOISTING-SAFE MOCK ---
// This mock MUST be at the top of the file. It intercepts the `import 'vscode'`
// call in the logger (an implicit dependency) and provides a fake version.
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
    })),
  },
  default: {},
}));

// --- IMPORTS ---
import { describe, it, expect, vi } from 'vitest';
import { executeAction } from './ActionHandler';
import type { ActionParams } from './ActionHandler';

// --- TEST SUITE ---
describe('executeAction', () => {
  describe('JUMP Action', () => {
    it('should return the targetId as the nextBlockId and not change the stack', () => {
      // Arrange
      const params: ActionParams = {
        action: 'JUMP:NodeA__BlockB',
        currentStack: ['NodeX__BlockY'],
      };

      // Act
      const result = executeAction(params);

      // Assert
      expect(result.nextBlockId).toBe('NodeA__BlockB');
      expect(result.nextStack).toEqual(['NodeX__BlockY']);
    });

    it('should throw an error when the targetId is missing', () => {
      // Arrange
      const params: ActionParams = { action: 'JUMP:', currentStack: [] };

      // Act & Assert
      expect(() => executeAction(params)).toThrow('Invalid JUMP action: Missing TargetId in "JUMP:"');
    });
  });

  describe('CALL Action', () => {
    it('should return the targetId as nextBlockId and push the returnAddress to the stack', () => {
      // Arrange
      // FIX: The returnAddress is now part of the action string itself.
      const params: ActionParams = {
        action: 'CALL:Subroutine__Entry:Main__Step2_Return',
        currentStack: ['Main__Step1'],
      };

      // Act
      const result = executeAction(params);

      // Assert
      expect(result.nextBlockId).toBe('Subroutine__Entry');
      expect(result.nextStack).toEqual(['Main__Step1', 'Main__Step2_Return']);
    });

    it('should throw an error when the targetId is missing', () => {
      // Arrange
      // FIX: The action string now reflects a missing target but present return address.
      const params: ActionParams = {
        action: 'CALL::Main__Step2_Return',
        currentStack: [],
      };

      // Act & Assert
      expect(() => executeAction(params)).toThrow('Invalid CALL action: Missing TargetId in "CALL::Main__Step2_Return"');
    });
    it('should throw an error when the returnAddress is missing', () => {
      // Arrange
      const params: ActionParams = {
        action: 'CALL:Subroutine__Entry:', // Note the trailing colon
        currentStack: [],
      };

      // Act & Assert
      expect(() => executeAction(params)).toThrow(
        'Invalid CALL action: Missing ReturnAddress in "CALL:Subroutine__Entry:"'
      );
    });
  });

  describe('RETURN Action', () => {
    it('should pop the last address from the stack and return it as nextBlockId', () => {
      // Arrange
      const params: ActionParams = {
        action: 'RETURN',
        currentStack: ['Main__Step1', 'Main__Step2_Return'],
      };

      // Act
      const result = executeAction(params);

      // Assert
      expect(result.nextBlockId).toBe('Main__Step2_Return');
      expect(result.nextStack).toEqual(['Main__Step1']);
    });

    it('should return null nextBlockId and an empty stack when the stack is empty', () => {
      // Arrange
      const params: ActionParams = {
        action: 'RETURN',
        currentStack: [],
      };

      // Act
      const result = executeAction(params);

      // Assert
      expect(result.nextBlockId).toBeNull();
      expect(result.nextStack).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should throw an error for an unknown action command', () => {
      // Arrange
      const params: ActionParams = { action: 'INVALID_COMMAND:SomeTarget', currentStack: [] };

      // Act & Assert
      expect(() => executeAction(params)).toThrow('Unknown workflow action command: "INVALID_COMMAND"');
    });

    it('should correctly trim whitespace from the targetId', () => {
      // Arrange
      const params: ActionParams = { action: 'JUMP:  MyTarget  ', currentStack: [] };

      // Act
      const result = executeAction(params);

      // Assert
      expect(result.nextBlockId).toBe('MyTarget');
    });
  });
});