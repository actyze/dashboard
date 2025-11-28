import { Network } from './network';
import { API_CONFIG } from './apiConfig';

/**
 * GraphQL Service for making GraphQL requests to Nexus
 */
export class GraphQLService {
  /**
   * Process natural language query and get SQL + results
   * @param {string} message - Natural language query
   * @param {Array} conversationHistory - Previous conversation messages (optional)
   * @returns {Promise} GraphQL response
   */
  static async processNaturalLanguage(message, conversationHistory = []) {
    const mutation = `
      mutation ProcessNaturalLanguage($input: ConversationInputGQL!) {
        processNaturalLanguage(input: $input) {
          success
          nlQuery
          generatedSql
          queryResults {
            columns
            rows
            rowCount
          }
          processingTime
          executionTime
          error
          modelConfidence
          modelReasoning
        }
      }
    `;

    const variables = {
      input: {
        message,
        conversationHistory
      }
    };

    try {
      const response = await Network.post(API_CONFIG.GRAPHQL_ENDPOINT, {
        query: mutation,
        variables
      });

      if (response.data && response.data.processNaturalLanguage) {
        return response.data.processNaturalLanguage;
      }

      // Handle GraphQL errors
      if (response.errors && response.errors.length > 0) {
        throw new Error(response.errors[0].message);
      }

      throw new Error('Invalid GraphQL response');
    } catch (error) {
      console.error('GraphQL processNaturalLanguage failed:', error);
      throw error;
    }
  }

  /**
   * Generic GraphQL query method
   * @param {string} query - GraphQL query or mutation string
   * @param {object} variables - Query variables
   * @returns {Promise} GraphQL response
   */
  static async query(query, variables = {}) {
    try {
      const response = await Network.post(API_CONFIG.GRAPHQL_ENDPOINT, {
        query,
        variables
      });

      if (response.errors && response.errors.length > 0) {
        throw new Error(response.errors[0].message);
      }

      return response.data;
    } catch (error) {
      console.error('GraphQL query failed:', error);
      throw error;
    }
  }
}

export default GraphQLService;

