/**
 * @file packages/client/src/lib/ai/providers/IAiProvider.ts
 * @stamp S-20251031-T150400Z-C-i8j9k0l1
 * @architectural-role Type Definition
 * @description Defines the `IAiProvider` interface, which serves as the strict contract for all external AI provider implementations.
 * @core-principles
 * 1. IS the single source of truth for the provider contract.
 * 2. ENFORCES interchangeability between different provider implementations (e.g., OpenAI, Google).
 * 3. MUST NOT contain any executable code or concrete implementations.
 *
 * @api-declaration
 *   - export interface IAiProvider
 *
 * @contract
 *   assertions:
 *     - purity: "pure"
 *     - external_io: "none"
 *     - state_ownership: "none"
 */

import type { ApiKey, WorkOrder, ApiResult } from '../types';

/**
 * @id packages/client/src/lib/ai/providers/IAiProvider.ts#IAiProvider
 * @description
 * The central contract that all provider-specific modules (like `OpenAiProvider`)
 * must implement. This ensures that different providers are perfectly
 * interchangeable from the perspective of the `aiClient` façade.
 */
export interface IAiProvider {
  /**
   * The universal function for executing an AI completion request against a
   * specific provider's API.
   * @param apiKey The API key and provider details for the request.
   * @param workOrder The AI-agnostic details of the work to be done.
   * @returns A promise that resolves to a standardized `ApiResult`.
   */
  generateCompletion(apiKey: ApiKey, workOrder: WorkOrder): Promise<ApiResult>;
}