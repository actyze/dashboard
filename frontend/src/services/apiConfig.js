/**
 * API Configuration and utilities for all services
 */

// API Base Configuration
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080',
  TIMEOUT: 30000,
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
};

// API Response wrapper for consistent error handling
export class ApiResponse {
  constructor(data, success = true, message = '', error = null) {
    this.data = data;
    this.success = success;
    this.message = message;
    this.error = error;
  }

  static success(data, message = 'Success') {
    return new ApiResponse(data, true, message);
  }

  static error(message, error = null, data = null) {
    return new ApiResponse(data, false, message, error);
  }
}

// Generic API call wrapper with error handling
export const apiCall = async (url, options = {}) => {
  try {
    const config = {
      timeout: API_CONFIG.TIMEOUT,
      headers: API_CONFIG.HEADERS,
      ...options,
    };

    const response = await fetch(`${API_CONFIG.BASE_URL}${url}`, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return ApiResponse.success(data);
  } catch (error) {
    console.error('API call failed:', error);
    return ApiResponse.error(
      error.message || 'An error occurred while making the API call',
      error
    );
  }
};

// Mock API delay for development
export const mockDelay = (ms = 1000) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};