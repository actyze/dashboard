import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GraphQLService } from '../services/GraphQLService';
import { transformQueryResults, transformToChartData } from '../utils/dataTransformers';

/**
 * Custom hook for processing natural language queries via GraphQL
 * 
 * Automatically transforms the response data to component-ready format.
 * 
 * Returns transformed data structure:
 * {
 *   success: boolean,
 *   generatedSql: string,
 *   queryResults: { data: [], columns: [], rowCount: number },
 *   chartData: { chart: {}, data: {} },
 *   processingTime: number,
 *   executionTime: number,
 *   modelConfidence: number,
 *   error: string
 * }
 * 
 * Usage:
 * const { mutate, isPending, error, data } = useProcessNaturalLanguage({
 *   onSuccess: (transformedData) => {
 *     // Data is already transformed and ready to use
 *     setSqlQuery(transformedData.generatedSql);
 *     setQueryResults(transformedData.queryResults);
 *     setChartData(transformedData.chartData);
 *   }
 * });
 * 
 * mutate({ message: 'Show me sales data', conversationHistory: [] });
 */
export const useProcessNaturalLanguage = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ message, conversationHistory = [] }) => {
      const response = await GraphQLService.processNaturalLanguage(message, conversationHistory);
      
      // Transform the response data automatically
      const transformedResults = transformQueryResults(response.queryResults);
      const chartData = transformedResults ? transformToChartData(transformedResults) : null;
      
      return {
        ...response,
        queryResults: transformedResults,
        chartData
      };
    },
    
    gcTime: options.gcTime ?? 0,
    
    onSuccess: (data, variables, context) => {
      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
      
      if (options.invalidateQueries) {
        options.invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey });
        });
      }
    },
    
    onError: (error, variables, context) => {
      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
    
    ...options,
  });
};

/**
 * Export all GraphQL hooks
 * 
 * Note: We use specific hooks for each operation rather than a generic hook.
 * This keeps the API simple and clear. Add new hooks here as needed.
 */
export default {
  useProcessNaturalLanguage,
};

