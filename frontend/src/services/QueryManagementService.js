import { apiInstance } from './network';

/**
 * Query Management Service
 * Handles Recent Queries (query_history) and Saved Queries operations
 */
class QueryManagementService {
  
  // ============================================
  // RECENT QUERIES (Query History) - Tab 1
  // ============================================
  
  /**
   * Get query history with optional filters
   * @param {Object} options - Filter options
   * @param {number} options.limit - Number of records to return (default 50)
   * @param {number} options.offset - Offset for pagination (default 0)
   * @param {string} options.query_type - Filter by 'natural_language' or 'manual'
   */
  static async getQueryHistory(options = {}) {
    try {
      const { limit = 50, offset = 0, query_type } = options;
      
      const params = new URLSearchParams({ limit, offset });
      if (query_type) {
        params.append('query_type', query_type);
      }
      
      const response = await apiInstance.get(`/api/query-history?${params.toString()}`);
      
      return {
        success: true,
        queries: response.data.queries || [],
        total: response.data.total || 0
      };
    } catch (error) {
      console.error('Failed to fetch query history:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to fetch query history',
        queries: []
      };
    }
  }
  
  /**
   * Rename a query in history
   * @param {number} queryId - Query history ID
   * @param {string} queryName - New query name
   */
  static async renameQuery(queryId, queryName) {
    try {
      const response = await apiInstance.patch(`/api/query-history/${queryId}/name`, {
        query_name: queryName
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Failed to rename query:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to rename query'
      };
    }
  }
  
  /**
   * Delete a query from history
   * @param {number} queryId - Query history ID
   */
  static async deleteQueryFromHistory(queryId) {
    try {
      await apiInstance.delete(`/api/query-history/${queryId}`);
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Failed to delete query:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to delete query'
      };
    }
  }
  
  /**
   * Save a new query - EXPLICIT user action (Save As New button)
   * @param {Object} queryData - Query data to save
   * @param {string} queryData.generated_sql - SQL query
   * @param {string} queryData.query_name - Query name
   * @param {string} queryData.natural_language_query - NL query (optional)
   * @param {Object} queryData.chart_recommendation - Chart config (optional)
   * @param {string} queryData.execution_status - Status (default: SUCCESS)
   * @param {number} queryData.execution_time_ms - Execution time (optional)
   * @param {number} queryData.row_count - Row count (optional)
   */
  static async saveQuery(queryData) {
    try {
      const response = await apiInstance.post('/api/query-history/save', queryData);
      
      return {
        success: true,
        query_id: response.data.query_id
      };
    } catch (error) {
      console.error('Failed to save query:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to save query'
      };
    }
  }
  
  /**
   * Update an existing query - EXPLICIT user action (Save button)
   * @param {number} queryId - Query ID to update
   * @param {Object} queryData - Query data to update (same fields as saveQuery)
   */
  static async updateQuery(queryId, queryData) {
    try {
      const response = await apiInstance.patch(`/api/query-history/${queryId}`, queryData);
      
      return {
        success: true,
        query_id: response.data.query_id
      };
    } catch (error) {
      console.error('Failed to update query:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to update query'
      };
    }
  }
  
  // ============================================
  // FAVORITES (Now unified with query history)
  // ============================================
  
  /**
   * Get favorite queries (now just query_history with favorites_only filter)
   * @param {Object} options - Filter options
   * @param {number} options.limit - Number of records to return (default 50)
   * @param {number} options.offset - Offset for pagination (default 0)
   */
  static async getSavedQueries(options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;
      
      const params = new URLSearchParams({ 
        limit, 
        offset,
        favorites_only: 'true'  // Filter for favorites only
      });
      
      const response = await apiInstance.get(`/api/query-history?${params.toString()}`);
      
      return {
        success: true,
        queries: response.data.queries || [],
        total: response.data.total || 0
      };
    } catch (error) {
      console.error('Failed to fetch favorite queries:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to fetch favorite queries',
        queries: []
      };
    }
  }
  
  /**
   * Toggle favorite status for a query history entry
   * @param {number} queryId - Query history ID
   * @param {string} favoriteName - Optional name for the favorite
   */
  static async toggleFavorite(queryId, favoriteName = null) {
    try {
      const body = favoriteName ? { favorite_name: favoriteName } : {};
      const response = await apiInstance.post(`/api/query-history/${queryId}/favorite`, body);
      
      return {
        success: true,
        is_favorite: response.data.is_favorite,
        favorite_name: response.data.favorite_name
      };
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to toggle favorite'
      };
    }
  }
  
  /**
   * Mark a query as favorite (convenience method)
   * @param {number} queryId - Query history ID
   * @param {string} favoriteName - Name for the favorite
   */
  static async saveQueryFromHistory(queryId, favoriteName, description = '') {
    // Just toggle favorite with a name
    return this.toggleFavorite(queryId, favoriteName);
  }
  
  /**
   * Delete a saved/favorite query (same as deleting from history)
   * @param {number} queryId - Query ID
   */
  static async deleteSavedQuery(queryId) {
    return this.deleteQueryFromHistory(queryId);
  }
}

export default QueryManagementService;

