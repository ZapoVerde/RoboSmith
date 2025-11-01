/**
 * @file packages/client/src/lib/logging/logger.ts
 * @stamp S-20251101-T132000Z-C-REVISED
 * @architectural-role Utility
 * @description Implements a centralized, level-based, singleton logger that integrates with the VS Code Output Channel. It is the single, authoritative source for all backend logging.
 * @core-principles
 * 1. IS the exclusive gateway for all diagnostic logging.
 * 2. MUST direct all output to a dedicated VS Code Output Channel.
 * 3. OWNS the logic for filtering messages based on the extension's run mode (Development vs. Production).
 * 4. MUST be initialized once at startup with the extension's mode.
 */

import * as vscode from 'vscode';

/**
 * Defines the available logging levels, ordered by severity.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

// Private static instance for the singleton pattern.
let instance: Logger | undefined;

/**
 * A singleton class that provides a structured, level-based logging service
 * integrated with a dedicated VS Code Output Channel.
 */
export class Logger {
  private outputChannel: vscode.OutputChannel;
  private currentLevel: LogLevel = LogLevel.INFO; // Default before initialization.
  private isInitialized = false;

  // Private constructor to enforce the singleton pattern.
  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('RoboSmith');
  }

  /**
   * Gets the single instance of the Logger.
   */
  public static getInstance(): Logger {
    if (!instance) {
      instance = new Logger();
    }
    return instance;
  }

  /**
   * Initializes the logger's level based on the extension's run mode.
   * This method should only be called once at startup.
   * @param mode The current vscode.ExtensionMode.
   */
  public initialize(mode: vscode.ExtensionMode): void {
    if (this.isInitialized) {
      this.warn('Logger already initialized. Ignoring subsequent calls.');
      return;
    }

    if (mode === vscode.ExtensionMode.Development) {
      this.currentLevel = LogLevel.DEBUG;
    } else {
      this.currentLevel = LogLevel.INFO;
    }
    this.isInitialized = true;
    this.info(`Logger initialized in ${vscode.ExtensionMode[mode]} mode. Level set to: ${LogLevel[this.currentLevel]}`);
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.currentLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelString = LogLevel[level].padEnd(5, ' ');
    let formattedMessage = `[${timestamp}] [${levelString}] ${message}`;

    if (context && Object.keys(context).length > 0) {
      formattedMessage += `\n${JSON.stringify(context, null, 2)}`;
    }

    this.outputChannel.appendLine(formattedMessage);
  }
}

/**
 * The singleton instance of the logger for consumption throughout the application.
 */
export const logger = Logger.getInstance();