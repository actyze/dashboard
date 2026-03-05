import { Network, apiInstance } from './network';

/**
 * REST Service for making API requests to Nexus
 * Handles the 2-step NL-to-SQL workflow
 */
export class RestService {
  /**
   * Generate SQL from natural language query (with ML-based intent detection)
   * @param {string} nlQuery - Natural language query
   * @param {Array} conversationHistory - Previous conversation messages (optional)
   * @param {Object} context - Context for intent-aware schema reuse (optional)
   * @param {string} context.sessionId - Session ID for state tracking
   * @param {string} context.lastSql - Last generated SQL (for refinements)
   * @param {Array} context.lastSchemaRecommendations - Last schema recommendations (for refinements)
   * @returns {Promise} API response containing generated SQL
   */
  static async generateSql(nlQuery, conversationHistory = [], context = {}) {
    const endpoint = '/generate-sql';
    const payload = {
      nl_query: nlQuery,
      conversation_history: conversationHistory,
      // Intent-aware context for schema reuse
      ...(context.sessionId && { session_id: context.sessionId }),
      ...(context.lastSql && { last_sql: context.lastSql }),
      ...(context.lastSchemaRecommendations && { last_schema_recommendations: context.lastSchemaRecommendations })
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
   * @param {number} timeoutSeconds - Timeout for execution in seconds (default: REACT_APP_EXECUTE_TIMEOUT_SECONDS or 120)
   * @returns {Promise} API response containing query results
   */
  static async executeSql(sql, maxResults = 500, timeoutSeconds = parseInt(process.env.REACT_APP_EXECUTE_TIMEOUT_SECONDS) || 120, nlQuery = null, conversationHistory = [], metadata = {}) {
    const endpoint = '/execute-sql';
    const payload = {
      sql,
      max_results: maxResults,
      timeout_seconds: timeoutSeconds,
      nl_query: nlQuery,
      conversation_history: conversationHistory,
      // Include optional metadata for query history
      ...(metadata.session_id && { session_id: metadata.session_id }),
      ...(metadata.chart_recommendation && { chart_recommendation: metadata.chart_recommendation }),
      ...(metadata.model_reasoning && { model_reasoning: metadata.model_reasoning }),
      ...(metadata.schema_recommendations && { schema_recommendations: metadata.schema_recommendations }),
      ...(metadata.preferred_tables && { preferred_tables: metadata.preferred_tables }),
      ...(metadata.llm_response_time_ms && { llm_response_time_ms: metadata.llm_response_time_ms })
    };

    // Use a per-request HTTP timeout = Trino timeout + 30s buffer
    // This prevents Axios from dropping the connection before Trino finishes
    const httpTimeoutMs = (timeoutSeconds + 30) * 1000;

    try {
      const response = await apiInstance.post(endpoint, payload, { timeout: httpTimeoutMs });
      return response.data;
    } catch (error) {
      console.error('Execute SQL failed:', error);
      throw Network.handleError(error);
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
    const endpoint = '/explorer/databases';
    
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
    const endpoint = `/explorer/databases/${database}/schemas`;
    
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
    const endpoint = `/explorer/databases/${database}/schemas/${schema}/objects`;
    
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
    const endpoint = `/explorer/databases/${database}/schemas/${schema}/tables/${table}`;
    
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
    const endpoint = '/explorer/search';
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
