/**
 * Services Index - Central export for all API services
 * 
 * Note: Services contain only pure API call logic.
 * For data fetching in components, use React Query hooks from /hooks instead.
 */

export { QueriesService } from './QueriesService';
export { QueryExecutionService } from './QueryExecutionService';
export { GraphQLService } from './GraphQLService';
export { RestService } from './RestService';
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
    EXPORT: '/api/export',
    HISTORY: '/api/history'
  },
  
  // Default pagination settings
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 25,
    MAX_PAGE_SIZE: 100
  }
};

// Utility function to check if services are in mock mode
export const isMockMode = () => SERVICES_CONFIG.USE_MOCK_DATA;