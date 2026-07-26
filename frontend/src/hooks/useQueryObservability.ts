/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Custom hook for tracking query execution with observability
 */

import { useCallback } from 'react';
import {
  trackQuery,
  trackApiCall,
  trackError,
  error as logError,
} from '../utils/observability-init';

interface QueryOptions {
  trackMetrics?: boolean;
  logErrors?: boolean;
}

/**
 * Custom hook for executing queries with automatic observability tracking
 */
export function useQueryObservability() {
  const executeQuery = useCallback(
    async (
      sql: string,
      executeFunction: (query: string) => Promise<{ data: any[]; error?: Error }>,
      options: QueryOptions = { trackMetrics: true, logErrors: true }
    ) => {
      const startTime = performance.now();

      try {
        const result = await executeFunction(sql);

        const duration = performance.now() - startTime;
        const rowCount = Array.isArray(result.data) ? result.data.length : 0;

        if (options.trackMetrics !== false) {
          trackQuery(sql, duration, rowCount, 'success');
        }

        return result;
      } catch (err) {
        const duration = performance.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : String(err);

        if (options.trackMetrics !== false) {
          trackQuery(sql, duration, 0, 'error', errorMessage);
        }

        if (options.logErrors !== false) {
          trackError(err instanceof Error ? err : new Error(errorMessage), {
            query: sql,
            duration,
          });
          logError('Query execution failed', {
            error: errorMessage,
            duration,
          });
        }

        throw err;
      }
    },
    []
  );

  const executeApiCall = useCallback(
    async (
      endpoint: string,
      method: string,
      executeFunction: () => Promise<any>,
      options: QueryOptions = { trackMetrics: true, logErrors: true }
    ) => {
      const startTime = performance.now();

      try {
        const result = await executeFunction();
        const duration = performance.now() - startTime;

        if (options.trackMetrics !== false) {
          trackApiCall(endpoint, method, duration, 200);
        }

        return result;
      } catch (err) {
        const duration = performance.now() - startTime;
        const statusCode = (err as any)?.response?.status || 500;

        if (options.trackMetrics !== false) {
          trackApiCall(endpoint, method, duration, statusCode);
        }

        if (options.logErrors !== false) {
          trackError(err instanceof Error ? err : new Error(String(err)), {
            endpoint,
            method,
            statusCode,
            duration,
          });
        }

        throw err;
      }
    },
    []
  );

  return {
    executeQuery,
    executeApiCall,
  };
}

export default useQueryObservability;
