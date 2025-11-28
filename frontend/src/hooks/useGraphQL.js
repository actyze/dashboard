import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GraphQLService } from '../services/GraphQLService';

/**
 * Custom hook for processing natural language queries via GraphQL
 * 
 * Usage:
 * const { mutate, isPending, error, data } = useProcessNaturalLanguage({
 *   onSuccess: (data) => console.log('Success:', data),
 *   onError: (error) => console.error('Error:', error)
 * });
 * 
 * mutate({ message: 'Show me sales data', conversationHistory: [] });
 */
export const useProcessNaturalLanguage = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ message, conversationHistory = [] }) => 
      GraphQLService.processNaturalLanguage(message, conversationHistory),
    
    // Custom options can be passed per service
    gcTime: options.gcTime ?? 0, // No caching by default
    
    onSuccess: (data, variables, context) => {
      // Custom onSuccess handler
      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
      
      // Invalidate related queries if needed
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
    
    ...options, // Allow overriding any options
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

