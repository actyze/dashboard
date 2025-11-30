import { useMutation } from '@tanstack/react-query';
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
        const chartData = transformedResults ? transformToChartData(transformedResults) : null;
        
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

export default {
  useGenerateSql,
  useExecuteSql,
  useProcessNaturalLanguage,
};

