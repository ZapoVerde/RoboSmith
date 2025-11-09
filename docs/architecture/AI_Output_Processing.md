# Architecture: AI Output Processing (Validation & Cleaning)

## 1. High-Level Summary

This document defines the architecture for a robust **AI Output Processing Pattern**. Its purpose is to solve the problem of "chatty" or structurally invalid AI responses *before* they can fail a test or corrupt a file.

This is a two-part pattern:

1.  **Orchestrator-level Structural Validation (Zod):** The `Orchestrator` is responsible for validating the *shape* of AI output against a predefined Zod schema. This creates a "Validation-Fix Cycle" that is faster and more precise than the "Test-Fix Cycle."
2.  **Worker-level Content Cleaning (Heuristics):** `Internal:Workers` (like `FileSystemWriter`) are responsible for *cleaning* raw AI output. They run heuristics to strip away markdown fences, conversational preambles, and other "chat" artifacts to isolate the pure content (code, markdown, etc.) they need.

This pattern makes the entire system more robust, efficient, and self-healing.

---

## 2. Part 1: Orchestrator-level Structural Validation

This pattern creates a "Validation-Fix Cycle" that is identical in principle to the existing "Test-Fix Cycle".

### 2.1. Define Schemas
A central map of Zod schemas is created.

**New File:** `packages/client/src/lib/workflow/ValidationSchemas.ts`
```typescript
import { z } from 'zod';

// Schema expecting a JSON object with 'code' and 'explanation'
export const CodeAndExplanationSchema = z.object({
  code: z.string().min(1, "Code snippet cannot be empty."),
  explanation: z.string().min(1, "Explanation cannot be empty."),
});

// Schema expecting just a raw string of code
export const CodeOnlySchema = z.string().min(1, "Code snippet cannot be empty.");

// A map to make schemas accessible by name
export const validationSchemaMap = {
  'CodeAndExplanation': CodeAndExplanationSchema,
  'CodeOnly': CodeOnlySchema,
};

export type SchemaName = keyof typeof validationSchemaMap;
```

### 2.2. Update Manifest
The `BlockDefinition` in `shared/types.ts` is updated with a new optional property:

```typescript
export interface BlockDefinition {
  worker: string;
  /** If present, the Orchestrator will validate the AI's output against this schema. */
  validationSchema?: SchemaName; // <--- NEW PROPERTY
  payload_merge_strategy: string[];
  transitions: Transition[];
}
```

### 2.3. Update Orchestrator
The `Orchestrator`'s `run()` loop is modified to perform validation *after* receiving a result from the `ApiPoolManager` and *before* looking up the transition.

**Conceptual `Orchestrator.ts` logic:**

```typescript
// (Inside the `run()` loop...)

// 1. EXECUTE BLOCK (Existing)
const result: WorkerResult = await this.apiManager.execute(workOrder);
this.executionPayload = result.newPayload;
const aiOutputSegment = this.executionPayload[this.executionPayload.length - 1];

// 2. HEURISTIC CLEANING (New)
// Run a heuristic cleaner *before* Zod validation
const cleanedAiOutput = cleanAiOutput(aiOutputSegment.content);

// 3. ZOD VALIDATION (New)
let finalSignal = result.signal;
const { block } = this.findNodeAndBlock(this.currentBlockId);

if (block.validationSchema) {
  const schema = validationSchemaMap[block.validationSchema];
  if (schema) {
    try {
      // Try to parse the *cleaned* output
      const dataToValidate = JSON.parse(cleanedAiOutput);
      schema.parse(dataToValidate); // Run Zod

      // Success! Update the payload with the clean, validated content.
      aiOutputSegment.content = cleanedAiOutput;

    } catch (error) {
      // Validation FAILED.
      finalSignal = 'SIGNAL:VALIDATION_FAIL'; // Override the signal

      // Add the "rework note" to the payload
      this.executionPayload.push({
        id: crypto.randomUUID(),
        type: 'VALIDATION_ERROR',
        content: `Output failed validation. Fix this: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// 4. LOOKUP TRANSITION (Existing)
// This now uses the `finalSignal`, which could be "SIGNAL:VALIDATION_FAIL"
let transition = block.transitions.find((t) => t.on_signal === finalSignal);
// ... (rest of the loop) ...
```

### 2.4. Example `workflows.json`
The manifest now includes a transition for the new signal, creating the self-healing loop.

```json
"Block:Feature_Implement__GenerateCode": {
    "worker": "Worker:CodeGenerator",
    "validationSchema": "CodeAndExplanation",
    "transitions": [
        { "on_signal": "SIGNAL:SUCCESS", "action": "JUMP:Core_IO__WriteArtifacts" },
        /* NEW "REWORK" TRANSITION */
        { "on_signal": "SIGNAL:VALIDATION_FAIL", "action": "JUMP:Feature_Implement__GenerateCode" },
        { "on_signal": "SIGNAL:FAIL_DEFAULT", "action": "JUMP:Core_Halt__UnhandledError" }
    ]
}
```

---

## 3. Part 2: Worker-level Content Cleaning

This pattern dictates that the `Orchestrator` handles *structural* validation (Zod), while individual **Workers** are responsible for *content* cleaning and formatting.

* **`Internal:FileSystemWriter`:** This worker must *not* trust the `CODE_OUTPUT` segment it receives. It must run its own heuristic (e.g., `extractCodeBlock(content)`) to find markdown fences (e.g., \`\`\`typescript ... \`\`\`) and write *only* the pure code to disk.
* **`Internal:DocumentationWriter` (New Worker):** A new worker for writing markdown should run a heuristic (e.g., `cleanPreamble(content)`) to strip all "chatty" text (like "Of course, here is the documentation...") up to the first `##` or `---`.
* **`Internal:PreambleValidator` (New Worker):** A new worker can be created to validate preambles. It would read a file, extract the preamble, and use a Zod schema (`PreambleSchema.parse()`) to validate its structure, emitting `SIGNAL:SUCCESS` or `SIGNAL:VALIDATION_FAIL`.