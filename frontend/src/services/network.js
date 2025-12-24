import axios from 'axios';
import { API_CONFIG } from './apiConfig';

/**
 * Network service for making HTTP requests with automatic token refresh
 */

// Axios instance for API calls
export const apiInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
  paramsSerializer: {
    indexes: null,
  },
});

// ═══════════════════════════════════════════════════════════════════
// REQUEST INTERCEPTOR: Add auth token to all requests
// ═══════════════════════════════════════════════════════════════════
apiInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ═══════════════════════════════════════════════════════════════════
// RESPONSE INTERCEPTOR: Handle automatic token refresh (sliding session)
// ═══════════════════════════════════════════════════════════════════
apiInstance.interceptors.response.use(
  (response) => {
    // Check if server sent a new token (sliding session)
    const newToken = response.headers['x-new-token'];
    const tokenRefreshed = response.headers['x-token-refreshed'];
    
    if (tokenRefreshed === 'true' && newToken) {
      console.log('🔄 Token refreshed automatically (sliding session)');
      localStorage.setItem('token', newToken);
      
      // Update axios default headers with new token for subsequent requests
      apiInstance.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    }
    
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized (token expired)
    if (error.response?.status === 401) {
      console.log('🔒 Session expired - redirecting to login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login page (only if not already there)
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * Network class with helper methods for common HTTP operations
 */
export class Network {
  /**
   * Make a GET request
   * @param {string} url - API endpoint
   * @param {object} params - Query parameters
   * @returns {Promise} API response
   */
  static async get(url, params = {}) {
    try {
      const response = await apiInstance.get(url, { params });
      return response.data;
    } catch (error) {
      console.error(`GET ${url} failed:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Make a POST request
   * @param {string} url - API endpoint
   * @param {object} data - Request body
   * @returns {Promise} API response
   */
  static async post(url, data = {}) {
    try {
      const response = await apiInstance.post(url, data);
      return response.data;
    } catch (error) {
      console.error(`POST ${url} failed:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Make a PUT request
   * @param {string} url - API endpoint
   * @param {object} data - Request body
   * @returns {Promise} API response
   */
  static async put(url, data = {}) {
    try {
      const response = await apiInstance.put(url, data);
      return response.data;
    } catch (error) {
      console.error(`PUT ${url} failed:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Make a PATCH request
   * @param {string} url - API endpoint
   * @param {object} data - Request body
   * @returns {Promise} API response
   */
  static async patch(url, data = {}) {
    try {
      const response = await apiInstance.patch(url, data);
      return response.data;
    } catch (error) {
      console.error(`PATCH ${url} failed:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Make a DELETE request
   * @param {string} url - API endpoint
   * @returns {Promise} API response
   */
  static async delete(url) {
    try {
      const response = await apiInstance.delete(url);
      return response.data;
    } catch (error) {
      console.error(`DELETE ${url} failed:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Handle and format errors
   * @param {object} error - Axios error object
   * @returns {Error} Formatted error
   */
  static handleError(error) {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || 
                     error.response.data?.error || 
                     error.message || 
                     'An error occurred';
      
      const err = new Error(message);
      err.status = error.response.status;
      err.data = error.response.data;
      return err;
    } else if (error.request) {
      // Request made but no response received
      const err = new Error('No response from server. Please check your connection.');
      err.status = 0;
      return err;
    } else {
      // Error in request setup
      return error;
    }
  }
}

export default Network;
