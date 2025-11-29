/**
 * React Query Hooks
 * 
 * This module exports custom hooks for data fetching using @tanstack/react-query
 * Each hook is configured with service-specific cache settings from queryConfig
 * 
 * We use specific hooks for each operation rather than generic hooks.
 * Add new hooks here as needed for different operations.
 */

export {
  useProcessNaturalLanguage,
} from './useGraphQL';

