# Actyze Browser Observability Module

Browser-based observability and performance tracking module for the Actyze Dashboard frontend.

## Features

- **Browser Logging**: Structured logging with levels (debug, info, warn, error)
- **Error Tracking**: Global error and unhandled promise rejection handling
- **Performance Metrics**: Track query execution, API calls, and component rendering
- **Memory Monitoring**: Monitor JavaScript heap usage
- **Metric Statistics**: Calculate min, max, average, p95, p99 for metrics
- **Log Buffer**: In-memory log buffer for debugging and analysis
- **Development Mode**: Console output in development environment

## Installation

```bash
npm install @actyze/observability-js
```

## Quick Start

### Initialize Observability

Call `initObservability` once at application startup:

```typescript
import { initObservability } from '@actyze/observability-js';

// In your main application file (e.g., index.tsx or App.tsx)
initObservability('dashboard-frontend');
```

### Track Errors

Errors are automatically captured by global handlers, but you can also manually track errors:

```typescript
import { trackError } from '@actyze/observability-js';

try {
  // Your code
} catch (error) {
  trackError(error, { context: 'user action', userId: '123' });
}
```

### Track Queries

Log database query execution with duration and result count:

```typescript
import { trackQuery } from '@actyze/observability-js';

const startTime = performance.now();
const result = await executeQuery(sqlQuery);
const duration = performance.now() - startTime;

trackQuery(sqlQuery, duration, result.rows.length, 'success');
```

### Track Performance Metrics

Track custom performance metrics:

```typescript
import { trackPerformance } from '@actyze/observability-js';

trackPerformance('ui_interaction_latency', 45, 'ms', {
  action: 'dropdown_open',
  component: 'QueryBuilder',
});
```

### Track API Calls

Monitor API endpoint performance:

```typescript
import { trackApiCall } from '@actyze/observability-js';

const startTime = performance.now();
const response = await fetch('/api/queries', { method: 'GET' });
const duration = performance.now() - startTime;

trackApiCall('/api/queries', 'GET', duration, response.status);
```

### Track Component Rendering

Measure component render performance:

```typescript
import { trackComponentRender } from '@actyze/observability-js';

function MyComponent() {
  const renderStart = performance.now();

  // Component rendering logic
  const result = (/* JSX */);

  const renderTime = performance.now() - renderStart;
  trackComponentRender('MyComponent', renderTime);

  return result;
}
```

## API Reference

### Logging Functions

#### `initObservability(serviceName: string)`

Initialize the observability system. Must be called once at application startup.

**Parameters:**
- `serviceName` - Name of the service (e.g., 'dashboard-frontend')

**Example:**
```typescript
initObservability('dashboard-frontend');
```

#### `debug(message: string, context?: LogContext)`

Log a debug message.

#### `info(message: string, context?: LogContext)`

Log an info message.

#### `warn(message: string, context?: LogContext)`

Log a warning message.

#### `error(message: string, context?: LogContext)`

Log an error message.

#### `trackError(error: Error | string, context?: LogContext)`

Track an error with stack trace and context.

**Parameters:**
- `error` - Error object or error message string
- `context` - Additional context for the error

**Example:**
```typescript
trackError(new Error('Query failed'), {
  query: 'SELECT * FROM users',
  retries: 3,
});
```

### Metrics Functions

#### `trackQuery(query: string, duration: number, rowCount: number, status?: 'success' | 'error', error?: string)`

Track a database query execution.

**Parameters:**
- `query` - SQL query string (sanitized before storage)
- `duration` - Execution duration in milliseconds
- `rowCount` - Number of rows returned
- `status` - Query status ('success' or 'error')
- `error` - Error message if status is 'error'

**Example:**
```typescript
trackQuery(sqlQuery, 125.5, 42, 'success');
trackQuery(sqlQuery, 250, 0, 'error', 'Timeout');
```

#### `trackPerformance(metricName: string, value: number, unit?: string, context?: Record<string, any>)`

Track a custom performance metric.

**Parameters:**
- `metricName` - Name of the metric (e.g., 'query_execution_time')
- `value` - Metric value
- `unit` - Unit of measurement (default: 'ms')
- `context` - Additional context

**Example:**
```typescript
trackPerformance('dashboard_load_time', 2500, 'ms', {
  pageType: 'predictions',
  withData: true,
});
```

#### `trackApiCall(endpoint: string, method: string, duration: number, statusCode: number)`

Track an API call.

**Parameters:**
- `endpoint` - API endpoint path
- `method` - HTTP method (GET, POST, etc.)
- `duration` - Response time in milliseconds
- `statusCode` - HTTP status code

**Example:**
```typescript
trackApiCall('/api/queries', 'POST', 150, 200);
```

#### `trackComponentRender(componentName: string, duration: number)`

Track component render time.

**Parameters:**
- `componentName` - Name of the React component
- `duration` - Render time in milliseconds

**Example:**
```typescript
trackComponentRender('DataGrid', 45);
```

#### `trackMemoryUsage()`

Track current JavaScript heap memory usage (if available in browser).

### Retrieval Functions

#### `getQueryMetrics(): QueryMetrics[]`

Get all tracked query metrics.

**Returns:** Array of QueryMetrics objects

#### `getPerformanceMetrics(): PerformanceMetric[]`

Get all tracked performance metrics.

**Returns:** Array of PerformanceMetric objects

#### `getMetricsByName(metricName: string): PerformanceMetric[]`

Get metrics filtered by name.

**Parameters:**
- `metricName` - Name of the metric to retrieve

**Returns:** Array of matching PerformanceMetric objects

#### `getMetricStatistics(metricName: string)`

Get statistical summary for a metric (min, max, avg, p95, p99).

**Parameters:**
- `metricName` - Name of the metric

**Returns:** Object with count, min, max, avg, p95, p99 (or null if no metrics)

**Example:**
```typescript
const stats = getMetricStatistics('query_execution_time');
console.log(`Average query time: ${stats.avg}ms`);
console.log(`P95: ${stats.p95}ms`);
```

#### `getLogs(): LogEntry[]`

Get all logged entries from the buffer.

**Returns:** Array of LogEntry objects

#### `isObservabilityReady(): boolean`

Check if observability is initialized.

**Returns:** True if initialized, false otherwise

### Cleanup Functions

#### `clearMetrics()`

Clear all stored metrics.

#### `clearLogs()`

Clear the log buffer.

#### `exportMetrics()`

Export all metrics in JSON format.

**Returns:** Object with queries, performance metrics, and timestamp

## Types

### LogEntry

```typescript
interface LogEntry {
  timestamp: string;      // ISO 8601 timestamp
  level: string;          // 'debug' | 'info' | 'warn' | 'error'
  message: string;        // Log message
  context?: LogContext;   // Additional context
  serviceName?: string;   // Service name (set during init)
}
```

### QueryMetrics

```typescript
interface QueryMetrics {
  query: string;                  // Sanitized SQL query
  duration: number;               // Execution time in ms
  rowCount: number;               // Number of rows
  timestamp: string;              // ISO 8601 timestamp
  status: 'success' | 'error';   // Query status
  error?: string;                 // Error message if failed
}
```

### PerformanceMetric

```typescript
interface PerformanceMetric {
  metric: string;                 // Metric name
  value: number;                  // Metric value
  unit: string;                   // Unit of measurement
  timestamp: string;              // ISO 8601 timestamp
  context?: Record<string, any>; // Additional context
}
```

## Best Practices

1. **Initialize Early**: Call `initObservability()` as early as possible in your application startup.

2. **Use Appropriate Log Levels**:
   - `debug`: Detailed diagnostic information
   - `info`: General informational messages
   - `warn`: Warning conditions that should be investigated
   - `error`: Error conditions that need attention

3. **Add Meaningful Context**: Include relevant context objects to help with debugging:
   ```typescript
   info('Query executed', {
     queryId: 'q123',
     userId: 'user456',
     catalog: 'analytics',
   });
   ```

4. **Sanitize Sensitive Data**: The module automatically sanitizes queries, but be careful with other data:
   ```typescript
   // Good: Include non-sensitive context
   trackError(error, { action: 'submit', form: 'query-builder' });
   
   // Avoid: Don't include sensitive data
   // trackError(error, { password: 'secret123' });
   ```

5. **Monitor Key Metrics**:
   - Query execution times
   - API response times
   - Component render times
   - Memory usage

6. **Use Statistics for Analysis**: Use `getMetricStatistics()` to identify performance issues:
   ```typescript
   const stats = getMetricStatistics('query_execution_time');
   if (stats.p95 > 5000) {
     warn('Slow queries detected', { p95: stats.p95 });
   }
   ```

## Development vs Production

In **development mode** (`NODE_ENV=development`):
- Logs are printed to the browser console
- Full debugging information is available
- Log buffer is maintained for inspection

In **production mode**:
- Console output is suppressed
- Logs and metrics are maintained in memory
- Export metrics for server-side analysis

## Integration with Backend

Export metrics periodically and send to the backend for centralized monitoring:

```typescript
import { exportMetrics } from '@actyze/observability-js';

// Periodically send metrics to server
setInterval(() => {
  const metricsData = exportMetrics();
  
  fetch('/api/observability/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metricsData),
  }).catch(error => {
    console.error('Failed to send metrics:', error);
  });
}, 60000); // Every 60 seconds
```

## License

AGPL-3.0-only
