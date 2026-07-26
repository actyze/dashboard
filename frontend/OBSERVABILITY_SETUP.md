# Frontend Observability Setup Guide

This document provides step-by-step instructions for setting up and using observability in the dashboard frontend.

## What Was Added

### 1. Core Observability Module
- **Location**: `src/utils/observability-init.ts`
- **Purpose**: Wrapper around shared observability module with frontend-specific utilities
- **Exports**:
  - `initObservability()` - Initialize observability on app startup
  - `trackError()` - Track errors from try/catch blocks
  - `trackQuery()` - Track SQL query execution
  - `trackPerformance()` - Track custom performance metrics
  - `trackApiCall()` - Track API request metrics
  - `trackComponentRender()` - Track component render times
  - `trackMemoryUsage()` - Track memory consumption
  - `measureAsync()` - Measure async operation duration
  - `measureSync()` - Measure sync operation duration
  - `getMetrics()` - Export all collected metrics
  - Logging functions: `info()`, `warn()`, `error()`, `debug()`

### 2. Error Boundary Component
- **Location**: `src/components/ErrorBoundary.tsx`
- **Purpose**: Catch React component errors and track them
- **Features**:
  - Catches rendering errors
  - Tracks error with component stack
  - Shows user-friendly error message
  - Shows error details in development mode

### 3. Custom Hooks for Performance Tracking
- **Location**: `src/hooks/usePerformanceTracking.ts`
- **Hooks**:
  - `usePerformanceTracking()` - Track component mount time
  - `useLoadTimeTracking()` - Track when content becomes visible
  - `useFirstContentfulPaint()` - Track first meaningful render
  - `useOperationTracking()` - Track manual start/stop operations

### 4. Custom Hooks for Query Tracking
- **Location**: `src/hooks/useQueryObservability.ts`
- **Hooks**:
  - `useQueryObservability()` - Execute queries with automatic tracking
  - Returns `executeQuery()` and `executeApiCall()` methods

### 5. Documentation
- **OBSERVABILITY_GUIDE.md** - Comprehensive usage guide
- **OBSERVABILITY_EXAMPLES.md** - Real-world implementation examples
- **OBSERVABILITY_SETUP.md** - This file

### 6. Updated Entry Point
- **src/index.js** - Updated to:
  - Initialize observability on app startup
  - Wrap app with ErrorBoundary

## Getting Started

### Step 1: Verify Setup

The observability infrastructure is already initialized in `src/index.js`. On app startup:

```bash
npm start
```

Check the browser console (should see observability initialization logs).

### Step 2: Add Error Boundary to Feature

Wrap critical feature sections with the error boundary:

```typescript
import ErrorBoundary from '../components/ErrorBoundary';

<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

### Step 3: Track Query Execution

For components that execute SQL queries:

```typescript
import { useQueryObservability } from '../hooks/useQueryObservability';

function MyQueryComponent() {
  const { executeQuery } = useQueryObservability();

  const handleQuery = async (sql) => {
    const result = await executeQuery(
      sql,
      async (query) => {
        return await apiClient.execute(query);
      }
    );
  };
}
```

### Step 4: Track Component Performance

```typescript
import { usePerformanceTracking } from '../hooks/usePerformanceTracking';

function Dashboard() {
  const ref = usePerformanceTracking('Dashboard');
  return <div ref={ref}>Content</div>;
}
```

## File Structure

```
frontend/
├── src/
│   ├── index.js (UPDATED)
│   ├── components/
│   │   └── ErrorBoundary.tsx (NEW)
│   ├── hooks/
│   │   ├── usePerformanceTracking.ts (NEW)
│   │   └── useQueryObservability.ts (NEW)
│   ├── utils/
│   │   └── observability-init.ts (NEW)
│   ├── OBSERVABILITY_GUIDE.md (NEW)
│   └── OBSERVABILITY_EXAMPLES.md (NEW)
└── OBSERVABILITY_SETUP.md (NEW)
```

## Key Features

- **Global Error Tracking**: Automatic unhandled error and promise rejection tracking
- **Error Boundaries**: Component-level error handling
- **Query Metrics**: Duration and row count tracking for SQL execution
- **API Tracking**: Endpoint, method, duration, and status code tracking
- **Performance Metrics**: Custom performance tracking with units and context
- **Component Tracking**: Render time and load time measurement
- **Memory Monitoring**: Periodic memory usage tracking
- **Structured Logging**: Context-rich logging with timestamps
- **Console Output**: Development logging to console, production buffering
- **Statistics**: P50, P95, P99 calculations for metrics

## Next Steps

1. Import observability in your components
2. Use `usePerformanceTracking` to track component mount times
3. Use `useQueryObservability` for query execution
4. Wrap features with `<ErrorBoundary>`
5. Use logging functions for important events

Refer to OBSERVABILITY_GUIDE.md for detailed usage information.
