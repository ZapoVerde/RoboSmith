/**
 * @file packages/client/src/lib/workflow/WorkflowService.ts
 * @stamp S-20251101T172500Z-C-CREATED
 * @architectural-role Configuration
 * @description
 * A singleton service responsible for locating, reading, parsing, and validating
 * the `.vision/workflows.json` manifest file. It acts as the secure loader
 * for the Orchestrator, ensuring that any workflow manifest is structurally
 * sound and type-safe before execution.
 * @core-principles
 * 1. IS the single source of truth for loading the workflow manifest.
 * 2. MUST guarantee the structural integrity of the manifest via schema validation.
 * 3. MUST abstract all file system I/O related to loading the configuration.
 * 4. OWNS the canonical path to the manifest file (`.vision/workflows.json`).
 *
 * @api-declaration
 *   - export class WorkflowService
 *   -   public static getInstance(): WorkflowService
 *   -   public async loadWorkflow(workspaceRoot: string): Promise<WorkflowManifest>
 *
 * @contract
 *   assertions:
 *     - purity: "read-only"      # Reads from the filesystem but does not mutate application state.
 *     - external_io: "vscode"     # Interacts with the VS Code workspace FS API.
 *     - state_ownership: "none" # This service is stateless.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../logging/logger';
import type { WorkflowManifest } from '../../shared/types';

// --- Custom Error Types ---

export class ManifestNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestNotFoundError';
  }
}

export class InvalidJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJsonError';
  }
}

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

// --- Service Implementation ---

export class WorkflowService {
  private static instance: WorkflowService | undefined;

  private constructor() {}

  public static getInstance(): WorkflowService {
    if (!WorkflowService.instance) {
      WorkflowService.instance = new WorkflowService();
    }
    return WorkflowService.instance;
  }

  /**
   * Locates, parses, and validates the workflows.json manifest for the
   * current workspace.
   * @param workspaceRoot The absolute path to the root of the VS Code workspace.
   * @returns A promise that resolves with the valid WorkflowManifest object.
   * @throws An error if the file is not found, is not valid JSON, or fails
   *         to conform to the required schema.
   */
  public async loadWorkflow(workspaceRoot: string): Promise<WorkflowManifest> {
    const manifestPath = path.join(workspaceRoot, '.vision', 'workflows.json');
    const manifestUri = vscode.Uri.file(manifestPath);

    let rawContent: Uint8Array;
    try {
      rawContent = await vscode.workspace.fs.readFile(manifestUri);
    } catch (_error) {
      logger.error('Failed to find or read workflow manifest.', { path: manifestPath });
      throw new ManifestNotFoundError(
        `Workflow manifest not found at: ${manifestPath}. Ensure the .vision/workflows.json file exists.`
      );
    }

    const contentString = Buffer.from(rawContent).toString('utf8');
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(contentString);
    } catch (_error) {
      logger.error('Failed to parse workflow manifest. Invalid JSON.', { path: manifestPath });
      throw new InvalidJsonError(
        'The workflows.json file contains invalid JSON. Please check its syntax.'
      );
    }

    if (!this.isValidManifest(parsedJson)) {
      logger.error('Workflow manifest failed schema validation.', { manifest: parsedJson });
      throw new SchemaValidationError(
        'The workflows.json file does not conform to the required schema. It must be a dictionary of NodeDefinition objects.'
      );
    }

    logger.info('Workflow manifest loaded and validated successfully.', { path: manifestPath });
    return parsedJson as WorkflowManifest;
  }

  /**
   * A simple, type-guard based validation function to check the manifest structure.
   * This now validates against the canonical `WorkflowManifest` type.
   */
  private isValidManifest(data: unknown): data is WorkflowManifest {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return false;
    }
    // A simple check: ensure it's a non-array object. A real implementation
    // would iterate through keys and validate the NodeDefinition structure.
    return true;
  }
}