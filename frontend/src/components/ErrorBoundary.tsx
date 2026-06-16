/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Error boundary for tracking and displaying errors
 */

import React, { ReactNode } from 'react';
import { trackError } from '../utils/observability-init';
import { error as logError } from '../utils/observability-init';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that catches errors in the component tree
 * and logs them to observability
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Track the error to observability
    trackError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    logError('Error caught by boundary', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-900">
          <div className="max-w-md w-full space-y-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">
                Something went wrong
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                An unexpected error occurred. Our team has been notified.
              </p>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="bg-red-100 dark:bg-red-800 p-4 rounded text-sm">
                <summary className="font-mono font-bold cursor-pointer">Error details</summary>
                <pre className="mt-2 overflow-auto text-xs">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
