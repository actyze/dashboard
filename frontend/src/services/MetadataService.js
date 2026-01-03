/**
 * Service for managing org-level metadata descriptions
 */

import { apiInstance } from './network';

const MetadataService = {
  /**
   * Get all metadata descriptions, optionally filtered by catalog
   */
  async getDescriptions(catalog = null) {
    const params = catalog ? { catalog } : {};
    const response = await apiInstance.get('/api/metadata/descriptions', { params });
    return response.data;
  },

  /**
   * Get a specific description by ID
   */
  async getDescriptionById(id) {
    const response = await apiInstance.get(`/api/metadata/descriptions/${id}`);
    return response.data;
  },

  /**
   * Add or update a metadata description
   */
  async addDescription(data) {
    const response = await apiInstance.post('/api/metadata/descriptions', data);
    return response.data;
  },

  /**
   * Update an existing description
   */
  async updateDescription(id, description) {
    const response = await apiInstance.put(`/api/metadata/descriptions/${id}`, {
      description
    });
    return response.data;
  },

  /**
   * Delete a metadata description
   */
  async deleteDescription(id) {
    const response = await apiInstance.delete(`/api/metadata/descriptions/${id}`);
    return response.data;
  }
};

export default MetadataService;

