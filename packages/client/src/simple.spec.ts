import { describe, it, expect } from 'vitest';
import { logger } from './lib/logging/logger';

describe('Isolation test suite', () => {
  it('should still perform a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should import a project module without crashing the test runner', () => {
    // This test simply verifies that the import itself was successful.
    // If the test runner fails before this test can even run,
    // we have confirmed the issue is with the module loading/transformation.
    expect(logger).toBeDefined();
  });
});