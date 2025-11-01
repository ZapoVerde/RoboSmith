/**
 * @file packages/client/src/extension.spec.ts
 * @stamp S-20251101-T133500Z-V-TYPED
 * @test-target packages/client/src/extension.ts
 * @description Verifies the extension's activation logic, ensuring services are initialized and commands are registered correctly.
 * @criticality The test target is CRITICAL as it is the application's entry point.
 * @testing-layer Integration
 *
 * @contract
 *   assertions:
 *     - Mocks all external dependencies (vscode, services, logger).
 *     - Verifies correct instantiation and initialization of services.
 *     - Verifies registration of the primary user-facing command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import * as vscode from 'vscode';
import { activate } from './extension';
import { SecureStorageService } from './lib/ai/SecureStorageService';
import { logger } from './lib/logging/logger';

// --- Type alias for the complex mock return type to keep it clean ---
type ApiPoolManagerMock = {
  initialize: Mock<() => void>;
};

// --- Hoisting-Safe Mocks for Dependencies ---

// Declare variables for our mock functions with the correct signature-based types.
let mockInitialize: Mock<() => void>;
let mockGetInstance: Mock<(service: SecureStorageService) => ApiPoolManagerMock>;

vi.mock('./lib/ai/ApiPoolManager', () => ({
  ApiPoolManager: {
    getInstance: (...args: [SecureStorageService]) => mockGetInstance(...args),
  },
}));

vi.mock('./lib/logging/logger', () => ({
  logger: {
    initialize: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('./lib/ai/SecureStorageService');

vi.mock('vscode', () => ({
  ExtensionMode: {
    Production: 1,
    Development: 2,
    Test: 3,
  },
  commands: {
    registerCommand: vi.fn(),
  },
  window: {
    createWebviewPanel: vi.fn(() => ({
      webview: {
        onDidReceiveMessage: vi.fn(),
        html: '',
      },
    })),
    createOutputChannel: vi.fn(),
  },
  ViewColumn: {
    One: 1,
  },
  default: {},
}));

describe('activate', () => {
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize mock functions with the correct signature-based generic.
    mockInitialize = vi.fn<() => void>();
    mockGetInstance = vi.fn<
      (service: SecureStorageService) => ApiPoolManagerMock
    >().mockReturnValue({
      initialize: mockInitialize,
    });

    // Setup a reusable mock context for all tests in this suite.
    mockContext = {
      extensionMode: vscode.ExtensionMode.Test,
      secrets: {} as vscode.SecretStorage,
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;
  });

  it('should initialize the logger and services on activation', async () => {
    // Act
    await activate(mockContext);

    // Assert: Logger Initialization
    expect(logger.initialize).toHaveBeenCalledWith(mockContext.extensionMode);

    // Assert: Service Initialization
    const secureStorageInstance = vi.mocked(SecureStorageService).mock.instances[0];
    expect(SecureStorageService).toHaveBeenCalledWith(mockContext.secrets);
    expect(mockGetInstance).toHaveBeenCalledWith(secureStorageInstance);
    expect(mockInitialize).toHaveBeenCalledOnce();
  });

  it('should register the roboSmith.showPanel command', async () => {
    // Act
    await activate(mockContext);

    // Assert: Command Registration
    const mockedRegisterCommand = vi.mocked(vscode.commands.registerCommand);
    expect(mockedRegisterCommand).toHaveBeenCalledOnce();
    expect(mockedRegisterCommand).toHaveBeenCalledWith(
      'roboSmith.showPanel',
      expect.any(Function)
    );
  });
});