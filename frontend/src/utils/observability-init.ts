/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Observability initialization for dashboard frontend
 */

import {
  initObservability as initObservabilityCore,
  trackError as trackErrorCore,
  info,
  error,
  warn,
  debug,
  getLogs,
  clearLogs,
  isObservabilityReady,
  type LogEntry,
  type LogContext,
} from '../../shared/observability/javascript';

import {
  trackQuery as trackQueryCore,
  trackPerformance as trackPerformanceCore,
  trackApiCall as trackApiCallCore,
  trackComponentRender as trackComponentRenderCore,
  trackMemoryUsage as trackMemoryUsageCore,
  getQueryMetrics,
  getPerformanceMetrics,
  getMetricsByName,
  getMetricStatistics,
  clearMetrics,
  exportMetrics,
  type QueryMetrics,
  type PerformanceMetric,
  type Metric,
} from '../../shared/observability/javascript';

/**
 * Initialize observability for the dashboard frontend
 * Sets up logging, error tracking, and metrics collection
 */
export function initObservability(): void {
  initObservabilityCore('dashboard-frontend');
  info('Dashboard frontend observability initialized');

  // Log important browser information
  debug('Browser environment', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    onLine: navigator.onLine,
  });

  // Setup periodic memory tracking
  if ((performance as any).memory) {
    setInterval(() => {
      trackMemoryUsageCore();
    }, 30000); // Every 30 seconds
  }
}

/**
 * Error boundary tracking - call this from React Error Boundary
 */
export function trackError(error: Error | string, context?: LogContext): void {
  trackErrorCore(error, context);
}

/**
 * Track query execution with duration and row counts
 */
export function trackQuery(
  query: string,
  duration: number,
  rowCount: number,
  status: 'success' | 'error' = 'success',
  error?: string
): void {
  trackQueryCore(query, duration, rowCount, status, error);
}

/**
 * Track performance metrics with custom names
 */
export function trackPerformance(
  metricName: string,
  value: number,
  unit: string = 'ms',
  context?: Record<string, any>
): void {
  trackPerformanceCore(metricName, value, unit, context);
}

/**
 * Track API calls with method, status code, and duration
 */
export function trackApiCall(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number
): void {
  trackApiCallCore(endpoint, method, duration, statusCode);
}

/**
 * Track component render times
 */
export function trackComponentRender(componentName: string, duration: number): void {
  trackComponentRenderCore(componentName, duration);
}

/**
 * Manually track memory usage
 */
export function trackMemoryUsage(): void {
  trackMemoryUsageCore();
}

/**
 * Get all collected metrics
 */
export function getMetrics(): {
  queries: QueryMetrics[];
  performance: PerformanceMetric[];
  timestamp: string;
} {
  return exportMetrics();
}

/**
 * Get query metrics summary
 */
export function getQueryMetricsData(): QueryMetrics[] {
  return getQueryMetrics();
}

/**
 * Get performance metrics summary
 */
export function getPerformanceMetricsData(): PerformanceMetric[] {
  return getPerformanceMetrics();
}

/**
 * Get statistics for a specific metric name
 */
export function getStats(metricName: string) {
  return getMetricStatistics(metricName);
}

/**
 * Clear all metrics
 */
export function clearAllMetrics(): void {
  clearMetrics();
}

/**
 * Get all logs from the buffer
 */
export function getAllLogs(): LogEntry[] {
  return getLogs();
}

/**
 * Clear all logs
 */
export function clearAllLogs(): void {
  clearLogs();
}

/**
 * Check if observability is ready
 */
export function isReady(): boolean {
  return isObservabilityReady();
}

/**
 * Export logging functions for convenience
 */
export { info, error, warn, debug };

/**
 * Utility function to measure async operation performance
 */
export async function measureAsync<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    trackPerformance(operationName, duration, 'ms', { status: 'success' });
    return result;
  } catch (err) {
    const duration = performance.now() - startTime;
    trackPerformance(operationName, duration, 'ms', { status: 'error' });
    trackError(err instanceof Error ? err : new Error(String(err)), {
      operation: operationName,
    });
    throw err;
  }
}

/**
 * Utility function to measure synchronous operation performance
 */
export function measureSync<T>(
  operationName: string,
  operation: () => T
): T {
  const startTime = performance.now();
  try {
    const result = operation();
    const duration = performance.now() - startTime;
    trackPerformance(operationName, duration, 'ms', { status: 'success' });
    return result;
  } catch (err) {
    const duration = performance.now() - startTime;
    trackPerformance(operationName, duration, 'ms', { status: 'error' });
    trackError(err instanceof Error ? err : new Error(String(err)), {
      operation: operationName,
    });
    throw err;
  }
}
