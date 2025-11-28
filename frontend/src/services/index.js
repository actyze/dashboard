/**
 * Services Index - Central export for all API services
 */

export { QueriesService } from './QueriesService';
export { QueryExecutionService } from './QueryExecutionService';
export { AIService } from './AIService';
export { GraphQLService } from './GraphQLService';
export { API_CONFIG, ApiResponse, apiCall, mockDelay } from './apiConfig';
export { Network, apiInstance } from './network';

// Service configuration
export const SERVICES_CONFIG = {
  // Toggle between mock and real API calls
  USE_MOCK_DATA: process.env.REACT_APP_USE_MOCK_DATA !== 'false',
  
  // Service endpoints (for when switching to real APIs)
  ENDPOINTS: {
    QUERIES: '/api/queries',
    EXECUTE: '/api/execute',
    AI_CONVERT: '/api/ai/convert',
    AI_EXPLAIN: '/api/ai/explain',
    EXPORT: '/api/export',
    HISTORY: '/api/history'
  },
  
  // Default pagination settings
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 25,
    MAX_PAGE_SIZE: 100
  },
  
  // Cache settings
  CACHE: {
    QUERIES_TTL: 5 * 60 * 1000, // 5 minutes
    RESULTS_TTL: 10 * 60 * 1000, // 10 minutes
    AI_SUGGESTIONS_TTL: 30 * 60 * 1000 // 30 minutes
  }
};

// Utility function to check if services are in mock mode
export const isMockMode = () => SERVICES_CONFIG.USE_MOCK_DATA;

// Service health check utility
export const checkServiceHealth = async () => {
  try {
    // Import services dynamically to avoid circular dependency issues
    const { QueriesService } = await import('./QueriesService');
    const { QueryExecutionService } = await import('./QueryExecutionService');
    const { AIService } = await import('./AIService');

    const healthChecks = await Promise.allSettled([
      QueriesService.getAllQueries({ limit: 1 }),
      QueryExecutionService.validateQuery('SELECT 1'),
      AIService.getModelInfo()
    ]);

    return {
      queries: healthChecks[0].status === 'fulfilled',
      execution: healthChecks[1].status === 'fulfilled', 
      ai: healthChecks[2].status === 'fulfilled',
      overall: healthChecks.every(check => check.status === 'fulfilled'),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      queries: false,
      execution: false,
      ai: false,
      overall: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};