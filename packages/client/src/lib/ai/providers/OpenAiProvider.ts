/**
 * @file packages/client/src/lib/ai/providers/OpenAiProvider.ts
 * @stamp S-20251031-T150425Z-C-m2n3o4p5
 * @architectural-role Business Logic
 * @description A concrete implementation of the `IAiProvider` interface for the OpenAI API. It encapsulates all logic required to format requests, execute network calls, and parse responses specific to OpenAI.
 * @core-principles
 * 1. MUST strictly implement the `IAiProvider` interface.
 * 2. OWNS all provider-specific logic for the OpenAI API.
 * 3. MUST be stateless and receive all required configuration for each call.
 *
 * @api-declaration
 *   - export class OpenAiProvider implements IAiProvider
 *
 * @contract
 *   assertions:
 *     - purity: "read-only"
 *     - external_io: "https_apis"
 *     - state_ownership: "none"
 */

import type { IAiProvider } from './IAiProvider';
import type { ApiKey, ApiResult, WorkOrder } from '../types';

export class OpenAiProvider implements IAiProvider {
  private static readonly API_URL = 'https://api.openai.com/v1/chat/completions';

  public async generateCompletion(apiKey: ApiKey, workOrder: WorkOrder): Promise<ApiResult> {
    try {
      // 1. Construct the provider-specific request payload
      const requestBody = {
        model: workOrder.model,
        messages: [{ role: 'user', content: workOrder.prompt }],
        ...(workOrder.temperature !== undefined && {
          temperature: workOrder.temperature,
        }),
        ...(workOrder.maxTokens !== undefined && {
          max_tokens: workOrder.maxTokens,
        }),
      };

      // 2. Execute the fetch request
      const response = await fetch(OpenAiProvider.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.secret}`,
        },
        body: JSON.stringify(requestBody),
      });

      // 3. Handle non-successful HTTP responses
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData?.error?.message ?? `HTTP error! Status: ${response.status}`;
        return {
          success: false,
          error: `Failed to fetch from OpenAI: ${errorMessage}`,
        };
      }

      // 4. Process the successful response
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      const tokensUsed = data.usage?.total_tokens;

      if (!content) {
        return {
          success: false,
          error: 'OpenAI response was successful but contained no content.',
        };
      }

      return {
        success: true,
        content,
        tokensUsed,
        apiKeyId: apiKey.id,
      };
    } catch (error) {
      // 5. Handle network or other unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Network or unexpected error occurred: ${errorMessage}`,
      };
    }
  }
}
