/**
 * @file packages/client/src/lib/ai/aiClient.ts
 * @stamp S-20251031-T150515Z-C-u0v1w2x3
 * @architectural-role Orchestrator
 * @description Implements a stateless façade that acts as a factory for AI providers. It selects and delegates calls to the appropriate concrete provider based on the request's configuration.
 * @core-principles
 * 1. IS a stateless façade; it does not hold or manage any long-lived state.
 * 2. OWNS the logic for selecting the correct provider for a given request.
 * 3. DELEGATES all actual network I/O to the concrete provider implementations.
 *
 * @api-declaration
 *   - export const aiClient: { generateCompletion(apiKey: ApiKey, workOrder: WorkOrder): Promise<ApiResult> }
 *
 * @contract
 *   assertions:
 *     - purity: "pure"          # The client itself is stateless; providers handle I/O.
 *     - external_io: "none"     # Delegates I/O, does not perform it directly.
 *     - state_ownership: "none"
 */

import { IAiProvider } from './providers/IAiProvider';
import { OpenAiProvider } from './providers/OpenAiProvider';
import type { ApiKey, ApiResult, WorkOrder } from './types';

class AiClient {
  private readonly providers: Map<string, IAiProvider>;

  constructor() {
    this.providers = new Map();
    // Register all available provider implementations here.
    this.providers.set('openai', new OpenAiProvider());
    // To add a new provider (e.g., Google), you would add another line:
    // this.providers.set('google', new GoogleProvider());
  }

  /**
   * Selects the appropriate provider based on the apiKey and delegates the
   * completion request to it.
   * @param apiKey The key containing the provider name to use for routing.
   * @param workOrder The work to be performed.
   * @returns A standardized ApiResult from the selected provider.
   */
  public async generateCompletion(apiKey: ApiKey, workOrder: WorkOrder): Promise<ApiResult> {
    const provider = this.providers.get(apiKey.provider);

    if (!provider) {
      return {
        success: false,
        error: `Unknown or unsupported provider: ${apiKey.provider}`,
      };
    }

    return provider.generateCompletion(apiKey, workOrder);
  }
}

// Export a singleton instance to be used throughout the application.
const aiClient = new AiClient();
export { aiClient };
