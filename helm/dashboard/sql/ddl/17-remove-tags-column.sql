-- =====================================================================================
-- Remove tags column from query_history (not needed)
-- =====================================================================================

-- Drop dependent view first
DROP VIEW IF EXISTS nexus.query_history_with_users CASCADE;

-- Remove tags column
ALTER TABLE nexus.query_history DROP COLUMN IF EXISTS tags;

-- Recreate view without tags
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
    qh.execution_count,
    qh.last_executed_at,
    qh.is_favorite,
    qh.query_name,
    qh.created_at
FROM nexus.query_history qh
LEFT JOIN nexus.users u ON qh.user_id = u.id;

GRANT SELECT ON nexus.query_history_with_users TO nexus_app;

COMMENT ON TABLE nexus.query_history IS 'Simplified query history: essential execution metadata only';

