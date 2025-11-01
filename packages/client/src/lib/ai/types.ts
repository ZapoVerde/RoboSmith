/**
 * @file packages/client/src/lib/ai/types.ts
 * @stamp S-20251031-T150200Z-C-g3d4f5a6
 * @architectural-role Type Definition
 * @description Defines the canonical, shared data contracts for the entire AI Service Layer. This file ensures type safety and a stable, unambiguous interface between all components of the service.
 * @core-principles
 * 1. IS the single source of truth for the AI service's data shapes.
 * 2. MUST contain only pure TypeScript type/interface definitions.
 * 3. MUST NOT contain any executable code or business logic.
 *
 * @api-declaration
 *   - export interface ApiKey
 *   - export interface WorkOrder
 *   - export interface ApiResult
 *
 * @contract
 *   assertions:
 *     - purity: "pure"
 *     - external_io: "none"
 *     - state_ownership: "none"
 */

/**
 * @id packages/client/src/lib/ai/types.ts#ApiKey
 * @description Represents a single, identifiable API key with its provider metadata. This is the shape that will be securely stored.
 */
export interface ApiKey {
  /** A unique identifier for the key within the pool, e.g., 'openai-personal-1'. */
  id: string;
  /** The secret API key value. */
  secret: string;
  /** The provider this key belongs to, used for routing logic. */
  provider: 'openai' | 'google' | 'anthropic';
}

/**
 * @id packages/client/src/lib/ai/types.ts#WorkOrder
 * @description The AI-agnostic payload sent by the Orchestrator to the ApiPoolManager. It defines the "what" of the request.
 */
export interface WorkOrder {
  /** The specific model to be used, e.g., 'gpt-4o', 'gemini-1.5-flash'. */
  model: string;
  /** The fully assembled prompt to be sent to the model. */
  prompt: string;
  /** The creativity parameter for the model, from 0.0 to 1.0. */
  temperature?: number;
  /** The maximum number of tokens to generate in the response. */
  maxTokens?: number;
}

/**
 * @id packages/client/src/lib/ai/types.ts#ApiResult
 * @description The standardized response object returned by the ApiPoolManager. It normalizes the output from any provider.
 */
export interface ApiResult {
  /** A boolean indicating if the API call was ultimately successful. */
  success: boolean;
  /** The string content of the LLM's response, if successful. */
  content?: string;
  /** A description of the error, if the call failed. */
  error?: string;
  /** The token usage data returned by the API, for logging and auditing. */
  tokensUsed?: number;
  /** The ID of the ApiKey that successfully fulfilled the request, for debugging. */
  apiKeyId?: string;
}
