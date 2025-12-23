-- =====================================================================================
-- Simplify query_history table - Remove unused columns
-- =====================================================================================
-- Keep only essential columns that are actually used on frontend
-- =====================================================================================

-- Drop view first to avoid dependencies
DROP VIEW IF EXISTS nexus.query_history_with_users CASCADE;

-- Remove bloated columns that aren't being leveraged
ALTER TABLE nexus.query_history 
    DROP COLUMN IF EXISTS session_id CASCADE,
    DROP COLUMN IF EXISTS schema_recommendations CASCADE,
    DROP COLUMN IF EXISTS model_confidence CASCADE,
    DROP COLUMN IF EXISTS retry_attempts CASCADE,
    DROP COLUMN IF EXISTS query_type CASCADE,
    DROP COLUMN IF EXISTS chart_recommendation CASCADE,
    DROP COLUMN IF EXISTS llm_response_time_ms CASCADE,
    DROP COLUMN IF EXISTS generated_at CASCADE,
    DROP COLUMN IF EXISTS executed_at CASCADE,
    DROP COLUMN IF EXISTS updated_at CASCADE,
    DROP COLUMN IF EXISTS model_reasoning CASCADE,
    DROP COLUMN IF EXISTS favorite_name CASCADE;  -- Keep query_name instead

-- Ensure query_name is properly indexed for favorites
DROP INDEX IF EXISTS nexus.idx_query_history_query_name;
CREATE INDEX IF NOT EXISTS idx_query_history_query_name 
    ON nexus.query_history(query_name) 
    WHERE query_name IS NOT NULL;

-- Drop unnecessary indexes
DROP INDEX IF EXISTS nexus.idx_query_history_generated_at;
DROP INDEX IF EXISTS nexus.idx_query_history_query_type;
DROP INDEX IF EXISTS nexus.idx_query_history_user_generated;

-- Add comment to query_name column for clarity
COMMENT ON COLUMN nexus.query_history.query_name IS 'Optional name for favorite queries';

-- Recreate the view with simplified schema
CREATE OR REPLACE VIEW nexus.query_history_with_users AS
SELECT 
    qh.id,
    qh.user_id,
    u.username,
    u.email AS user_email,
    qh.natural_language_query,
    qh.generated_sql,
    qh.query_hash,
    qh.execution_status,
    qh.execution_time_ms,
    qh.row_count,
    qh.error_message,
    qh.query_name,
    qh.execution_count,
    qh.created_at,
    qh.last_executed_at,
    qh.is_favorite,
    qh.tags
FROM nexus.query_history qh
LEFT JOIN nexus.users u ON qh.user_id = u.id;

COMMENT ON VIEW nexus.query_history_with_users IS 'Simplified query history with user information - only essential columns';

-- =====================================================================================
-- Final Schema Summary
-- =====================================================================================
-- Essential Columns (15 total):
-- 1.  id                     - Primary key
-- 2.  user_id                - Who executed the query
-- 3.  natural_language_query - Original NL query
-- 4.  generated_sql          - Generated/manual SQL
-- 5.  query_hash             - For deduplication (md5 of SQL + user_id)
-- 6.  execution_status       - SUCCESS or FAILURE
-- 7.  execution_time_ms      - Query execution time
-- 8.  row_count              - Number of rows returned (useful)
-- 9.  error_message          - Error details if failed
-- 10. query_name             - Optional name for favorites
-- 11. execution_count        - How many times executed
-- 12. created_at             - First execution timestamp
-- 13. last_executed_at       - Most recent execution timestamp
-- 14. is_favorite            - Boolean flag for favorites
-- 15. tags                   - Optional tags for categorization
-- =====================================================================================

