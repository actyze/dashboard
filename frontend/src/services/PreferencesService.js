/**
 * User Preferences Service
 * Manages user-specific schema/table preferences for recommendation boosting
 */

import { apiInstance } from './network';

const PreferencesService = {
  /**
   * Get all preferences for the current user
   */
  async getUserPreferences() {
    try {
      const response = await apiInstance.get(`/api/preferences`);
      return response.data;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      throw error;
    }
  },

  /**
   * Add a new preference
   */
  async addUserPreference(preferenceData) {
    try {
      const response = await apiInstance.post(`/api/preferences`, preferenceData);
      return response.data;
    } catch (error) {
      console.error('Failed to add user preference:', error);
      throw error;
    }
  },

  /**
   * Delete a preference
   */
  async deleteUserPreference(preferenceId) {
    try {
      const response = await apiInstance.delete(`/api/preferences/${preferenceId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete user preference:', error);
      throw error;
    }
  },

  /**
   * Update boost weight for a preference
   */
  async updatePreferenceBoost(preferenceId, boostWeight) {
    try {
      const response = await apiInstance.patch(`/api/preferences/${preferenceId}/boost`, { boost_weight: boostWeight });
      return response.data;
    } catch (error) {
      console.error('Failed to update preference boost:', error);
      throw error;
    }
  }
};

export default PreferencesService;

