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
   * Bulk remove exclusions (unhide multiple resources at once)
   * @param {Array<number>} exclusionIds - Array of exclusion IDs to remove
   * @returns {Promise<Object>} Result with removed_count, errors, removed_exclusions
   */
  async bulkRemoveExclusions(exclusionIds) {
    try {
      // Use query params (not body) — DELETE with body is stripped by nginx proxy
      const params = new URLSearchParams();
      exclusionIds.forEach(id => params.append('ids', id));
      const response = await apiInstance.delete(`/v1/exclusions/bulk?${params.toString()}`);
      const data = response?.data !== undefined ? response.data : response;
      return data;
    } catch (error) {
      console.error('Failed to bulk remove exclusions:', error);
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
  },

  /**
   * Bulk add exclusions (hide multiple resources at once)
   * @param {Array<Object>} exclusions - Array of exclusion objects
   * @param {string} exclusions[].catalog - Catalog/database name
   * @param {string|null} exclusions[].schema_name - Schema name
   * @param {string|null} exclusions[].table_name - Table name
   * @param {string|null} exclusions[].reason - Optional reason
   * @returns {Promise<Object>} Result with created_count, skipped_count, errors
   */
  async bulkAddExclusions(exclusions) {
    try {
      const response = await apiInstance.post('/v1/exclusions/bulk', { exclusions });
      // Handle both cases: response is data directly OR response.data contains data
      const data = response?.data !== undefined ? response.data : response;
      return data;
    } catch (error) {
      console.error('Failed to bulk add exclusions:', error);
      throw error;
    }
  }
};

export default ExclusionService;
