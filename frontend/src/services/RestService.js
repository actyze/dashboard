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

  // =============================================================================
  // Explorer API Methods
  // =============================================================================

  /**
   * Get list of all databases
   * @returns {Promise} API response containing list of databases
   */
  static async getDatabases() {
    const endpoint = '/api/explorer/databases';
    
    try {
      const response = await Network.get(endpoint);
      return response;
    } catch (error) {
      console.error('Get databases failed:', error);
      throw error;
    }
  }

  /**
   * Get schemas for a specific database
   * @param {string} database - Database name
   * @returns {Promise} API response containing list of schemas
   */
  static async getDatabaseSchemas(database) {
    const endpoint = `/api/explorer/databases/${database}/schemas`;
    
    try {
      const response = await Network.get(endpoint);
      return response;
    } catch (error) {
      console.error(`Get schemas for database ${database} failed:`, error);
      throw error;
    }
  }

  /**
   * Get objects (tables/views) for a specific schema
   * @param {string} database - Database name
   * @param {string} schema - Schema name
   * @returns {Promise} API response containing list of objects
   */
  static async getSchemaObjects(database, schema) {
    const endpoint = `/api/explorer/databases/${database}/schemas/${schema}/objects`;
    
    try {
      const response = await Network.get(endpoint);
      return response;
    } catch (error) {
      console.error(`Get objects for schema ${database}.${schema} failed:`, error);
      throw error;
    }
  }

  /**
   * Get details for a specific table
   * @param {string} database - Database name
   * @param {string} schema - Schema name
   * @param {string} table - Table name
   * @returns {Promise} API response containing table details
   */
  static async getTableDetails(database, schema, table) {
    const endpoint = `/api/explorer/databases/${database}/schemas/${schema}/tables/${table}`;
    
    try {
      const response = await Network.get(endpoint);
      return response;
    } catch (error) {
      console.error(`Get table details for ${database}.${schema}.${table} failed:`, error);
      throw error;
    }
  }

  /**
   * Search for database objects
   * @param {string} query - Search query
   * @param {string} database - Optional database filter
   * @param {string} schema - Optional schema filter
   * @param {string} objectType - Optional object type filter
   * @returns {Promise} API response containing search results
   */
  static async searchDatabaseObjects(query, database = null, schema = null, objectType = null) {
    const endpoint = '/api/explorer/search';
    const params = { query };
    
    if (database) params.database = database;
    if (schema) params.schema = schema;
    if (objectType) params.object_type = objectType;
    
    try {
      const response = await Network.get(endpoint, params);
      return response;
    } catch (error) {
      console.error('Search database objects failed:', error);
      throw error;
    }
  }
}

export default RestService;

