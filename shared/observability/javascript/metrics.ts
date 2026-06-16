/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Performance metrics and observability tracking for browser
 */

import { observability } from './observability';

export interface Metric {
  name: string;
  value: number;
  unit?: string;
  timestamp: string;
  tags?: Record<string, string>;
}

export interface QueryMetrics {
  query: string;
  duration: number;
  rowCount: number;
  timestamp: string;
  status: 'success' | 'error';
  error?: string;
}

export interface PerformanceMetric {
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
  context?: Record<string, any>;
}

class MetricsManager {
  private metrics: Map<string, Metric[]> = new Map();
  private queryMetrics: QueryMetrics[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private maxStoredMetrics: number = 500;
  private maxStoredQueries: number = 100;

  /**
   * Track a database query execution with duration and row count
   */
  trackQuery(
    query: string,
    duration: number,
    rowCount: number,
    status: 'success' | 'error' = 'success',
    error?: string
  ): void {
    const queryMetric: QueryMetrics = {
      query: this.sanitizeQuery(query),
      duration,
      rowCount,
      timestamp: new Date().toISOString(),
      status,
      error,
    };

    this.queryMetrics.push(queryMetric);
    if (this.queryMetrics.length > this.maxStoredQueries) {
      this.queryMetrics.shift();
    }

    // Also track as generic metric
    this.trackPerformance('query_execution_time', duration, 'ms', {
      rowCount,
      status,
    });

    observability.debug('Query tracked', {
      duration,
      rowCount,
      status,
      error,
    });
  }

  /**
   * Track a performance metric with value and unit
   */
  trackPerformance(
    metricName: string,
    value: number,
    unit: string = 'ms',
    context?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      metric: metricName,
      value,
      unit,
      timestamp: new Date().toISOString(),
      context,
    };

    this.performanceMetrics.push(metric);
    if (this.performanceMetrics.length > this.maxStoredMetrics) {
      this.performanceMetrics.shift();
    }

    observability.debug('Performance metric tracked', {
      metric: metricName,
      value,
      unit,
      context,
    });
  }

  /**
   * Track API response time and status
   */
  trackApiCall(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number
  ): void {
    this.trackPerformance(`api_${method.toLowerCase()}_${statusCode}`, duration, 'ms', {
      endpoint,
      method,
      statusCode,
    });
  }

  /**
   * Track component render time using performance API
   */
  trackComponentRender(componentName: string, duration: number): void {
    this.trackPerformance(`component_render_${componentName}`, duration, 'ms', {
      componentName,
    });
  }

  /**
   * Track memory usage if available
   */
  trackMemoryUsage(): void {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      this.trackPerformance('memory_used_bytes', memory.usedJSHeapSize, 'bytes');
      this.trackPerformance('memory_limit_bytes', memory.jsHeapSizeLimit, 'bytes');
    }
  }

  /**
   * Get query metrics
   */
  getQueryMetrics(): QueryMetrics[] {
    return [...this.queryMetrics];
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetric[] {
    return [...this.performanceMetrics];
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(metricName: string): PerformanceMetric[] {
    return this.performanceMetrics.filter((m) => m.metric === metricName);
  }

  /**
   * Get summary statistics for a metric
   */
  getMetricStatistics(metricName: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.getMetricsByName(metricName);
    if (metrics.length === 0) return null;

    const values = metrics.map((m) => m.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = values[0];
    const max = values[count - 1];
    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);

    return {
      count,
      min,
      max,
      avg,
      p95: values[p95Index] || max,
      p99: values[p99Index] || max,
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.queryMetrics = [];
    this.performanceMetrics = [];
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    // Remove actual values from queries for privacy
    let sanitized = query
      .replace(/'[^']*'/g, "'***'")
      .replace(/"[^"]*"/g, '"***"')
      .replace(/\b\d+\b/g, '?');

    // Limit length
    if (sanitized.length > 500) {
      sanitized = sanitized.substring(0, 500) + '...';
    }

    return sanitized;
  }

  /**
   * Export metrics in JSON format
   */
  exportMetrics(): {
    queries: QueryMetrics[];
    performance: PerformanceMetric[];
    timestamp: string;
  } {
    return {
      queries: this.getQueryMetrics(),
      performance: this.getPerformanceMetrics(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const metrics = new MetricsManager();

/**
 * Track a database query execution with duration and row count
 */
export function trackQuery(
  query: string,
  duration: number,
  rowCount: number,
  status: 'success' | 'error' = 'success',
  error?: string
): void {
  metrics.trackQuery(query, duration, rowCount, status, error);
}

/**
 * Track a performance metric with value and unit
 */
export function trackPerformance(
  metricName: string,
  value: number,
  unit?: string,
  context?: Record<string, any>
): void {
  metrics.trackPerformance(metricName, value, unit, context);
}

/**
 * Track API response time and status
 */
export function trackApiCall(
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number
): void {
  metrics.trackApiCall(endpoint, method, duration, statusCode);
}

/**
 * Track component render time
 */
export function trackComponentRender(componentName: string, duration: number): void {
  metrics.trackComponentRender(componentName, duration);
}

/**
 * Track memory usage
 */
export function trackMemoryUsage(): void {
  metrics.trackMemoryUsage();
}

/**
 * Get query metrics
 */
export function getQueryMetrics(): QueryMetrics[] {
  return metrics.getQueryMetrics();
}

/**
 * Get performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetric[] {
  return metrics.getPerformanceMetrics();
}

/**
 * Get metrics by name
 */
export function getMetricsByName(metricName: string): PerformanceMetric[] {
  return metrics.getMetricsByName(metricName);
}

/**
 * Get metric statistics
 */
export function getMetricStatistics(metricName: string) {
  return metrics.getMetricStatistics(metricName);
}

/**
 * Clear all metrics
 */
export function clearMetrics(): void {
  metrics.clearMetrics();
}

/**
 * Export all metrics
 */
export function exportMetrics() {
  return metrics.exportMetrics();
}
