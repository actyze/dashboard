/**
 * Query configuration for different services
 * This allows different cache settings per service type
 * 
 * For now, all services have caching disabled (gcTime: 0, staleTime: 0)
 * In the future, you can customize these per service:
 * 
 * Example for enabling cache:
 * graphql: {
 *   gcTime: 1000 * 60 * 10,      // 10 minutes cache
 *   staleTime: 1000 * 60 * 5,     // 5 minutes before refetch
 *   refetchOnWindowFocus: true,
 * }
 */

export const QUERY_CONFIG = {
  // GraphQL service configuration
  graphql: {
    gcTime: 0,                    // No caching
    staleTime: 0,                 // Always stale
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  },
  
  // REST API service configuration
  rest: {
    gcTime: 0,                    // No caching
    staleTime: 0,                 // Always stale
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  },
  
  // Queries service configuration
  queries: {
    gcTime: 0,                    // No caching
    staleTime: 0,                 // Always stale
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  },
};

/**
 * Get query configuration for a specific service
 * @param {string} serviceType - The service type (graphql, rest, queries)
 * @returns {object} Query configuration
 */
export const getQueryConfig = (serviceType) => {
  return QUERY_CONFIG[serviceType] || QUERY_CONFIG.rest;
};

export default QUERY_CONFIG;

