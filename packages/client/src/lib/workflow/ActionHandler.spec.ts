/**
 * @file packages/client/src/lib/workflow/ActionHandler.spec.ts
 * @stamp S-20251102T154500Z-V-REFACTORED-FIXED
 * @test-target packages/client/src/lib/workflow/ActionHandler.ts
 * @description Verifies the contract of the `executeAction` function, ensuring it correctly parses and executes all atomic workflow commands (JUMP, CALL, RETURN) and handles invalid or malformed actions gracefully.
 * @criticality The test target is CRITICAL as it contains core business logic for state transitions (Rubric Point #2: Core Business Logic Orchestration).
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Verifies correct state changes for JUMP.
 *     - Verifies correct stack manipulation for CALL.
 *     - Verifies correct stack manipulation for RETURN.
 *     - Verifies robust error handling for invalid actions.
 */

// --- HOISTING-SAFE MOCK ---
// This mock MUST be at the top of the file. vi.mock is hoisted, meaning
// it runs before any imports. This intercepts the `import 'vscode'` call
// in the logger and provides a fake version, preventing the crash.
vi.mock('vscode', () => ({
    window: {
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
      })),
    },
    default: {},
  }));
  
  import { describe, it, expect, vi } from 'vitest';
  import { executeAction } from './ActionHandler';
  import type { ActionParams } from './ActionHandler';
  
  describe('executeAction', () => {
    describe('JUMP Action', () => {
      it('should return the targetId as the nextBlockId and not change the stack', () => {
        const params: ActionParams = {
          action: 'JUMP:NodeA__BlockB',
          currentStack: ['NodeX__BlockY'],
        };
        const result = executeAction(params);
        expect(result.nextBlockId).toBe('NodeA__BlockB');
        expect(result.nextStack).toEqual(['NodeX__BlockY']);
      });
  
      it('should throw an error when the targetId is missing', () => {
        const params: ActionParams = { action: 'JUMP:', currentStack: [] };
        expect(() => executeAction(params)).toThrow('Invalid JUMP action: Missing TargetId');
      });
    });
  
    describe('CALL Action', () => {
      it('should return the targetId as nextBlockId and push the returnAddress to the stack', () => {
        const params: ActionParams = {
          action: 'CALL:Subroutine__Entry',
          currentStack: ['Main__Step1'],
          returnAddress: 'Main__Step2_Return',
        };
        const result = executeAction(params);
        expect(result.nextBlockId).toBe('Subroutine__Entry');
        expect(result.nextStack).toEqual(['Main__Step1', 'Main__Step2_Return']);
      });
  
      it('should throw an error when the targetId is missing', () => {
        const params: ActionParams = {
          action: 'CALL:',
          currentStack: [],
          returnAddress: 'Main__Step2_Return',
        };
        expect(() => executeAction(params)).toThrow('Invalid CALL action: Missing TargetId');
      });
  
      it('should throw an error when the returnAddress is missing', () => {
        const params: ActionParams = {
          action: 'CALL:Subroutine__Entry',
          currentStack: [],
          // returnAddress is intentionally omitted
        };
        expect(() => executeAction(params)).toThrow(
          'Invalid CALL invocation: A returnAddress must be provided.'
        );
      });
    });
  
    describe('RETURN Action', () => {
      it('should pop the last address from the stack and return it as nextBlockId', () => {
        const params: ActionParams = {
          action: 'RETURN',
          currentStack: ['Main__Step1', 'Main__Step2_Return'],
        };
        const result = executeAction(params);
        expect(result.nextBlockId).toBe('Main__Step2_Return');
        expect(result.nextStack).toEqual(['Main__Step1']);
      });
  
      it('should return null nextBlockId and an empty stack when the stack is empty', () => {
        const params: ActionParams = {
          action: 'RETURN',
          currentStack: [],
        };
        const result = executeAction(params);
        expect(result.nextBlockId).toBeNull();
        expect(result.nextStack).toEqual([]);
      });
    });
  
    describe('Error Handling', () => {
      it('should throw an error for an unknown action command', () => {
        const params: ActionParams = { action: 'INVALID_COMMAND:SomeTarget', currentStack: [] };
        expect(() => executeAction(params)).toThrow('Unknown workflow action command: "INVALID_COMMAND"');
      });
  
      it('should correctly trim whitespace from the targetId', () => {
        const params: ActionParams = { action: 'JUMP:  MyTarget  ', currentStack: [] };
        const result = executeAction(params);
        expect(result.nextBlockId).toBe('MyTarget');
      });
    });
  });