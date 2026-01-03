/**
 * File Upload Service
 * Handles file upload API calls
 */

import { apiInstance } from './network';

const FileUploadService = {
  /**
   * Upload a file (CSV or Excel)
   */
  async uploadFile(formData) {
    const response = await apiInstance.post('/api/file-uploads/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Get list of user's uploaded tables
   */
  async getUserTables() {
    const response = await apiInstance.get('/api/file-uploads/tables');
    return response.data.tables || [];
  },

  /**
   * Delete (truncate) a user's uploaded table
   */
  async deleteTable(tableId) {
    const response = await apiInstance.delete(`/api/file-uploads/tables/${tableId}`);
    return response.data;
  },

  /**
   * Trigger cleanup of expired tables (admin)
   */
  async cleanupExpiredTables() {
    const response = await apiInstance.post('/api/file-uploads/cleanup-expired');
    return response.data;
  },
};

export default FileUploadService;

