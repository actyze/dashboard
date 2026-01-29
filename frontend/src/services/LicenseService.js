/**
 * License Management Service - Simplified
 * API client for Actyze licensing system
 */

import { apiInstance } from './network';

const LicenseService = {
  /**
   * Get current active license (Admin only)
   * @returns {Promise<Object>} Active license details
   */
  async getCurrentLicense() {
    try {
      const response = await apiInstance.get('/v1/license/current');
      return response.data || response;
    } catch (error) {
      console.error('Failed to get current license:', error);
      throw error;
    }
  },

  /**
   * Activate a license key (Admin only)
   * @param {string} licenseKey - 64-character license key
   * @returns {Promise<Object>} Activation result
   */
  async activateLicense(licenseKey) {
    try {
      const response = await apiInstance.post('/v1/license/activate', {
        license_key: licenseKey
      });
      return response.data || response;
    } catch (error) {
      console.error('Failed to activate license:', error);
      throw error;
    }
  },

  /**
   * Validate current license (Admin only)
   * @param {boolean} force - Force validation even if recently validated
   * @returns {Promise<Object>} Validation result
   */
  async validateLicense(force = false) {
    try {
      const response = await apiInstance.post(`/v1/license/validate?force=${force}`);
      return response.data || response;
    } catch (error) {
      console.error('Failed to validate license:', error);
      throw error;
    }
  },

  /**
   * Get current plan limits
   * @returns {Promise<Object>} Current plan details
   */
  async getCurrentPlan() {
    try {
      const response = await apiInstance.get('/v1/license/plans/current');
      return response.data || response;
    } catch (error) {
      console.error('Failed to get current plan:', error);
      throw error;
    }
  },

  /**
   * Format plan name for display
   * @param {string} planType - Plan type enum value
   * @returns {string} Formatted plan name
   */
  formatPlanName(planType) {
    const names = {
      FREE: 'Free',
      SMALL: 'Small',
      MEDIUM: 'Medium',
      LARGE_ENTERPRISE: 'Large Enterprise',
      MANAGED_SERVICE: 'Managed Service'
    };
    return names[planType] || planType;
  },

  /**
   * Get plan badge color
   * @param {string} planType - Plan type enum value
   * @returns {string} Tailwind color class
   */
  getPlanBadgeColor(planType) {
    const colors = {
      FREE: 'bg-gray-500',
      SMALL: 'bg-blue-500',
      MEDIUM: 'bg-purple-500',
      LARGE_ENTERPRISE: 'bg-yellow-500',
      MANAGED_SERVICE: 'bg-green-500'
    };
    return colors[planType] || 'bg-gray-500';
  },

  /**
   * Get license status badge color
   * @param {string} status - License status
   * @returns {string} Tailwind color class
   */
  getStatusBadgeColor(status) {
    const colors = {
      ACTIVE: 'bg-green-500',
      DISABLED: 'bg-gray-500',
      EXPIRED: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  },

  /**
   * Validate license key with marketing dashboard API (external validation)
   * @param {string} licenseKey - 64-character license key
   * @returns {Promise<Object>} Full license and plan details from marketing dashboard
   */
  async validateLicenseWithMarketingAPI(licenseKey) {
    try {
      // Marketing dashboard API URL - should be set in env variables
      const API_URL = process.env.REACT_APP_LICENSE_API_URL || 'https://actyze.ai/api/validate-license';
      const API_KEY = process.env.REACT_APP_LICENSE_API_KEY || '8f3a7c2e9b4d6f1a5c8e3b7d2f9a4c6e1b8d3f7a5c2e9b6d4f1a8c7e3b5d2f9a';

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          license_key: licenseKey,
          increment_usage: false // Don't increment usage count for validation
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to validate license with marketing API:', error);
      throw error;
    }
  }
};

export default LicenseService;
