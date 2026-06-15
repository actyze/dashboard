/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Main export for Actyze observability module
 */

// Observability exports
export {
  observability,
  initObservability,
  trackError,
  debug,
  info,
  warn,
  error,
  getLogs,
  clearLogs,
  isObservabilityReady,
  type LogEntry,
  type LogContext,
} from './observability';

// Metrics exports
export {
  metrics,
  trackQuery,
  trackPerformance,
  trackApiCall,
  trackComponentRender,
  trackMemoryUsage,
  getQueryMetrics,
  getPerformanceMetrics,
  getMetricsByName,
  getMetricStatistics,
  clearMetrics,
  exportMetrics,
  type QueryMetrics,
  type PerformanceMetric,
  type Metric,
} from './metrics';
