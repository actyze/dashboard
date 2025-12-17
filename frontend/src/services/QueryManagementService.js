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
   * Execute manual SQL and save to history
   * @param {string} sql - SQL query to execute
   * @param {number} maxResults - Max results to return
   */
  static async executeAndSaveManualQuery(sql, maxResults = 500) {
    try {
      const response = await apiInstance.post('/api/query-history/manual', {
        sql,
        max_results: maxResults
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Failed to execute manual query:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to execute query'
      };
    }
  }
  
  // ============================================
  // SAVED QUERIES - Tab 2
  // ============================================
  
  /**
   * Get favorite queries with optional filters
   * @param {Object} options - Filter options
   * @param {number} options.limit - Number of records to return (default 50)
   * @param {number} options.offset - Offset for pagination (default 0)
   * @param {boolean} options.favorites_only - Show only favorite queries
   */
  static async getSavedQueries(options = {}) {
    try {
      const { limit = 50, offset = 0, favorites_only = false } = options;
      
      const params = new URLSearchParams({ limit, offset });
      if (favorites_only) {
        params.append('favorites_only', 'true');
      }
      
      const response = await apiInstance.get(`/api/favorite-queries?${params.toString()}`);
      
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
   * Get a single favorite query by ID
   * @param {number} queryId - Favorite query ID
   */
  static async getSavedQueryById(queryId) {
    try {
      const response = await apiInstance.get(`/api/favorite-queries/${queryId}`);
      
      return {
        success: true,
        query: response.data.query
      };
    } catch (error) {
      console.error('Failed to fetch favorite query:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to fetch favorite query'
      };
    }
  }
  
  /**
   * Create a new favorite query
   * @param {Object} queryData - Query data
   * @param {string} queryData.query_name - Query name
   * @param {string} queryData.description - Query description (optional)
   * @param {string} queryData.natural_language_query - NL query (optional)
   * @param {string} queryData.generated_sql - SQL query
   * @param {Array<string>} queryData.tags - Tags (optional)
   */
  static async createSavedQuery(queryData) {
    try {
      const response = await apiInstance.post('/api/favorite-queries', queryData);
      
      return {
        success: true,
        query_id: response.data.query_id
      };
    } catch (error) {
      console.error('Failed to create favorite query:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to create favorite query'
      };
    }
  }
  
  /**
   * Update an existing favorite query
   * @param {number} queryId - Favorite query ID
   * @param {Object} updates - Fields to update
   */
  static async updateSavedQuery(queryId, updates) {
    try {
      const response = await apiInstance.put(`/api/favorite-queries/${queryId}`, updates);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Failed to update favorite query:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to update favorite query'
      };
    }
  }
  
  /**
   * Delete a favorite query
   * @param {number} queryId - Favorite query ID
   */
  static async deleteSavedQuery(queryId) {
    try {
      await apiInstance.delete(`/api/favorite-queries/${queryId}`);
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Failed to delete favorite query:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to delete favorite query'
      };
    }
  }
  
  /**
   * Save a query from history to favorite queries
   * @param {number} historyId - Query history ID
   * @param {string} queryName - Name for the favorite query
   * @param {string} description - Description (optional)
   */
  static async saveQueryFromHistory(historyId, queryName, description = '') {
    try {
      const response = await apiInstance.post(`/api/favorite-queries/from-history/${historyId}`, {
        query_name: queryName,
        description
      });
      
      return {
        success: true,
        query_id: response.data.query_id
      };
    } catch (error) {
      console.error('Failed to save query from history:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to save query'
      };
    }
  }
  
  /**
   * Toggle favorite status for a favorite query
   * @param {number} queryId - Favorite query ID
   * @param {boolean} isFavorite - New favorite status
   */
  static async toggleFavorite(queryId, isFavorite) {
    try {
      const response = await apiInstance.put(`/api/favorite-queries/${queryId}`, {
        is_favorite: isFavorite
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Failed to toggle favorite'
      };
    }
  }
}

export default QueryManagementService;

