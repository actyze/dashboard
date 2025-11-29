import { Network } from './network';

/**
 * REST Service for making API requests to Nexus
 * Handles the 2-step NL-to-SQL workflow
 */
export class RestService {
  /**
   * Generate SQL from natural language query
   * @param {string} nlQuery - Natural language query
   * @param {Array} conversationHistory - Previous conversation messages (optional)
   * @returns {Promise} API response containing generated SQL
   */
  static async generateSql(nlQuery, conversationHistory = []) {
    const endpoint = '/api/generate-sql';
    const payload = {
      nl_query: nlQuery,
      conversation_history: conversationHistory
    };

    try {
      // Use the Network class which uses axios configured with BASE_URL
      const response = await Network.post(endpoint, payload);
      return response;
    } catch (error) {
      console.error('Generate SQL failed:', error);
      throw error;
    }
  }

  /**
   * Execute SQL query directly
   * @param {string} sql - SQL query to execute
   * @param {number} maxResults - Maximum number of results to return (default: 100)
   * @param {number} timeoutSeconds - Timeout for execution in seconds (default: 30)
   * @returns {Promise} API response containing query results
   */
  static async executeSql(sql, maxResults = 100, timeoutSeconds = 30, nlQuery = null, conversationHistory = []) {
    const endpoint = '/api/execute-sql';
    const payload = {
      sql,
      max_results: maxResults,
      timeout_seconds: timeoutSeconds,
      nl_query: nlQuery,
      conversation_history: conversationHistory
    };

    try {
      const response = await Network.post(endpoint, payload);
      return response;
    } catch (error) {
      console.error('Execute SQL failed:', error);
      throw error;
    }
  }
}

export default RestService;

