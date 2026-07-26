/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Browser-based observability and logging for Actyze Dashboard
 */

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: LogContext;
  serviceName?: string;
}

class ObservabilityManager {
  private serviceName: string = '';
  private isInitialized: boolean = false;
  private logBuffer: LogEntry[] = [];
  private maxLogBufferSize: number = 100;
  private isDevelopment: boolean = false;

  /**
   * Initialize observability for the browser application.
   * Sets up logging infrastructure and error handlers.
   */
  initObservability(serviceName: string): void {
    this.serviceName = serviceName;
    this.isDevelopment = process.env.NODE_ENV === 'development';

    // Setup global error handler
    window.addEventListener('error', (event) => {
      this.trackError(event.error);
    });

    // Setup unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(event.reason);
    });

    this.isInitialized = true;
    this.info('Observability initialized', { serviceName });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  /**
   * Internal logging function
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: LogContext
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      serviceName: this.serviceName,
    };

    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxLogBufferSize) {
      this.logBuffer.shift();
    }

    // Log to console in development
    if (this.isDevelopment) {
      const logFn = console[level] || console.log;
      logFn(`[${entry.serviceName}] ${message}`, context || '');
    }
  }

  /**
   * Track an error event with context and stack trace
   */
  trackError(error: Error | string, context?: LogContext): void {
    let errorMessage: string;
    let stack: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      stack = error.stack;
    } else {
      errorMessage = String(error);
    }

    const errorContext: LogContext = {
      ...context,
      errorMessage,
      stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.error('Error tracked', errorContext);
  }

  /**
   * Get the current log buffer
   */
  getLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Clear the log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Check if observability is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const observability = new ObservabilityManager();

/**
 * Track an error event
 */
export function trackError(error: Error | string, context?: LogContext): void {
  observability.trackError(error, context);
}

/**
 * Initialize observability for the application
 */
export function initObservability(serviceName: string): void {
  observability.initObservability(serviceName);
}

/**
 * Log a debug message
 */
export function debug(message: string, context?: LogContext): void {
  observability.debug(message, context);
}

/**
 * Log an info message
 */
export function info(message: string, context?: LogContext): void {
  observability.info(message, context);
}

/**
 * Log a warning message
 */
export function warn(message: string, context?: LogContext): void {
  observability.warn(message, context);
}

/**
 * Log an error message
 */
export function error(message: string, context?: LogContext): void {
  observability.error(message, context);
}

/**
 * Get the current log buffer
 */
export function getLogs(): LogEntry[] {
  return observability.getLogs();
}

/**
 * Clear the log buffer
 */
export function clearLogs(): void {
  observability.clearLogs();
}

/**
 * Check if observability is initialized
 */
export function isObservabilityReady(): boolean {
  return observability.isReady();
}
