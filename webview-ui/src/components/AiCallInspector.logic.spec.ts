/**
 * @file webview-ui/src/components/AiCallInspector.logic.spec.ts
 * @stamp 2025-11-30T20:20:00.000Z
 * @test-target webview-ui/src/components/AiCallInspector.logic.ts
 * @description Verifies the contract of the headless logic module, including input validation.
 * @criticality Not Critical (UI Interaction Logic).
 * @testing-layer Unit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { handleRerun, type Dispatcher } from './AiCallInspector.logic';
import type { AiCallLog } from '../../../packages/client/src/shared/types';

describe('AiCallInspector Logic', () => {
  // Explicitly type the mock using the exported Dispatcher type
  let mockDispatch: Mock<Dispatcher>;
  let validRequest: AiCallLog['request'];

  beforeEach(() => {
    mockDispatch = vi.fn();
    validRequest = {
      provider: 'openai',
      model: 'gpt-4o',
      prompt: 'Valid prompt',
      temperature: 0.7
    };
  });

  describe('Validation (Fail Fast)', () => {
    it('should NOT dispatch if the prompt is empty', () => {
      const invalidRequest = { ...validRequest, prompt: '' };
      handleRerun(mockDispatch, invalidRequest);
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should NOT dispatch if the prompt is only whitespace', () => {
      const invalidRequest = { ...validRequest, prompt: '   ' };
      handleRerun(mockDispatch, invalidRequest);
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should NOT dispatch if the model is missing', () => {
      const invalidRequest = { ...validRequest, model: '' };
      handleRerun(mockDispatch, invalidRequest);
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe('Dispatching (Happy Path)', () => {
    it('should dispatch "rerunCall" when request is valid', () => {
      handleRerun(mockDispatch, validRequest);

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith('rerunCall', {
        modifiedRequest: validRequest
      });
    });
  });
});