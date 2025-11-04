/**
 * @file packages/client/src/lib/context/types.ts
 * @stamp 2025-11-04T17:05:00Z
 * @architectural-role Type Definition
 * @description Defines the canonical, shared data contracts for all interactions with the ContextPartitionerService. This file ensures type-safe communication between the Orchestrator and the code analysis engine.
 * @core-principles
 * 1. IS the single source of truth for the context service's data contracts.
 * 2. MUST contain only pure TypeScript type/interface definitions.
 * 3. MUST NOT contain any executable code or business logic.
 *
 * @api-declaration
 *   - export interface GetFileOutlineArgs
 *   - export interface FileOutline
 *   - export interface GetSymbolReferencesArgs
 *   - export interface SymbolReference
 *   - export interface CodeSearchArgs
 *   - export interface CodeSearchResult
 *
 * @contract
 *   assertions:
 *     - purity: pure          # This file contains only type definitions.
 *     - external_io: none     # Does not perform any I/O.
 *     - state_ownership: none # Does not own or manage any state.
 */

// --- 1. Tool: Get File Outline ---

/**
 * @id packages/client/src/lib/context/types.ts#GetFileOutlineArgs
 * @description The arguments required to request the structural outline of a single source file.
 */
export interface GetFileOutlineArgs {
    /**
     * The absolute path to the root of the Git worktree being analyzed.
     */
    worktreePath: string;
    /**
     * The path to the specific file to be outlined, relative to the worktree root.
     */
    filePath: string;
  }
  
  /**
   * @id packages/client/src/lib/context/types.ts#FileOutline
   * @description The structured report of a file's contents, detailing its primary symbols. This is the "answer" from the 'get_file_outline' tool.
   */
  export interface FileOutline {
    /**
     * An array of all top-level functions declared in the file.
     */
    functions: Array<{
      /** The identifier/name of the function. */
      name: string;
      /** The full signature of the function, including parameters and return type. */
      signature: string;
      /** The starting line number of the function definition. */
      line: number;
    }>;
    /**
     * An array of all classes declared in the file.
     */
    classes: Array<{
      /** The identifier/name of the class. */
      name: string;
      /** The starting line number of the class definition. */
      line: number;
    }>;
  }
  
  // --- 2. Tool: Get Symbol References ---
  
  /**
   * @id packages/client/src/lib/context/types.ts#GetSymbolReferencesArgs
   * @description The arguments required to find all usages of a specific symbol across the entire worktree.
   */
  export interface GetSymbolReferencesArgs {
    /**
     * The absolute path to the root of the Git worktree to be searched.
     */
    worktreePath: string;
    /**
     * The name of the symbol (e.g., function name, class name, variable) to search for.
     */
    symbolName: string;
  }
  
  /**
   * @id packages/client/src/lib/context/types.ts#SymbolReference
   * @description Represents a single location where a symbol is referenced, returned by the 'get_symbol_references' tool.
   */
  export interface SymbolReference {
    /**
     * The file path where the reference was found, relative to the worktree root.
     */
    filePath: string;
    /**
     * The line number where the reference appears.
     */
    line: number;
  }
  
  // --- 3. Tool: Code Search ---
  
  /**
   * @id packages/client/src/lib/context/types.ts#CodeSearchArgs
   * @description The arguments required to perform a semantic code search across the worktree.
   */
  export interface CodeSearchArgs {
    /**
     * The absolute path to the root of the Git worktree to be searched.
     */
    worktreePath: string;
    /**
     * The search query string. Can be a keyword, phrase, or code snippet.
     */
    query: string;
  }
  
  /**
   * @id packages/client/src/lib/context/types.ts#CodeSearchResult
   * @description Represents a single search result from the 'code_search' tool, including relevance and context.
   */
  export interface CodeSearchResult {
    /**
     * The file path of the matching line, relative to the worktree root.
     */
    filePath: string;
    /**
     * The line number of the match.
     */
    line: number;
    /**
     * The relevance score of the match (e.g., BM25 score), used for ranking.
     */
    score: number;
    /**
     * The full text content of the matching line.
     */
    lineText: string;
  }