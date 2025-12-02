import { useMutation, useQuery } from '@tanstack/react-query';
import { RestService } from '../services/RestService';
import { transformQueryResults, transformToChartData } from '../utils/dataTransformers';

export const useGenerateSql = (options = {}) => {
  return useMutation({
    mutationFn: async ({ nlQuery, conversationHistory = [] }) => {
      const response = await RestService.generateSql(nlQuery, conversationHistory);
      return response;
    },
    ...options,
  });
};

export const useExecuteSql = (options = {}) => {
  return useMutation({
    mutationFn: async ({ sql, maxResults = 100, timeoutSeconds = 30, nlQuery = null, conversationHistory = [] }) => {
      const response = await RestService.executeSql(sql, maxResults, timeoutSeconds, nlQuery, conversationHistory);
      
      if (response.success && response.query_results) {
        const transformedResults = transformQueryResults(response.query_results);
        const chartData = transformedResults ? transformToChartData(transformedResults) : null;
        
        return {
          ...response,
          queryResults: transformedResults,
          chartData
        };
      }
      
      return response;
    },
    ...options,
  });
};

export const useProcessNaturalLanguage = (options = {}) => {
  return useMutation({
    mutationFn: async ({ nlQuery, conversationHistory = [] }) => {
      try {
        const generateResponse = await RestService.generateSql(nlQuery, conversationHistory);
        
        if (!generateResponse.success) {
          throw new Error(generateResponse.error || 'Failed to generate SQL');
        }
        
        const generatedSql = generateResponse.generated_sql;
        
        const executeResponse = await RestService.executeSql(
          generatedSql, 
          100, 
          30, 
          nlQuery,
          conversationHistory
        );
        
        if (!executeResponse.success) {
          throw new Error(executeResponse.error || 'Failed to execute SQL');
        }

        const transformedResults = transformQueryResults(executeResponse.query_results);
        let chartData = transformedResults ? transformToChartData(transformedResults) : null;
        
        // Smart Chart Logic: If too many rows, ask backend for aggregated chart
        if (transformedResults && transformedResults.rowCount > 20) {
          try {
            const chartResponse = await RestService.generateChart(
              nlQuery, 
              generatedSql, 
              { 
                recommendations: generateResponse.schema_recommendations,
                row_count: transformedResults.rowCount,
                is_limited: transformedResults.rowCount >= 100  // Check if we hit the max_results limit
              }
            );
            
            if (chartResponse.success && chartResponse.chart_data) {
              // Transform backend chart data to frontend format
              // Backend returns { columns: [], rows: [] } similar to query_results
              const backendChartResults = transformQueryResults(chartResponse.chart_data);
              
              chartData = {
                chart: {
                  type: chartResponse.chart_config.type || 'bar',
                  config: {
                    xField: chartResponse.chart_config.x_axis,
                    yField: chartResponse.chart_config.y_axis,
                    title: chartResponse.chart_config.title
                  },
                  fallback: false
                },
                data: backendChartResults,
                cached: false
              };
            }
          } catch (err) {
            console.warn("Smart chart generation failed, falling back to local", err);
          }
        }
        
        return {
          success: true,
          generatedSql,
          queryResults: transformedResults,
          chartData,
          processingTime: generateResponse.processing_time,
          executionTime: executeResponse.execution_time,
          error: null
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || 'Failed to process natural language query',
          generatedSql: null,
          queryResults: null,
          chartData: null
        };
      }
    },
    ...options,
  });
};

// =============================================================================
// Explorer API Hooks
// =============================================================================

/**
 * Hook to fetch all databases
 * @param {object} options - React Query options
 * @returns {object} Query result with databases data
 */
export const useGetDatabases = (options = {}) => {
  return useQuery({
    queryKey: ['databases'],
    queryFn: async () => {
      const response = await RestService.getDatabases();
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Hook to fetch schemas for a specific database
 * @param {string} database - Database name
 * @param {object} options - React Query options
 * @returns {object} Query result with schemas data
 */
export const useGetDatabaseSchemas = (database, options = {}) => {
  return useQuery({
    queryKey: ['database-schemas', database],
    queryFn: async () => {
      const response = await RestService.getDatabaseSchemas(database);
      return response;
    },
    enabled: !!database, // Only fetch if database is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Hook to fetch objects for a specific schema
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @param {object} options - React Query options
 * @returns {object} Query result with objects data
 */
export const useGetSchemaObjects = (database, schema, options = {}) => {
  return useQuery({
    queryKey: ['schema-objects', database, schema],
    queryFn: async () => {
      const response = await RestService.getSchemaObjects(database, schema);
      return response;
    },
    enabled: !!database && !!schema, // Only fetch if both are provided
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Hook to fetch table details
 * @param {string} database - Database name
 * @param {string} schema - Schema name
 * @param {string} table - Table name
 * @param {object} options - React Query options
 * @returns {object} Query result with table details
 */
export const useGetTableDetails = (database, schema, table, options = {}) => {
  return useQuery({
    queryKey: ['table-details', database, schema, table],
    queryFn: async () => {
      const response = await RestService.getTableDetails(database, schema, table);
      return response;
    },
    enabled: !!database && !!schema && !!table, // Only fetch if all are provided
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
};

/**
 * Hook to search database objects
 * @param {object} options - React Query options
 * @returns {object} Mutation result for searching
 */
export const useSearchDatabaseObjects = (options = {}) => {
  return useMutation({
    mutationFn: async ({ query, database = null, schema = null, objectType = null }) => {
      const response = await RestService.searchDatabaseObjects(query, database, schema, objectType);
      return response;
    },
    ...options,
  });
};

export default {
  useGenerateSql,
  useExecuteSql,
  useProcessNaturalLanguage,
  useGetDatabases,
  useGetDatabaseSchemas,
  useGetSchemaObjects,
  useGetTableDetails,
  useSearchDatabaseObjects,
};

