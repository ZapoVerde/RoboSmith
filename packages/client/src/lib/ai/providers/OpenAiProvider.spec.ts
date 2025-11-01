/**
 * @file packages/client/src/lib/ai/providers/OpenAiProvider.spec.ts
 * @stamp S-20251031-T150450Z-V-q6r7s8t9
 * @test-target packages/client/src/lib/ai/providers/OpenAiProvider.ts
 * @description Verifies the provider correctly formats requests and parses responses using a mocked network layer.
 * @criticality The test target is CRITICAL as it manages external I/O.
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     - Mocks the global `fetch` API.
 *     - Verifies correct request payload formatting.
 *     - Verifies correct parsing of success and error responses.
 *     - Covers network failure scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAiProvider } from './OpenAiProvider';
import type { ApiKey, WorkOrder } from '../types';

describe('OpenAiProvider', () => {
  let provider: OpenAiProvider;
  let mockApiKey: ApiKey;
  let mockWorkOrder: WorkOrder;
  // This will hold our mock of the global fetch function
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = new OpenAiProvider();

    mockApiKey = {
      id: 'test-key-01',
      secret: 'sk-test-secret-key-12345',
      provider: 'openai',
    };

    mockWorkOrder = {
      model: 'gpt-4o',
      prompt: 'Summarize the following text.',
      temperature: 0.5,
      maxTokens: 150,
    };

    // Mock the global fetch function before each test
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    // Restore the original global fetch function after each test
    vi.unstubAllGlobals();
  });

  it('should return a successful ApiResult on a valid API response', async () => {
    // Arrange
    const mockSuccessResponse = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'This is the summary.',
          },
        },
      ],
      usage: {
        total_tokens: 123,
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSuccessResponse),
    });

    // Act
    const result = await provider.generateCompletion(mockApiKey, mockWorkOrder);

    // Assert
    // 1. Verify the fetch call itself
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, requestInit] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');

    // 2. Verify the request headers and body
    expect(requestInit.method).toBe('POST');
    expect(requestInit.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mockApiKey.secret}`,
    });
    const body = JSON.parse(requestInit.body);
    expect(body).toEqual({
      model: mockWorkOrder.model,
      messages: [{ role: 'user', content: mockWorkOrder.prompt }],
      temperature: mockWorkOrder.temperature,
      max_tokens: mockWorkOrder.maxTokens,
    });

    // 3. Verify the final, parsed result
    expect(result).toEqual({
      success: true,
      content: 'This is the summary.',
      tokensUsed: 123,
      apiKeyId: mockApiKey.id,
    });
  });

  it('should return a failed ApiResult on an API error response', async () => {
    // Arrange
    const mockErrorResponse = {
      error: {
        message: 'You exceeded your current quota, please check your plan and billing details.',
        type: 'insufficient_quota',
      },
    };

    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve(mockErrorResponse),
    });

    // Act
    const result = await provider.generateCompletion(mockApiKey, mockWorkOrder);

    // Assert
    expect(result.success).toBe(false);
    expect(result.content).toBeUndefined();
    expect(result.error).toContain('Failed to fetch from OpenAI');
    expect(result.error).toContain(mockErrorResponse.error.message);
  });

  it('should return a failed ApiResult on a network failure', async () => {
    // Arrange
    const networkError = new Error('Network connection failed');
    mockFetch.mockRejectedValue(networkError);

    // Act
    const result = await provider.generateCompletion(mockApiKey, mockWorkOrder);

    // Assert
    expect(result.success).toBe(false);
    expect(result.content).toBeUndefined();
    expect(result.error).toContain('Network or unexpected error occurred');
    expect(result.error).toContain(networkError.message);
  });
});
