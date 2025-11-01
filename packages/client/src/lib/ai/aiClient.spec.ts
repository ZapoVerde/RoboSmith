/**
 * @file packages/client/src/lib/ai/aiClient.spec.ts
 * @stamp S-20251101-T134000Z-V-TYPED
 * @test-target packages/client/src/lib/ai/aiClient.ts
 * @description Verifies the aiClient façade, ensuring it correctly instantiates and delegates calls to the appropriate mocked provider based on the input configuration.
 * @criticality The test target is CRITICAL as it contains core business logic.
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Mocks concrete provider modules.
 *     - Verifies correct delegation based on provider key.
 *     - Verifies correct error handling for unsupported providers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { aiClient } from './aiClient';
import type { ApiKey, WorkOrder, ApiResult } from './types';

// 1. Declare a top-level variable with an explicit, strong type for our mock function.
// This defines its complete signature, satisfying TypeScript's strictness rules.
let mockGenerateCompletion: Mock<(apiKey: ApiKey, workOrder: WorkOrder) => Promise<ApiResult>>;

// 2. Mock the entire module. This block is hoisted by Vitest and runs first.
vi.mock('./providers/OpenAiProvider', () => {
  return {
    OpenAiProvider: class {
      // The mock implementation calls our typed, top-level mock function.
      generateCompletion(...args: [ApiKey, WorkOrder]) {
        return mockGenerateCompletion(...args);
      }
    },
  };
});

describe('aiClient', () => {
  let mockWorkOrder: WorkOrder;

  beforeEach(() => {
    // 5. Before each test, create a fresh mock function and assign it.
    mockGenerateCompletion = vi.fn();
    vi.clearAllMocks();

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