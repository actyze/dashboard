/**
 * Service for managing schema exclusions (hiding databases/schemas/tables globally)
 */

import apiInstance from './network';

const ExclusionService = {
  /**
   * Get all schema exclusions
   * @returns {Promise<Array>} List of exclusions
   */
  async getExclusions() {
    try {
      const response = await apiInstance.get('/v1/exclusions');
      // Handle both cases: response is data directly OR response.data contains data
      const data = Array.isArray(response) ? response : response?.data;
      return data;
    } catch (error) {
      console.error('Failed to get exclusions:', error);
      throw error;
    }
  },

  /**
   * Add a new exclusion
   * @param {Object} exclusion - Exclusion data
   * @param {string} exclusion.catalog - Catalog/database name
   * @param {string|null} exclusion.schema_name - Schema name (null for database-level)
   * @param {string|null} exclusion.table_name - Table name (null for schema-level)
   * @param {string|null} exclusion.reason - Reason for exclusion
   * @returns {Promise<Object>} Created exclusion
   */
  async addExclusion(exclusion) {
    try {
      const response = await apiInstance.post('/v1/exclusions', exclusion);
      return response.data;
    } catch (error) {
      console.error('Failed to add exclusion:', error);
      throw error;
    }
  },

  /**
   * Remove an exclusion (re-enable the resource)
   * @param {number} exclusionId - ID of exclusion to remove
   * @returns {Promise<Object>} Success message
   */
  async removeExclusion(exclusionId) {
    try {
      const response = await apiInstance.delete(`/v1/exclusions/${exclusionId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to remove exclusion:', error);
      throw error;
    }
  },

  /**
   * Check if a resource is excluded
   * @param {string} catalog - Catalog name
   * @param {string|null} schema_name - Schema name
   * @param {string|null} table_name - Table name
   * @returns {Promise<Object>} Object with is_excluded boolean
   */
  async checkExclusion(catalog, schema_name = null, table_name = null) {
    try {
      const params = { catalog };
      if (schema_name) params.schema_name = schema_name;
      if (table_name) params.table_name = table_name;
      
      const response = await apiInstance.get('/v1/exclusions/check', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to check exclusion:', error);
      throw error;
    }
  }
};

export default ExclusionService;
