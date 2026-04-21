// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Service for managing semantic table relationships (graph edges).
 * Matches the pattern of MetadataService.js and ExclusionService.js.
 */

import { apiInstance } from './network';

const RelationshipService = {
  /**
   * List relationships with optional filters
   */
  async getRelationships({ catalog, schema, table, method, includeDisabled } = {}) {
    const params = {};
    if (catalog) params.catalog = catalog;
    if (schema) params.schema = schema;
    if (table) params.table = table;
    if (method) params.method = method;
    if (includeDisabled) params.include_disabled = true;
    const response = await apiInstance.get('/relationships', { params });
    return response.data;
  },

  /**
   * Get a single relationship by ID
   */
  async getRelationshipById(id) {
    const response = await apiInstance.get(`/relationships/${id}`);
    return response.data;
  },

  /**
   * Create a new relationship (admin)
   */
  async createRelationship(data) {
    const response = await apiInstance.post('/relationships', data);
    return response.data;
  },

  /**
   * Update a relationship (admin)
   */
  async updateRelationship(id, data) {
    const response = await apiInstance.put(`/relationships/${id}`, data);
    return response.data;
  },

  /**
   * Verify a relationship — sets confidence=1.0, is_verified=true (admin)
   */
  async verifyRelationship(id) {
    const response = await apiInstance.post(`/relationships/${id}/verify`);
    return response.data;
  },

  /**
   * Disable a relationship — soft delete (admin)
   */
  async disableRelationship(id) {
    const response = await apiInstance.post(`/relationships/${id}/disable`);
    return response.data;
  },

  /**
   * Hard-delete a relationship (admin)
   */
  async deleteRelationship(id) {
    const response = await apiInstance.delete(`/relationships/${id}`);
    return response.data;
  },

  /**
   * Trigger convention-based inference (admin, runs in background)
   */
  async triggerInference(catalog, schemaName = null, tablesMetadata = null) {
    const response = await apiInstance.post('/relationships/infer', {
      catalog,
      schema_name: schemaName,
      tables_metadata: tablesMetadata,
    });
    return response.data;
  },

  /**
   * Trigger query-history mining (admin, runs in background)
   */
  async triggerMining(limit = 1000) {
    const response = await apiInstance.post('/relationships/mine', { limit });
    return response.data;
  },

  /**
   * Find join path between tables
   * @param {string[]} tables - Array of fully-qualified table names
   */
  async getJoinPath(tables) {
    const response = await apiInstance.get('/relationships/graph/path', {
      params: { tables: tables.join(',') },
    });
    return response.data;
  },
};

export default RelationshipService;
