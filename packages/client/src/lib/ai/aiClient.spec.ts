/**
 * @file packages/client/src/lib/ai/aiClient.spec.ts
 * @stamp S-20251101-T134000Z-V-TYPED
 * @test-target packages/client/src/lib/ai/aiClient.ts
 * @description Verifies the aiClient façade, ensuring it correctly instantiates and delegates calls to the appropriate mocked provider based on the input configuration.
 * @criticality The test target is CRITICAL as it contains core business logic.
 * @testing-layer Unit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiClient } from './aiClient';
import type { ApiKey, WorkOrder, ApiResult } from './types';

// 1. Use vi.hoisted to create the mock function BEFORE the module mocks run.
// This prevents the ReferenceError caused by accessing a variable before initialization.
const { mockGenerateCompletion } = vi.hoisted(() => {
  return { mockGenerateCompletion: vi.fn() };
});

// 2. Mock the entire module using the hoisted mock function.
vi.mock('./providers/OpenAiProvider', () => {
  return {
    OpenAiProvider: class {
      // The mock implementation calls our hoisted mock function.
      generateCompletion(...args: [ApiKey, WorkOrder]) {
        return mockGenerateCompletion(...args);
      }
    },
  };
});

describe('aiClient', () => {
  let mockWorkOrder: WorkOrder;

  beforeEach(() => {
    // 3. Reset the mock before each test to ensure a clean state.
    mockGenerateCompletion.mockReset();
    
    mockWorkOrder = {
      model: 'gpt-4o',
      prompt: 'Test prompt from aiClient.spec.ts',
    };
  });

  it("should delegate to OpenAiProvider for an 'openai' key", async () => {
    // Arrange
    const openAiKey: ApiKey = {
      id: 'openai-key-1',
      secret: 'sk-secret',
      provider: 'openai',
    };
    const mockSuccessResult: ApiResult = {
      success: true,
      content: 'Mocked response from OpenAI',
    };
    mockGenerateCompletion.mockResolvedValue(mockSuccessResult);

    // Act
    const result = await aiClient.generateCompletion(openAiKey, mockWorkOrder);

    // Assert
    expect(mockGenerateCompletion).toHaveBeenCalledOnce();
    expect(mockGenerateCompletion).toHaveBeenCalledWith(openAiKey, mockWorkOrder);
    expect(result).toBe(mockSuccessResult);
  });

  it('should return a failed result for an unknown provider', async () => {    
    const unknownKey: ApiKey = {
      id: 'anthropic-key-1',
      secret: 'ak-secret',
      provider: 'anthropic',
    };

    // Act
    const result = await aiClient.generateCompletion(unknownKey, mockWorkOrder);

    // Assert
    expect(mockGenerateCompletion).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown or unsupported provider: anthropic');
  });
});