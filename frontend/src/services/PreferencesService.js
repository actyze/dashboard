/**
 * User Preferences Service
 * Manages user-specific preferred tables for AI query prioritization
 */

import { apiInstance } from './network';

const PreferencesService = {
  // ============================================================================
  // Preferred Tables API
  // ============================================================================

  /**
   * Get all preferred tables for the current user
   * Returns list of tables with full metadata (columns, descriptions)
   */
  async getPreferredTables() {
    try {
      const response = await apiInstance.get(`/preferences/preferred-tables`);
      return response.data;
    } catch (error) {
      console.error('Failed to get preferred tables:', error);
      throw error;
    }
  },

  /**
   * Add a table to user's preferred list
   * @param {string} catalog - Database catalog
   * @param {string} schema - Schema name
   * @param {string} table - Table name
   */
  async addPreferredTable(catalog, schema, table) {
    try {
      const response = await apiInstance.post(`/preferences/preferred-tables`, {
        catalog,
        schema,
        table
      });
      return response.data;
    } catch (error) {
      console.error('Failed to add preferred table:', error);
      throw error;
    }
  },

  /**
   * Remove a table from user's preferred list
   * @param {string} preferenceId - Preference ID
   */
  async removePreferredTable(preferenceId) {
    try {
      const response = await apiInstance.delete(`/preferences/preferred-tables/${preferenceId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to remove preferred table:', error);
      throw error;
    }
  },

  /**
   * Bulk add multiple tables to preferred list (single API call)
   * @param {Array} tables - Array of {catalog, database_name, schema_name, table_name}
   */
  async bulkAddPreferredTables(tables) {
    try {
      const response = await apiInstance.post(`/preferences/preferred-tables/bulk`, { tables });
      return response.data;
    } catch (error) {
      console.error('Failed to bulk add preferred tables:', error);
      throw error;
    }
  },

  /**
   * Bulk remove multiple tables from preferred list (single API call)
   * @param {Array} preferenceIds - Array of preference ID strings
   */
  async bulkRemovePreferredTables(preferenceIds) {
    try {
      const response = await apiInstance.delete(`/preferences/preferred-tables/bulk`, {
        data: { preference_ids: preferenceIds }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to bulk remove preferred tables:', error);
      throw error;
    }
  }
};

export default PreferencesService;

