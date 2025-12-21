import { useMutation, useQuery } from '@tanstack/react-query';
import { RestService } from '../services/RestService';
import { transformQueryResults } from '../utils/dataTransformers';

export const useGenerateSql = (options = {}) => {
  return useMutation({
    mutationFn: async ({ nlQuery, conversationHistory = [] }) => {
      const response = await RestService.generateSql(nlQuery, conversationHistory);
      return response;
    },
    ...options,
  });
};

/**
 * Hook for direct SQL execution (manual mode).
 * Returns data with manual-required chart config - user must select axes.
 * Query results are cached in component state for chart re-rendering.
 */
export const useExecuteSql = (options = {}) => {
  return useMutation({
    mutationFn: async ({ sql, maxResults = 500, timeoutSeconds = 30, nlQuery = null, conversationHistory = [] }) => {
      const response = await RestService.executeSql(sql, maxResults, timeoutSeconds, nlQuery, conversationHistory);
      
      if (response.success && response.query_results) {
        const transformedResults = transformQueryResults(response.query_results);
        
        // For direct SQL execution, always trigger manual mode
        // User selects chart axes from cached results (no re-fetch)
        const chartData = transformedResults ? {
          chart: {
            type: 'bar',
            config: {}, // Empty = manual mode
            fallback: true,
            source: 'manual-required'
          },
          data: transformedResults,
          cached: false
        } : null;
        
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

/**
 * Progressive NL-to-SQL hook with callbacks for non-blocking UI updates.
 * Each stage updates the UI immediately without waiting for subsequent stages.
 * 
 * Options:
 * - onSqlGenerated(sql, chartRecommendation, reasoning): Called when SQL is generated
 * - onResultsReady(results, chartData): Called when execution results are ready
 * - onError(error, stage): Called on error at any stage
 */
export const useProcessNaturalLanguage = (options = {}) => {
  const { onSqlGenerated, onResultsReady, onError, ...mutationOptions } = options;
  
  return useMutation({
    mutationFn: async ({ nlQuery, conversationHistory = [], context = {} }) => {
      let generatedSql = null;
      let chartRecommendation = null;
      let schemaRecommendations = null;
      let processingTime = null;
      let reasoning = null;
      let intent = null;
      let intentConfidence = null;
      
      // STAGE 1: Generate SQL (with ML-based intent detection)
      try {
        console.log('Stage 1: Generating SQL with intent detection...');
        const generateResponse = await RestService.generateSql(nlQuery, conversationHistory, context);
        
        if (!generateResponse.success) {
          const error = generateResponse.error || 'Failed to generate SQL';
          if (onError) onError(error, 'generate');
          throw new Error(error);
        }
        
        generatedSql = generateResponse.generated_sql;
        chartRecommendation = generateResponse.chart_recommendation;
        schemaRecommendations = generateResponse.schema_recommendations;
        processingTime = generateResponse.processing_time;
        reasoning = generateResponse.model_reasoning;
        intent = generateResponse.intent;  // NEW: ML-detected intent
        intentConfidence = generateResponse.intent_confidence;
        
        console.log(`Intent detected: ${intent} (confidence: ${intentConfidence?.toFixed(3)})`);
        
        // CALLBACK: SQL is ready - update UI immediately!
        if (onSqlGenerated) {
          onSqlGenerated(generatedSql, chartRecommendation, reasoning);
        }
        
      } catch (error) {
        if (onError) onError(error.message, 'generate');
        return {
          success: false,
          error: error.message,
          stage: 'generate'
        };
      }
      
      // STAGE 2: Execute SQL
      let transformedResults = null;
      let executionTime = null;
      
      try {
        console.log('Stage 2: Executing SQL...');
        const executeResponse = await RestService.executeSql(
          generatedSql, 
          500, 
          30, 
          nlQuery,
          conversationHistory,
          {
            session_id: `nl-${Date.now()}`,
            chart_recommendation: chartRecommendation,
            model_reasoning: reasoning,
            schema_recommendations: schemaRecommendations,
            llm_response_time_ms: processingTime ? Math.round(processingTime) : null
          }
        );
        
        if (!executeResponse.success) {
          const error = executeResponse.error || 'Failed to execute SQL';
          if (onError) onError(error, 'execute');
          // Still return partial success with SQL
          return {
            success: false,
            error: error,
            stage: 'execute',
            generatedSql,
            chartRecommendation,
            processingTime
          };
        }
        
        transformedResults = transformQueryResults(executeResponse.query_results);
        executionTime = executeResponse.execution_time;
        
        // Build chart data from LLM recommendation
        let chartData = null;
        if (transformedResults) {
          if (chartRecommendation && chartRecommendation.x_column && chartRecommendation.y_column) {
            chartData = {
              chart: {
                type: chartRecommendation.chart_type || 'bar',
                config: {
                  xField: chartRecommendation.x_column,
                  yField: chartRecommendation.y_column,
                  title: chartRecommendation.title || '',
                  series: chartRecommendation.series_column
                },
                fallback: false,
                source: 'llm'
              },
              data: transformedResults,
              cached: false
            };
          } else {
            chartData = {
              chart: {
                type: 'bar',
                config: {},
                fallback: true,
                source: 'manual-required'
              },
              data: transformedResults,
              cached: false
            };
          }
        }
        
        // CALLBACK: Results are ready - update UI immediately!
        if (onResultsReady) {
          onResultsReady(transformedResults, chartData);
        }
        
        // Return complete result (including context for next query)
        return {
          success: true,
          generatedSql,
          queryResults: transformedResults,
          chartData,
          chartRecommendation,
          schemaRecommendations,
          processingTime,
          executionTime,
          error: null,
          // Intent detection results
          intent,
          intentConfidence,
          // Context for next query (schema reuse)
          contextForNextQuery: {
            lastSql: generatedSql,
            lastSchemaRecommendations: schemaRecommendations,
            lastReasoning: reasoning
          }
        };
        
      } catch (error) {
        if (onError) onError(error.message, 'execute');
        return {
          success: false,
          error: error.message,
          stage: 'execute',
          generatedSql,
          chartRecommendation,
          processingTime
        };
      }
    },
    ...mutationOptions,
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

