/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * Custom hook for tracking component performance
 */

import { useEffect, useRef } from 'react';
import { trackPerformance, trackComponentRender } from '../utils/observability-init';

/**
 * Hook to track component mount time and render performance
 */
export function usePerformanceTracking(componentName: string) {
  const componentRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    const mountTime = performance.now() - startTimeRef.current;
    trackComponentRender(componentName, mountTime);

    return () => {
      // Component unmount cleanup
    };
  }, [componentName]);

  return componentRef;
}

/**
 * Hook to measure time until a specific element appears
 */
export function useLoadTimeTracking(
  featureName: string,
  elementSelector?: string
) {
  const ref = useRef<HTMLElement>(null);
  const startTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const loadTime = performance.now() - startTimeRef.current;
            trackPerformance(`feature_load_${featureName}`, loadTime, 'ms', {
              elementSelector,
              visible: true,
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [featureName, elementSelector]);

  return ref;
}

/**
 * Hook to track time until first meaningful paint
 */
export function useFirstContentfulPaint(featureName: string) {
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      trackPerformance(
        `fcp_${featureName}`,
        performance.now(),
        'ms',
        { milestone: 'first-content-paint' }
      );
      resizeObserver.disconnect();
    });

    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [featureName]);

  return contentRef;
}

/**
 * Hook to track when a data-heavy operation completes
 */
export function useOperationTracking(operationName: string) {
  const startTimeRef = useRef<number | null>(null);

  const startTracking = () => {
    startTimeRef.current = performance.now();
  };

  const endTracking = (status: 'success' | 'error' = 'success') => {
    if (startTimeRef.current === null) {
      console.warn(
        `[${operationName}] endTracking called without startTracking`
      );
      return;
    }

    const duration = performance.now() - startTimeRef.current;
    trackPerformance(`operation_${operationName}`, duration, 'ms', {
      status,
    });

    startTimeRef.current = null;
  };

  return {
    startTracking,
    endTracking,
  };
}

export default usePerformanceTracking;
