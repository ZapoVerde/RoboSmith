/**
 * @file packages/shared/src/domain/api-key.ts
 * @stamp S-20251101-T120000Z-C-INITIAL
 * @architectural-role Type Definition
 * @description Defines the canonical, shared data contract for a user's API key. This is a core domain model for the entire application, intended for use across all packages.
 * @core-principles
 * 1. IS the single source of truth for the ApiKey data shape.
 * 2. MUST be platform-agnostic and have no external dependencies.
 * 3. MUST contain only pure TypeScript type/interface definitions.
 *
 * @api-declaration
 *   - export interface ApiKey
 *
 * @contract
 *   assertions:
 *     purity: pure          # This file contains only type definitions and no executable logic.
 *     external_io: none     # This file does not perform any I/O.
 *     state_ownership: none # This file does not own or manage any state.
 */

/**
 * @id packages/shared/src/domain/api-key.ts#ApiKey
 * @description Represents a single, identifiable API key with its provider metadata. This is the shape that will be securely stored and managed by the ApiPoolManager.
 */
export interface ApiKey {
    /** A unique identifier for the key within the pool, e.g., 'openai-personal-1'. */
    id: string;
    /** The secret API key value. */
    secret: string;
    /** The provider this key belongs to, used for routing logic. */
    provider: 'openai' | 'google' | 'anthropic';
  }