/**
 * @file vitest.setup.ts
 * @description Setup file for the Vitest test runner.
 * This file is executed before each test file, making it the perfect
 * place to extend Vitest's `expect` with custom matchers.
 */

// Import the custom matchers from testing-library/jest-dom
import '@testing-library/jest-dom/vitest';
